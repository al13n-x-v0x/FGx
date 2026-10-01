--[[
	WeaponController.lua (ModuleScript -> StarterPlayerScripts/Controllers)
	Client weapon feel: procedural viewmodel (no animation assets), camera
	recoil with recovery, ammo prediction, firing, reload + switch inputs.
	The server stays authoritative: this file predicts for zero perceived
_latency and reconciles on every "n_state" message.
]]

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local RunService = game:GetService("RunService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local WeaponConfig = require(ReplicatedStorage.Shared.WeaponConfig)
local CombatConfig = require(ReplicatedStorage.Shared.CombatConfig)
local Utility = require(ReplicatedStorage.Shared.Utility)

local WeaponController = {}

local hub = nil
local player = Players.LocalPlayer

-- mirrors (server corrects these on n_state) ---------------------------------
local loadout = { 1 = "ar", 2 = "pistol", 3 = "knife" }
local ammoMirror = {} -- [wid] = {mag, reserve}
local currentSlot = 1
local pendingReload = false -- R pressed, waiting for server ack
local lastButt = 0

-- viewmodel ------------------------------------------------------------------
local vmParts = {} -- { {part, offset} }
local vmRoot = nil -- Model parented to camera
local muzzle = nil -- reusable flash part (pooled: never re-created per shot)
local flashToken = 0

-- animation / feel state -----------------------------------------------------
local recoilRemaining = 0 -- radians of pitch left to recover
local recoilSide = 0
local kickBack = 0 -- viewmodel z kick
local swayPitch, swayYaw = 0, 0
local bobTime = 0
local sprintT, slideT = 0, 0
local anim = { kind = "none", start = 0, dur = 0, a = 0, b = 0 }
local prevCamCF = nil
local firing = false
local lastBuiltWid = nil
local sprintActive = false
local slideActive = false
local lightChain = 1
local lightPrev = 0

local function camera()
	return workspace.CurrentCamera
end

local function currentDef()
	return WeaponConfig.get(loadout[currentSlot])
end

local function playAnim(kind, dur, a, b)
	anim = { kind = kind, start = os.clock(), dur = dur, a = a or 0, b = b or 0 }
end

function WeaponController.playSwing(kind, combo)
	-- kind: "LIGHT" | "HEAVY" | "GUNBUTT"
	if kind == "LIGHT" then
		local dir = (combo == 2) and -1 or 1
		playAnim("swing", 0.26, 55 * dir, -55 * dir)
	elseif kind == "HEAVY" then
		playAnim("heavy", 0.5, 0, 0)
	elseif kind == "GUNBUTT" then
		playAnim("butt", 0.34, 0, 0)
	end
end

-- Build the camera-space gun from the weapon's data blueprint ----------------
local function destroyViewmodel()
	if vmRoot then
		vmRoot:Destroy()
	end
	vmRoot = nil
	vmParts = {}
	muzzle = nil
end

local function buildViewmodel(def)
	destroyViewmodel()
	local cam = camera()
	if not cam or not def.viewmodel then
		return
	end
	local model = Instance.new("Model")
	model.Name = "SZ_Viewmodel"
	for _, piece in ipairs(def.viewmodel) do
		local part = Instance.new("Part")
		part.Size = Vector3.new(piece.size[1], piece.size[2], piece.size[3])
		part.Color = Color3.fromRGB(piece.color[1], piece.color[2], piece.color[3])
		part.Material = Enum.Material.SmoothPlastic
		part.Anchored = true
		part.CanCollide = false
		part.CanQuery = false
		part.CanTouch = false
		part.CastShadow = false
		part.Massless = true
		part.Parent = model
		vmParts[#vmParts + 1] = { part = part, offset = piece.offset }
	end
	-- pooled muzzle flash (one instance for the whole session; melee has none)
	if def.muzzle then
		muzzle = Instance.new("Part")
		muzzle.Shape = Enum.PartType.Ball
		muzzle.Color = Color3.fromRGB(def.muzzle.color[1], def.muzzle.color[2], def.muzzle.color[3])
		muzzle.Material = Enum.Material.Neon
		muzzle.Size = Vector3.new(1, 1, 1) * def.muzzle.size
		muzzle.Transparency = 1
		muzzle.Anchored = true
		muzzle.CanCollide = false
		muzzle.CanQuery = false
		muzzle.CanTouch = false
		muzzle.CastShadow = false
		muzzle.Parent = model
	end
	vmRoot = model
	vmRoot.Parent = cam
	lastBuiltWid = def.id
end

local function flashMuzzle(def)
	if not muzzle then
		return
	end
	flashToken = flashToken + 1
	local my = flashToken
	muzzle.Transparency = 0
	muzzle.Size = Vector3.new(1, 1, 1) * def.muzzle.size
	task.delay(def.muzzle.time, function()
		if flashToken == my and muzzle then
			muzzle.Transparency = 1
		end
	end)
end

-- Ammo / weapon HUD emission ------------------------------------------------
local function emitAmmo()
	local def = currentDef()
	if not def or def.kind == "melee" then
		hub:emit("ammo", { melee = true, name = def and def.name or "" })
		return
	end
	local a = ammoMirror[def.id]
	hub:emit("ammo", {
		name = def.name,
		mag = a and a.mag or 0,
		reserve = a and a.reserve or 0,
		slot = currentSlot,
	})
end

local function emitWeapon()
	local def = currentDef()
	if def then
		hub:emit("weapon", { wid = def.id, name = def.name, slot = currentSlot, kind = def.kind })
	end
end

-- Shooting --------------------------------------------------------------------
local function applyCameraRecoil(def)
	recoilRemaining = recoilRemaining + math.rad(def.recoilUp)
	recoilSide = math.rad((math.random() * 2 - 1) * def.recoilSide)
	kickBack = math.min(0.22, kickBack + 0.08 + def.recoilUp * 0.02)
	local cam = camera()
	if cam then
		cam.CFrame = cam.CFrame * CFrame.Angles(math.rad(def.recoilUp), recoilSide, 0)
	end
end

local function sendFire()
	local cam = camera()
	if not cam then
		return
	end
	local Remotes = ReplicatedStorage:WaitForChild("Remotes")
	Remotes:WaitForChild("Fire"):FireServer(cam.CFrame.Position, cam.CFrame.LookVector)
end

local function attemptGunButt()
	local now = os.clock()
	if now - lastButt < CombatConfig.GunButt.cooldown - CombatConfig.Validate.meleeCooldownTolerance then
		return
	end
	lastButt = now
	WeaponController.playSwing("GUNBUTT", 1)
	hub:emit("req_gunbutt")
end

local function tryShoot()
	local def = currentDef()
	if not def or def.kind ~= "gun" then
		return
	end
	if pendingReload then
		return
	end
	local a = ammoMirror[def.id]
	if a == nil then
		return
	end
	if a.mag <= 0 then
		-- EXACTLY 0: the shoot button becomes a gun-butt strike
		attemptGunButt()
		firing = false
		return
	end

	a.mag = a.mag - 1 -- predicted; server reconciles via n_state
	emitAmmo()
	flashMuzzle(def)
	applyCameraRecoil(def)
	Utility.play("gunshot", 0.45)
	sendFire()
end

local function startFiring()
	if firing then
		return
	end
	local def = currentDef()
	if not def or def.kind ~= "gun" then
		return
	end
	firing = true
	task.spawn(function()
		while firing do
			local d = currentDef()
			if not d or d.kind ~= "gun" then
				break
			end
			tryShoot()
			if not d.auto then
				break
			end
			task.wait(d.fireRate)
		end
		firing = false
	end)
end

local function stopFiring()
	firing = false
end

-- Reload ----------------------------------------------------------------------
local function requestReload()
	local def = currentDef()
	if not def or def.kind ~= "gun" or pendingReload then
		return
	end
	local a = ammoMirror[def.id]
	if a == nil or a.mag >= def.mag or a.reserve <= 0 then
		return
	end
	pendingReload = true
	playAnim("reload", def.reloadTime, 0, 0)
	Utility.play("reload", 0.5)
	ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Reload"):FireServer()
	-- safety: if the server rejects (state changed), never soft-lock the gun
	task.delay(def.reloadTime + 0.5, function()
		if pendingReload then
			pendingReload = false
		end
	end)
end

-- Weapon switching ------------------------------------------------------------
local function setSlotLocal(slot)
	if loadout[slot] == nil or slot == currentSlot then
		return
	end
	currentSlot = slot
	firing = false
	pendingReload = false
	local def = currentDef()
	if def then
		buildViewmodel(def)
	end
	emitWeapon()
	emitAmmo()
end

local function requestSlot(slot)
	if loadout[slot] == nil then
		return
	end
	setSlotLocal(slot)
	ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Switch"):FireServer(slot)
end

function WeaponController.getEquipped()
	local def = currentDef()
	return loadout[currentSlot], def
end

function WeaponController.getMag()
	local def = currentDef()
	if not def or def.kind ~= "gun" then
		return nil
	end
	local a = ammoMirror[def.id]
	return a and a.mag or 0
end

-- Input ----------------------------------------------------------------------
local function onInput(input, processed)
	if processed then
		return
	end
	local def = currentDef()
	if input.UserInputType == Enum.UserInputType.MouseButton1 then
		if def and def.kind == "melee" then
			local now = os.clock()
			local idx = 1
			if now - lightPrev <= CombatConfig.Light.comboWindow then
				idx = lightChain + 1
				if idx > #CombatConfig.Light.comboDamage then
					idx = 1
				end
			end
			lightChain = idx
			lightPrev = now
			WeaponController.playSwing("LIGHT", idx)
			hub:emit("req_light")
		elseif def and def.kind == "gun" then
			local a = ammoMirror[def.id]
			if a and a.mag <= 0 then
				attemptGunButt()
			else
				startFiring()
			end
		end
	elseif input.UserInputType == Enum.UserInputType.MouseButton2 then
		if def and def.kind == "melee" then
			WeaponController.playSwing("HEAVY", 1)
			hub:emit("req_heavy")
		end
	elseif input.KeyCode == Enum.KeyCode.R then
		requestReload()
	elseif input.KeyCode == Enum.KeyCode.One then
		requestSlot(1)
	elseif input.KeyCode == Enum.KeyCode.Two then
		requestSlot(2)
	elseif input.KeyCode == Enum.KeyCode.Three then
		requestSlot(3)
	end
end

local function onInputEnd(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1 then
		stopFiring()
	end
end

-- Render: viewmodel placement + recoil recovery -------------------------------
local function onRender(dt)
	local cam = camera()
	if not cam then
		return
	end

	-- recoil recovery: pull the pitch back down after each kick
	if recoilRemaining > 0.0001 then
		local recover = math.min(recoilRemaining, dt * 6)
		cam.CFrame = cam.CFrame * CFrame.Angles(-recover, 0, 0)
		recoilRemaining = recoilRemaining - recover
	end

	if vmRoot == nil then
		prevCamCF = cam.CFrame
		return
	end
	if vmRoot.Parent ~= cam then
		vmRoot.Parent = cam
	end

	-- aim sway (camera rotation delta, clamped)
	if prevCamCF then
		local delta = prevCamCF:ToObjectSpace(cam.CFrame)
		local dx, dy = delta:ToEulerAnglesYXZ()
		local k = math.min(1, dt * 12)
		swayPitch = swayPitch + (Utility.clamp(dx, -0.07, 0.07) - swayPitch) * k
		swayYaw = swayYaw + (Utility.clamp(dy, -0.09, 0.09) - swayYaw) * k
	end
	prevCamCF = cam.CFrame

	-- movement bob (only while actually moving on the ground)
	local char = player.Character
	local hum = char and Utility.humanoidOf(char)
	local moveMag = 0
	if hum then
		moveMag = hum.MoveDirection.Magnitude
	end
	bobTime = bobTime + dt * 9 * moveMag
	local bobX = math.cos(bobTime) * 0.02 * moveMag
	local bobY = math.abs(math.sin(bobTime)) * 0.018 * moveMag

	-- sprint / slide pose blending (state arrives event-driven via the hub)
	local k = math.min(1, dt * 10)
	local sprintTarget = (sprintActive and not slideActive) and 1 or 0
	local slideTarget = slideActive and 1 or 0
	sprintT = sprintT + (sprintTarget - sprintT) * k
	sprintT = Utility.clamp(sprintT, 0, 1)
	slideT = slideT + (slideTarget - slideT) * k
	slideT = Utility.clamp(slideT, 0, 1)

	-- animation pose
	local pos = Vector3.new(bobX, bobY, 0)
	local pitch = -swayPitch * 0.6
	local yaw = swayYaw * 0.6
	local roll = 0
	local t = os.clock() - anim.start
	if anim.kind ~= "none" and t <= anim.dur then
		local p = t / anim.dur
		if anim.kind == "reload" then
			local s = math.sin(p * math.pi)
			pitch = pitch - 0.6 * s
			roll = roll + 0.3 * s
			pos = pos + Vector3.new(0, -0.25 * s, 0.12 * s)
		elseif anim.kind == "swing" then
			local e = p * p * (3 - 2 * p)
			yaw = yaw + math.rad(anim.a + (anim.b - anim.a) * e)
			pitch = pitch - 0.5 * math.sin(p * math.pi)
			pos = pos + Vector3.new(0.12 * math.sin(p * math.pi), -0.05, -0.3 * math.sin(p * math.pi))
		elseif anim.kind == "heavy" then
			if p < 0.45 then
				local q = p / 0.45
				pitch = pitch - 0.9 * q
				pos = pos + Vector3.new(0, 0.12 * q, 0.12 * q)
			else
				local q = (p - 0.45) / 0.55
				pitch = pitch - 0.9 + 1.6 * q
				pos = pos + Vector3.new(0, 0.12 - 0.24 * q, 0.12 - 0.6 * q)
			end
		elseif anim.kind == "butt" then
			local s = math.sin(p * math.pi)
			pitch = pitch + 0.4 * s
			pos = pos + Vector3.new(0, -0.1 * s, -0.55 * s)
		end
	else
		anim.kind = "none"
	end

	-- recoil kick spring on the gun itself
	kickBack = kickBack * math.max(0, 1 - dt * 12)
	pitch = pitch + kickBack * 1.2
	pos = pos + Vector3.new(0, kickBack * 0.1, kickBack)

	-- sprint tilt (gun drops left) + slide drop
	yaw = yaw + sprintT * math.rad(14)
	pitch = pitch - sprintT * math.rad(20)
	pitch = pitch - slideT * math.rad(24)
	pos = pos + Vector3.new(-0.06 * sprintT, -0.08 * slideT, 0)

	local pose = CFrame.new(pos) * CFrame.Angles(pitch, yaw, roll)
	local base = cam.CFrame * pose
	for _, entry in ipairs(vmParts) do
		local o = entry.offset
		entry.part.CFrame = base * CFrame.new(o[1], o[2], o[3])
	end
	if muzzle then
		muzzle.CFrame = base * CFrame.new(0.42, -0.34, -2.7)
	end
end

-- Init ------------------------------------------------------------------------
function WeaponController.init(h)
	hub = h

	local def = currentDef()
	if def then
		buildViewmodel(def)
	end
	emitWeapon()
	emitAmmo()

	UserInputService.InputBegan:Connect(onInput)
	UserInputService.InputReleased:Connect(onInputEnd)
	RunService:BindToRenderStep("SZ_Viewmodel", Enum.RenderPriority.Camera.Value + 1, onRender)

	-- authoritative snapshot from the server
	hub:on("n_state", function(p)
		if type(p) ~= "table" then
			return
		end
		if p.wid and p.slot then
			loadout[p.slot] = p.wid
		end
		if p.wid and p.mag ~= nil then
			ammoMirror[p.wid] = { mag = p.mag, reserve = p.reserve }
		end
		if p.slot then
			currentSlot = p.slot
		end
		pendingReload = false
		local d = currentDef()
		if d and lastBuiltWid ~= d.id then
			buildViewmodel(d)
			emitWeapon()
		end
		emitAmmo()
	end)

	-- server confirmed a reload: block firing until the next n_state
	hub:on("n_reloadstart", function(p)
		pendingReload = true
		if anim.kind ~= "reload" then
			playAnim("reload", (p and p.time) or 2, 0, 0)
		end
	end)

	-- movement pose state from MovementController
	hub:on("move", function(s)
		sprintActive = s.sprint and true or false
		slideActive = s.slide and true or false
	end)
end

return WeaponController
