--[[
	CombatController.lua (ModuleScript -> StarterPlayerScripts/Controllers)
	Melee input: light chain, heavy, block/parry, and the gun-butt fallback
	(WeaponController routes the shoot button here when the mag is empty).
	Client only sends INTENT to the server; damage is decided server-side.
]]

local Players = game:GetService("Players")
local UserInputService = game:GetService("UserInputService")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

local CombatConfig = require(ReplicatedStorage.Shared.CombatConfig)

local CombatController = {}

local hub = nil
local player = Players.LocalPlayer
local MeleeRemote = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Melee")

local lastSent = { light = 0, heavy = 0, butt = 0 }
local blocking = false

local function localGate(kind, cooldown)
	local now = os.clock()
	if now - (lastSent[kind] or 0) < cooldown - CombatConfig.Validate.meleeCooldownTolerance then
		return false
	end
	lastSent[kind] = now
	return true
end

local function requestLight()
	if blocking then
		return
	end
	if localGate("light", CombatConfig.Light.cooldown) then
		MeleeRemote:FireServer({ kind = "light" })
	end
end

local function requestHeavy()
	if blocking then
		return
	end
	if localGate("heavy", CombatConfig.Heavy.cooldown) then
		MeleeRemote:FireServer({ kind = "heavy" })
	end
end

-- Gun-butt: routed here by WeaponController when the equipped mag == 0.
function CombatController.requestGunButt()
	if blocking then
		return
	end
	if localGate("butt", CombatConfig.GunButt.cooldown) then
		MeleeRemote:FireServer({ kind = "gunbutt" })
	end
end

local function setBlock(active)
	if blocking == active then
		return
	end
	blocking = active
	MeleeRemote:FireServer({ kind = "block", active = active })
	hub:emit("blockstate", active)
end

function CombatController.isBlocking()
	return blocking
end

function CombatController.init(h)
	hub = h

	-- WeaponController routes mouse clicks for the knife slot through the hub
	hub:on("req_light", requestLight)
	hub:on("req_heavy", requestHeavy)

	-- server swing acknowledgements drive the combo counter in the HUD
	hub:on("n_swing", function(payload)
		if payload.kind == "LIGHT" or payload.kind == "HEAVY" or payload.kind == "GUNBUTT" then
			hub:emit("combo", { kind = payload.kind, combo = payload.combo or 1 })
		end
	end)

	UserInputService.InputBegan:Connect(function(input, processed)
		if processed then
			return
		end
		if input.KeyCode == Enum.KeyCode.F then
			setBlock(true)
		end
	end)
	UserInputService.InputReleased:Connect(function(input)
		if input.KeyCode == Enum.KeyCode.F then
			setBlock(false)
		end
	end)

	-- never leave a dangling block state after death/respawn
	player.CharacterAdded:Connect(function()
		blocking = false
		hub:emit("blockstate", false)
	end)
end

return CombatController
