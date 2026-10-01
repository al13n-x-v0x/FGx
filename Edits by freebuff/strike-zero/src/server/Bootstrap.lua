--[[
	Bootstrap.lua (Script -> ServerScriptService)
	Single entry point for the server. Services are ModuleScripts so they can
	be required, tested and reasoned about independently; this Script boots
	them in dependency order. Cross-service calls inside services use lazy
	requires to keep the dependency graph acyclic.
]]

local ReplicatedStorage = game:GetService("ReplicatedStorage")

-- wait for the shared tree to exist before anything touches it
ReplicatedStorage:WaitForChild("Shared")
ReplicatedStorage:WaitForChild("Remotes")

local Services = script.Parent:WaitForChild("Services")

local PlayerService = require(Services.PlayerService)
local WeaponService = require(Services.WeaponService)
local CombatService = require(Services.CombatService)
local MatchService = require(Services.MatchService)
local AdminService = require(Services.AdminService)

PlayerService.init()
WeaponService.init()
CombatService.init()
MatchService.init()
AdminService.init()

print("[STRIKE//ZERO] server online - services: Player, Weapon, Combat, Match, Admin")
