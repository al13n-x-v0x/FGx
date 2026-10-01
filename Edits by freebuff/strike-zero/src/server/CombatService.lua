--[[
	CombatService.lua (ModuleScript -> ServerScriptService/Services)
	Authoritative combat: gun raycasts, damage application, headshots,
	melee combos, gun-butt fallback, hit stun, knockback, block/parry.
	Never trusts client damage or kill claims: clients only report intent
	(aim direction, swing kind); the server computes every outcome.

	Remotes consumed: Melee (from ReplicatedStorage/Remotes)
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)
local CombatConfig = require(ReplicatedStorage.Shared.CombatConfig)

local CombatService = {}

local lastDamaged = {} -- [victim] = {attacker, at, weapon, head}
local lastSwing = {}   -- [player] = {light, heavy, butt}
local comboIndex = {}  -- [player] = number
local blockState = {}  -- [player] = {active, since}

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local MeleeRemote = remotes:WaitForChild("Melee")

-- Helpers --------------------------------------------------------------------
-- Uniform random direction inside a cone of `degrees` around dir.
local function spreadDirection(dir, degrees)
	if degrees <= 0 then
		return dir
	end
	local r = math.rad(degrees)
	local angle = math.random() * 2 * math.pi
	local radius = math.sqrt(math.random()) * r
	local up = math.abs(dir.Y) < 0.99 and Vector3.new(0, 1, 0) or Vector3.new(1, 0, 0)
	local right = dir:Cross(up).Unit
	local fwd = right:Cross(dir)
	local axis = right * math.cos(angle) + fwd * math.sin(angle)
	return (dir * math.cos(radius) + axis * math.sin(radius)).Unit
end

local function knockback(char, dir, force)
	local root = Utility.rootOf(char)
	if root and not root.Anchored then
		local vel = root.AssemblyLinearVelocity
		root.AssemblyLinearVelocity = vel + dir * force
	end
end

-- Temporary movement slow (hit stun). Restores the configured base speed.
local function applyHitStun(humanoid, seconds)
	if not humanoid.Parent or humanoid.Health <= 0 then
		return
	end
	humanoid.WalkSpeed = humanoid.WalkSpeed * CombatConfig.StunSpeedScale
	task.delay(seconds, function()
		if humanoid.Parent and humanoid.Health > 0 then
			local mult = humanoid:GetAttribute("SpeedMult") or 1
			humanoid.WalkSpeed = Config.Movement.walkSpeed * mult
		end
	end)
end

-- Damage pipeline ------------------------------------------------------------
local function applyDamage(attacker, victimPlayer, amount, info)
	if not victimPlayer or not victimPlayer.Parent then
		return false
	end
	local char = victimPlayer.Character
	local hum = char and Utility.humanoidOf(char)
	if not hum or hum.Health <= 0 then
		return false
	end

	-- team gate
	if not Config.Combat.friendlyFire and attacker and not Utility.areEnemies(attacker, victimPlayer) then
		return false
	end

	-- spawn protection: ForceField absorbs the hit, attacker gets feedback
	if char:FindFirstChildOfClass("ForceField") then
		if attacker then
			Utility.notify(attacker, { k = "hit", blocked = true })
		end
		return false
	end

	-- block / parry (melee only)
	if info.melee and attacker then
		local bs = blockState[victimPlayer]
		if bs and bs.active then
			if (os.clock() - bs.since) <= CombatConfig.Block.parryWindow then
				-- just-timed block = parry: negate the hit and stagger the attacker
				local vRoot = Utility.rootOf(char)
				local aChar = attacker.Character
				if aChar then
					local aHum = Utility.humanoidOf(aChar)
					if aHum then
						applyHitStun(aHum, CombatConfig.Block.parryStun)
					end
					if vRoot and aChar then
						local dir = (Utility.rootOf(aChar).Position - vRoot.Position)
						dir = Vector3.new(dir.X, 0, dir.Z)
						if dir.Magnitude > 0.01 then
							knockback(aChar, -dir.Unit, CombatConfig.Block.parryKnockback)
						end
					end
				end
				Utility.notify(victimPlayer, { k = "parry" })
				Utility.notify(attacker, { k = "parried" })
				return false
			end
			amount = amount * (1 - CombatConfig.Block.damageReduction)
		end
	end

	hum:TakeDamage(amount)

	-- hit stun + knockback for melee hits
	if info.melee then
		applyHitStun(hum, info.stun or 0.5)
		if info.dir and info.knockback then
			knockback(char, info.dir, info.knockback)
		end
	end

	local died = hum.Health <= 0
	lastDamaged[victimPlayer] = {
		attacker = attacker,
		at = os.clock(),
		weapon = info.weaponName,
		head = info.head,
	}

	Utility.notify(victimPlayer, { k = "damaged", amount = math.floor(amount + 0.5) })
	if attacker then
		Utility.notify(attacker, {
			k = "hit",
			dmg = math.floor(amount + 0.5),
			head = info.head and true or false,
			killed = died,
		})
	end
	return true
end

-- Guns -----------------------------------------------------------------------
function CombatService.resolveGunshot(shooter, origin, baseDir, def)
	local char = shooter.Character
	if not char then
		return
	end
	if baseDir.Magnitude < 0.001 then
		return
	end
	local dir = baseDir.Unit

	local params = RaycastParams.new()
	params.FilterType = Enum.RaycastFilterType.Exclude
	params.FilterDescendantsInstances = { char }
	params.IgnoreWater = true

	local perVictim = {}
	for _ = 1, def.pellets do
		local shotDir = spreadDirection(dir, def.spread)
		local result = workspace:Raycast(origin, shotDir * def.range, params)
		if result then
			local victimChar = result.Instance.Parent
			local victimPlayer = victimChar and Players:GetPlayerFromCharacter(victimChar)
			local hum = victimPlayer and Utility.humanoidOf(victimChar)
			if hum and hum.Health > 0 then
				local isHead = result.Instance.Name == "Head"
				local dmg = def.damage * (isHead and def.headshot or 1)
				local acc = perVictim[victimPlayer]
				if acc == nil then
					acc = { dmg = 0, head = false }
					perVictim[victimPlayer] = acc
				end
				acc.dmg = acc.dmg + dmg
				acc.head = acc.head or isHead
			end
		end
	end

	for victim, acc in pairs(perVictim) do
		applyDamage(shooter, victim, acc.dmg, {
			weaponName = def.name,
			head = acc.head,
			melee = false,
		})
	end
end

-- Melee ----------------------------------------------------------------------
-- Find the best (nearest, in-cone, unobstructed) enemy in front of the attacker.
local function findMeleeTarget(player, attackerChar, def)
	local head = Utility.characterHead(attackerChar)
	local root = Utility.rootOf(attackerChar)
	if not head or not root then
		return nil, nil
	end
	local origin = head.Position
	local look = root.CFrame.LookVector

	local best, bestDist = nil, def.range
	for _, other in ipairs(Players:GetPlayers()) do
		if other.Character then
			local oChar = other.Character
			local oHum = Utility.humanoidOf(oChar)
			local oHead = Utility.characterHead(oChar)					if oHum and oHum.Health > 0 and oHead and other.Character.Parent
						and Utility.areEnemies(player, other) then
				local delta = oHead.Position - origin
				local dist = delta.Magnitude
				if dist <= def.range and dist > 0.01 then
					local dir = delta.Unit
					if look:Dot(dir) >= def.minDot then
						-- line of sight: nothing solid between us
						local params = RaycastParams.new()
						params.FilterType = Enum.RaycastFilterType.Exclude
						params.FilterDescendantsInstances = { attackerChar, other.Character }
						local blocked = workspace:Raycast(origin, delta, params)
						if not blocked then
							if dist < bestDist then
								best, bestDist = other, dist
							end
						end
					end
				end
			end
		end
	end

	if best then
		local tRoot = Utility.rootOf(best.Character)
		if not tRoot then
			return nil, nil
		end
		local dir = tRoot.Position - origin
		dir = Vector3.new(dir.X, 0, dir.Z)
		if dir.Magnitude > 0.01 then
			dir = dir.Unit
		else
			dir = look
		end
		return best, dir
	end
	return nil, nil
end

local function performSwing(player, def, kindName, damage, combo)
	local char = player.Character
	if not char then
		return
	end
	local target, dir = findMeleeTarget(player, char, def)
	Utility.notify(player, { k = "swing", kind = kindName, combo = combo or 1 })
	if target then
		applyDamage(player, target, damage, {
			weaponName = kindName,
			head = false,
			melee = true,
			stun = def.stun,
			knockback = def.knockback,
			dir = dir,
		})
	end
end

local function handleMelee(player, payload)
	if type(payload) ~= "table" then
		return
	end
	local kind = payload.kind
	local now = os.clock()

	-- anti-spam backstop
	if not Utility.allow(tostring(player.UserId) .. ":melee", 6, 5) then
		return
	end

	local char = player.Character
	local hum = char and Utility.humanoidOf(char)
	if not hum or hum.Health <= 0 then
		return
	end

	if kind == "block" then
		local active = payload.active and true or false
		if active then
			blockState[player] = { active = true, since = now }
		else
			local bs = blockState[player]
			if bs then
				bs.active = false
			end
		end
		Utility.notify(player, { k = "block", active = active })
		return
	end

	local def, damage, combo
	if kind == "light" then
		def = CombatConfig.Light
	elseif kind == "heavy" then
		def = CombatConfig.Heavy
	elseif kind == "gunbutt" then
		def = CombatConfig.GunButt
	else
		return
	end

	local ls = lastSwing[player]
	if ls == nil then
		ls = {}
		lastSwing[player] = ls
	end

	-- gun-butt requires the equipped gun to be at EXACTLY 0 ammunition
	if kind == "gunbutt" then
		local WeaponService = require(script.Parent.WeaponService)
		local mag = WeaponService.getMag(player)
		if mag == nil or mag > 0 then
			return -- not a gun, or gun still has ammo: not a legal butt-strike
		end
	end

	local last = ls[kind] or 0
	if now - last < def.cooldown - CombatConfig.Validate.meleeCooldownTolerance then
		return -- server-enforced swing cooldown
	end
	ls[kind] = now

	if kind == "light" then
		-- chain a follow-up swing if the previous light landed inside the window
		local idx = 1
		if last > 0 and (now - last) <= def.comboWindow then
			idx = (comboIndex[player] or 0) + 1
			if idx > #def.comboDamage then
				idx = 1
			end
		end
		comboIndex[player] = idx
		damage = def.comboDamage[idx]
		combo = idx
	elseif kind == "heavy" then
		damage = def.damage
		combo = 1
	else
		damage = def.damage
		combo = 1
	end

	if kind == "heavy" then
		-- brief windup before the hit resolves (client animates the windup)
		local windup = def.windup
		task.delay(windup, function()
			if player.Parent and player.Character then
				local h = Utility.humanoidOf(player.Character)
				if h and h.Health > 0 then
					performSwing(player, def, "HEAVY", damage, combo)
				end
			end
		end)
	else
		performSwing(player, def, kind == "gunbutt" and "GUNBUTT" or "LIGHT", damage, combo)
	end
end

-- Queries used by other services ---------------------------------------------
function CombatService.getLastAttacker(victim)
	return lastDamaged[victim]
end

function CombatService.isBlocking(player)
	local bs = blockState[player]
	return bs ~= nil and bs.active
end

-- Init ------------------------------------------------------------------------
function CombatService.init()
	MeleeRemote.OnServerEvent:Connect(function(player, payload)
		handleMelee(player, payload)
	end)

	Players.PlayerRemoving:Connect(function(player)
		lastDamaged[player] = nil
		lastSwing[player] = nil
		comboIndex[player] = nil
		blockState[player] = nil
	end)
end

return CombatService
