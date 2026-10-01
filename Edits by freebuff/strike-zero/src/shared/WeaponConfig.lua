--[[
	WeaponConfig.lua (ModuleScript -> ReplicatedStorage/Shared)
	Modular weapon framework. To add a weapon: add an entry to Weapons with
	the same shape and (optionally) a viewmodel blueprint. No other file needs
	to change for a new gun to be droppable via !giveweapon.
]]

local WeaponConfig = {}

-- Viewmodel blueprints -------------------------------------------------------
-- Camera-space parts: size = {x,y,z}, color = {r,g,b}, offset = {x,y,z}
-- Offsets are relative to the viewmodel root (right, down, forward).
local function gunBody(barrelColor)
	return {
		{ size = { 0.35, 0.5, 1.5 }, color = { 45, 45, 50 }, offset = { 0.42, -0.42, -1.1 } },   -- receiver
		{ size = { 0.16, 0.16, 1.1 }, color = barrelColor, offset = { 0.42, -0.34, -2.1 } },    -- barrel
		{ size = { 0.26, 0.55, 0.32 }, color = { 35, 35, 40 }, offset = { 0.42, -0.78, -0.85 } },-- grip/mag
		{ size = { 0.1, 0.14, 0.3 }, color = { 200, 200, 205 }, offset = { 0.42, -0.13, -1.35 } },-- sight
	}
end

WeaponConfig.Weapons = {
	-- Slot 1: assault rifle ---------------------------------------------------
	ar = {
		id = "ar",
		name = "VK-7 RIFLE",
		slot = 1,
		kind = "gun",
		damage = 24,
		fireRate = 0.1,      -- seconds between shots (600 RPM)
		mag = 30,
		reserve = 90,
		reloadTime = 2.2,
		auto = true,
		recoilUp = 1.15,     -- degrees of camera kick per shot
		recoilSide = 0.4,
		spread = 0.9,        -- degrees
		range = 320,
		headshot = 2.0,
		pellets = 1,
		muzzle = { color = { 255, 200, 90 }, size = 0.28, time = 0.05 },
		viewmodel = gunBody({ 90, 95, 100 }),
	},

	-- Slot 1: SMG -------------------------------------------------------------
	smg = {
		id = "smg",
		name="WASP SMG",
		slot = 1,
		kind = "gun",
		damage = 17,
		fireRate = 0.075,    -- 800 RPM
		mag = 25,
		reserve = 100,
		reloadTime = 1.8,
		auto = true,
		recoilUp = 0.75,
		recoilSide = 0.55,
		spread = 1.5,
		range = 150,
		headshot = 1.8,
		pellets = 1,
		muzzle = { color = { 255, 190, 80 }, size = 0.22, time = 0.04 },
		viewmodel = gunBody({ 70, 72, 78 }),
	},

	-- Slot 1: shotgun ---------------------------------------------------------
	shotgun = {
		id = "shotgun",
		name = "BREAKER-8",
		slot = 1,
		kind = "gun",
		damage = 11,         -- per pellet
		fireRate = 0.85,
		mag = 6,
		reserve = 24,
		reloadTime = 2.8,
		auto = false,
		recoilUp = 3.2,
		recoilSide = 0.9,
		spread = 4.0,        -- degrees, applied per pellet
		range = 70,
		headshot = 1.5,
		pellets = 8,
		muzzle = { color = { 255, 170, 60 }, size = 0.4, time = 0.07 },
		viewmodel = gunBody({ 120, 80, 50 }),
	},

	-- Slot 2: secondary -------------------------------------------------------
	pistol = {
		id = "pistol",
		name = "M1 SIDEARM",
		slot = 2,
		kind = "gun",
		damage = 26,
		fireRate = 0.18,
		mag = 12,
		reserve = 48,
		reloadTime = 1.5,
		auto = false,
		recoilUp = 1.6,
		recoilSide = 0.3,
		spread = 1.0,
		range = 160,
		headshot = 2.0,
		pellets = 1,
		muzzle = { color = { 255, 210, 110 }, size = 0.2, time = 0.04 },
		viewmodel = {
			{ size = { 0.3, 0.42, 0.8 }, color = { 50, 50, 55 }, offset = { 0.42, -0.45, -0.85 } },
			{ size = { 0.13, 0.13, 0.55 }, color = { 110, 110, 118 }, offset = { 0.42, -0.36, -1.4 } },
			{ size = { 0.24, 0.5, 0.3 }, color = { 35, 35, 40 }, offset = { 0.42, -0.8, -0.65 } },
		},
	},

	-- Slot 3: melee -----------------------------------------------------------
	knife = {
		id = "knife",
		name = "TANTO",
		slot = 3,
		kind = "melee",
		viewmodel = {
			{ size = { 0.1, 0.1, 1.0 }, color = { 210, 214, 220 }, offset = { 0.45, -0.5, -1.15 } }, -- blade
			{ size = { 0.14, 0.14, 0.4 }, color = { 40, 40, 45 }, offset = { 0.45, -0.5, -0.5 } },   -- grip
		},
	},
}

-- Default loadout ------------------------------------------------------------
WeaponConfig.Loadout = { "ar", "pistol", "knife" }

-- Teammate-safe aliases: what !giveweapon accepts ----------------------------
WeaponConfig.ById = WeaponConfig.Weapons

function WeaponConfig.get(id)
	return WeaponConfig.Weapons[id]
end

-- Resolve a slot number to a weapon id (nil if empty slot) -------------------
function WeaponConfig.slotWeapon(loadout, slot)
	return loadout[slot]
end

return WeaponConfig
