--[[
	MovementController.lua (ModuleScript -> StarterPlayerScripts/Controllers)
	COD/Rivals-style sprint + slide. Fully event-driven: no RenderStepped
	loop, no polling. Movement state changes are broadcast on the hub so the
	viewmodel can tilt/slide without this module touching UI or weapons.
]]

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)

local MovementController = {}

local hub = nil
local player = Players.LocalPlayer

local sprintHeld = false
local sliding = false
local slideEndAt = 0
local slideToken = 0 -- invalidates stale slide timers across respawns

local function humanoid()
	local char = player.Character
	return char and Utility.humanoidOf(char)
end

local function speedMult(hum)
	return hum:GetAttribute("SpeedMult") or 1
end

local function emitMove()
	hub:emit("move", { sprint = sprintHeld and not sliding, slide = sliding })
end

local function applySpeed(hum)
	local cfg = Config.Movement
	local m = speedMult(hum)
	if sliding then
		hum.WalkSpeed = cfg.slideBurstSpeed * m
	elseif sprintHeld then
		hum.WalkSpeed = cfg.sprintSpeed * m
	else
		hum.WalkSpeed = cfg.walkSpeed * m
	end
end

local function setFov(boost)
	local camera = workspace.CurrentCamera
	if camera then
		local target = 70 + boost
		if math.abs(camera.FieldOfView - target) > 0.1 then
			TweenService:Create(
				camera,
				TweenInfo.new(Config.Movement.sprintFovTime, Enum.EasingStyle.Quad, Enum.EasingDirection.Out),
				{ FieldOfView = target }
			):Play()
		end
	end
end

local function stopSlide()
	if not sliding then
		return
	end
	sliding = false
	slideToken = slideToken + 1
	local hum = humanoid()
	if hum then
		hum.CameraOffset = Vector3.new(0, 0, 0)
		applySpeed(hum)
	end
	emitMove()
end

local function startSlide()
	if sliding then
		return
	end
	local hum = humanoid()
	if not hum or hum.Health <= 0 then
		return
	end
	if hum.FloorMaterial == Enum.Material.Air then
		return -- no airborne slides
	end
	local cfg = Config.Movement
	sliding = true
	slideToken = slideToken + 1
	local myToken = slideToken
	hum.CameraOffset = Vector3.new(0, -cfg.crouchCameraOffset, 0)
	applySpeed(hum)
	Utility.play("slide", 0.4)
	emitMove()

	-- decay burst into slide speed, then stand up (event-driven timers)
	task.delay(0.3, function()
		if sliding and slideToken == myToken then
			local h = humanoid()
			if h then
				h.WalkSpeed = cfg.slideSpeed * speedMult(h)
			end
		end
	end)
	task.delay(cfg.slideDuration, function()
		if sliding and slideToken == myToken then
			stopSlide()
		end
	end)
end

local function updateSprint()
	local hum = humanoid()
	if hum then
		applySpeed(hum)
	end
	setFov(sprintHeld and not sliding and Config.Movement.sprintFovBoost or 0)
	emitMove()
end

function MovementController.init(h)
	hub = h

	local function onInput(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.LeftShift then
			if not sprintHeld then
				sprintHeld = true
				updateSprint()
			end
		elseif input.KeyCode == Enum.KeyCode.LeftControl or input.KeyCode == Enum.KeyCode.C then
			if sprintHeld and not sliding then
				startSlide()
			end
		elseif input.KeyCode == Enum.KeyCode.Space and sliding then
			-- slide-jump: cancel the slide, keep the momentum
			stopSlide()
			updateSprint()
		end
	end

	local function onRelease(input, processed)
		if input.KeyCode == Enum.KeyCode.LeftShift then
			sprintHeld = false
			updateSprint()
		end
	end

	UserInputService.InputBegan:Connect(onInput)
	UserInputService.InputReleased:Connect(onRelease)

	-- respawn resets movement state
	player.CharacterAdded:Connect(function(char)
		sliding = false
		slideToken = slideToken + 1
		local hum = char:WaitForChild("Humanoid")
		hum.CameraOffset = Vector3.new(0, 0, 0)
		-- admin !speed changes SpeedMult; re-apply base speed on spawn
		applySpeed(hum)
		emitMove()
	end)

	-- admin !speed while alive: attribute changes are replicated to us
	player.CharacterAdded:Connect(function(char)
		local hum = char:WaitForChild("Humanoid")
		hum:GetAttributeChangedSignal("SpeedMult"):Connect(function()
			applySpeed(hum)
		end)
	end)
end

return MovementController
