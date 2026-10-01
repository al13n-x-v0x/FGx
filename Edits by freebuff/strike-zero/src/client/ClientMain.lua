--[[
	ClientMain.lua (LocalScript -> StarterPlayer/StarterPlayerScripts)
	Client entry point. Wires the shared event hub, routes the single server
	Notify remote onto the hub, and boots the four controllers in order.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

ReplicatedStorage:WaitForChild("Shared")
local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)

local player = Players.LocalPlayer

-- First-person is the primary gameplay: lock the camera.
player.CameraMode = Enum.CameraMode.LockFirstPerson

-- Shared event hub: controllers talk through this instead of referencing
-- each other directly (loose coupling, no leaky references).
local hub = Utility.newHub()

local Controllers = script.Parent:WaitForChild("Controllers")
local UIController = require(Controllers.UIController)
local MovementController = require(Controllers.MovementController)
local WeaponController = require(Controllers.WeaponController)
local CombatController = require(Controllers.CombatController)

-- Route server messages ------------------------------------------------------
local Remotes = ReplicatedStorage:WaitForChild("Remotes")
local Notify = Remotes:WaitForChild("Notify")

Notify.OnClientEvent:Connect(function(payload)
	if type(payload) ~= "table" or type(payload.k) ~= "string" then
		return
	end
	hub:emit("notify", payload)
	hub:emit("n_" .. payload.k, payload) -- typed channel, e.g. "n_kill"
end)

-- Boot controllers ------------------------------------------------------------
UIController.init(hub)
WeaponController.init(hub)
CombatController.init(hub)
MovementController.init(hub)

print("[STRIKE//ZERO] client online - v" .. Config.Version)
