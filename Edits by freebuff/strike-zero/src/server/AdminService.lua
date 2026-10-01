--[[
	AdminService.lua (ModuleScript -> ServerScriptService/Services)
	Chat-driven admin commands. Permission is checked SERVER-SIDE on every
	command; the client is never asked "are you admin?". Normal players get
	silently ignored - their chat commands do nothing.

	Commands:
	  !giveweapon <ar|smg|shotgun|pistol|knife> [player]
	  !speed <multiplier> [player]     !heal [player]
	  !gravity <number>                !lowgravity
	  !teleport <player> [target]      !announcement <text...>
	  !freeze <player>                 !respawn <player>
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)

local AdminService = {}

-- Server-side permission gate -------------------------------------------------
local function isAdmin(player)
	-- Studio = developer environment
	if game:GetService("RunService"):IsStudio() then
		return true
	end
	-- configured admins
	if Config.Admins[player.UserId] then
		return true
	end
	-- private server owner
	if game.PrivateServerId ~= "" and game.PrivateServerOwnerId == player.UserId then
		return true
	end
	return false
end

local function findPlayer(name)
	name = string.lower(name or "")
	for _, p in ipairs(Players:GetPlayers()) do
		if string.find(string.lower(p.Name), name, 1, true) == 1 then
			return p
		end
	end
	return nil
end

local function resolve(msg, index, fallback)
	local target = msg[index] and findPlayer(msg[index])
	return target or fallback
end

-- Command handlers ------------------------------------------------------------
local handlers = {}

handlers.giveweapon = function(admin, msg)
	local wid = msg[2]
	if wid == nil then
		return
	end
	local target = resolve(msg, 3, admin)
	local WeaponService = require(script.Parent.WeaponService)
	WeaponService.give(target, wid)
end

handlers.speed = function(admin, msg)
	local mult = tonumber(msg[2])
	if not mult then
		return
	end
	mult = Utility.clamp(mult, 0.1, 10)
	local target = resolve(msg, 3, admin)
	local hum = target.Character and Utility.humanoidOf(target.Character)
	if hum then
		hum:SetAttribute("SpeedMult", mult)
		hum.WalkSpeed = Config.Movement.walkSpeed * mult
	end
end

handlers.heal = function(admin, msg)
	local target = resolve(msg, 2, admin)
	local hum = target.Character and Utility.humanoidOf(target.Character)
	if hum then
		hum.Health = hum.MaxHealth
	end
end

handlers.gravity = function(_, msg)
	local g = tonumber(msg[2])
	if g then
		workspace.Gravity = Utility.clamp(g, 1, 500)
	end
end

handlers.lowgravity = function()
	workspace.Gravity = 45
	Utility.notify(nil, { k = "announce", text = "LOW GRAVITY" })
end

handlers.teleport = function(admin, msg)
	local target = resolve(msg, 2, admin)
	local destName = msg[3] and findPlayer(msg[3])
	if target and destName and destName.Character then
		local root = Utility.rootOf(destName.Character)
		if root then
			local PlayerService = require(script.Parent.PlayerService)
			PlayerService.teleport(target, root.CFrame * CFrame.new(0, 0, -6))
		end
	end
end

handlers.announcement = function(_, msg)
	local text = table.concat(msg, " ", 2)
	if text ~= "" then
		Utility.notify(nil, { k = "announce", text = string.upper(text) })
	end
end

handlers.freeze = function(admin, msg)
	local target = resolve(msg, 2, admin)
	local root = target.Character and Utility.rootOf(target.Character)
	if root then
		root.Anchored = not root.Anchored
		Utility.notify(admin, { k = "feed", text = (root.Anchored and "FROZEN: " or "UNFROZEN: ") .. target.Name })
	end
end

handlers.respawn = function(admin, msg)
	local target = resolve(msg, 2, admin)
	local PlayerService = require(script.Parent.PlayerService)
	PlayerService.forceRespawn(target)
end

-- Init ------------------------------------------------------------------------
function AdminService.init()
	Players.PlayerAdded:Connect(function(player)
		player.Chatted:Connect(function(message)
			if string.sub(message, 1, 1) ~= "!" then
				return
			end
			-- permission check happens HERE, server-side, before any parsing
			if not isAdmin(player) then
				return
			end
			local msg = {}
			for word in string.gmatch(message, "%S+") do
				msg[#msg + 1] = word
			end
			local name = string.lower(string.sub(msg[1], 2))
			local handler = handlers[name]
			if handler then
				local ok, err = pcall(handler, player, msg)
				if not ok then
					warn("[STRIKE//ZERO] admin command error: " .. tostring(err))
				end
			end
		end)
	end)
end

return AdminService
