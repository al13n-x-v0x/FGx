--[[
	CombatConfig.lua (ModuleScript -> ReplicatedStorage/Shared)
	Melee combo tuning, block/parry rules and server validation tolerances.
	Numbers are deliberately small and readable: tune fights here.
]]

local CombatConfig = {}

-- Melee attacks --------------------------------------------------------------
-- comboDamage: damage per chain index for light attacks (3-hit chain).
CombatConfig.Light = {
	cooldown = 0.34,      -- seconds between light swings
	comboWindow = 0.7,    -- land the next swing inside this window to chain
	comboDamage = { 20, 20, 32 }, -- third hit finishes harder
	range = 8,
	minDot = 0.45,        -- target must be roughly in front (directional attacks)
	stun = 0.5,           -- seconds of slowed movement on the victim
	knockback = 26,
	hitStunDamageScale = 1.0,
}

CombatConfig.Heavy = {
	cooldown = 0.9,
	windup = 0.28,        -- brief delay before the hit resolves (client animates it)
	range = 8.5,
	minDot = 0.4,
	damage = 45,
	stun = 0.9,
	knockback = 62,
}

-- Gun-butt: available only when the equipped gun has EXACTLY 0 in the mag.
CombatConfig.GunButt = {
	cooldown = 0.6,
	range = 7.5,
	minDot = 0.4,
	damage = 30,
	stun = 0.6,
	knockback = 55,
}

-- Block / parry --------------------------------------------------------------
CombatConfig.Block = {
	damageReduction = 0.75, -- blocked melee takes 25% damage
	parryWindow = 0.22,      -- blocking this soon after the enemy swing starts = parry
	parryStun = 1.4,         -- attacker is staggered this long
	parryKnockback = 40,
}

-- Server-side validation tolerances -----------------------------------------
CombatConfig.Validate = {
	fireRateTolerance = 0.06,  -- extra seconds allowed on top of weapon fireRate (network jitter)
	meleeCooldownTolerance = 0.1,
	maxMeleeTargetsPerSwing = 1,
	reloadTolerance = 0.1,
}

-- Hit stun applies a temporary WalkSpeed multiplier to the victim.
CombatConfig.StunSpeedScale = 0.45

return CombatConfig
