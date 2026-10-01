--[[
	Config.lua (ModuleScript -> ReplicatedStorage/Shared)
	Central configuration for STRIKE//ZERO. Everything designers are expected
	to tweak lives here or in WeaponConfig / CombatConfig.
]]

local Config = {}

Config.GameName = "STRIKE//ZERO"
Config.Version = "0.1.0"

-- Teams ----------------------------------------------------------------------
-- Teams are created server-side by PlayerService using these definitions.
Config.Teams = {
	{ id = "BLAZE", color = "Bright orange" },
	{ id = "FROST", color = "Bright blue" },
}

-- Player ---------------------------------------------------------------------
Config.MaxHealth = 100
Config.SpawnForceFieldTime = 3 -- seconds of spawn protection

-- Movement (simulated on the owning client; server only sets base values) ----
Config.Movement = {
	walkSpeed = 16,
	sprintSpeed = 25,
	sprintFovBoost = 8,
	sprintFovTime = 0.15,
	slideBurstSpeed = 34,
	slideSpeed = 12,
	slideDuration = 0.9,
	slideCooldown = 0.8,
	slideMinSpeed = 20, -- must be sprinting this fast to slide
	jumpPower = 50,
	crouchCameraOffset = 1.9, -- studs the camera drops while sliding
}

-- Match (Team Deathmatch) -----------------------------------------------------
Config.Match = {
	scoreLimit = 30,
	timeLimit = 300, -- seconds
	respawnDelay = 4,
	intermission = 6, -- seconds between matches
	minPlayers = 1,
}

-- Combat --------------------------------------------------------------------
Config.Combat = {
	friendlyFire = false,
	maxShotOriginDistance = 10, -- server rejects fire origins farther than this from the head
	minShotDot = -0.5, -- shots must be roughly forward of the body
	hitConfirmCooldown = 0.05,
}

-- Admin ----------------------------------------------------------------------
-- Add your Roblox UserId here, e.g. Admins = { [1234567] = true }
-- Private-server owners are always allowed. In Studio, everyone is allowed.
Config.Admins = {}

-- Audio placeholders ---------------------------------------------------------
-- Drop in your own asset ids (rbxassetid://...). Empty string = silent hook.
-- Categories are kept separate so sounds can be swapped independently.
Config.Audio = {
	gunshot = "",
	reload = "",
	hit = "",
	kill = "",
	melee = "",
	slide = "",
	ui = "",
	footstep = "",
}

-- Graphics presets (applied client-side by UIController) ---------------------
Config.Graphics = {
	LOW = {
		shadows = false,
		postEffects = false,
		mapMaterials = false, -- flatten map materials locally (fewer texture samples)
		fogEnd = 1200,
		fovBoost = 0,
	},
	MEDIUM = {
		shadows = false,
		postEffects = false,
		mapMaterials = true,
		fogEnd = 100000,
		fovBoost = 0,
	},
	HIGH = {
		shadows = true,
		postEffects = true,
		mapMaterials = true,
		fogEnd = 100000,
		fovBoost = 0,
	},
}
Config.DefaultGraphics = "LOW"

return Config
