--[[
	WeaponService.lua (ModuleScript -> ServerScriptService/Services)
	Server-authoritative weapons: ammunition, fire rate, reload timing,
	equipped slot, loadout. Damage is handed to CombatService; this file never
	trusts a client's ammo or timing claims.

	Remotes consumed: Fire, Reload, Switch  (from ReplicatedStorage/Remotes)
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)
local WeaponConfig = require(ReplicatedStorage.Shared.WeaponConfig)
local CombatConfig = require(ReplicatedStorage.Shared.CombatConfig)

local WeaponService = {}

local states = {} -- [player] = { loadout, slot, ammo, reloading, lastFire }

local remotes = ReplicatedStorage:WaitForChild("Remotes")
local FireRemote = remotes:WaitForChild("Fire")
local ReloadRemote = remotes:WaitForChild("Reload")
local SwitchRemote = remotes:WaitForChild("Switch")

local function sendState(player)
	local st = states[player]
	if not st then
		return
	end
	local wid = st.loadout[st.slot]
	local ammo = wid and st.ammo[wid]
	Utility.notify(player, {
		k = "state",
		slot = st.slot,
		wid = wid,
		mag = ammo and ammo.mag or 0,
		reserve = ammo and ammo.reserve or 0,
	})
end

local function resetAmmo(player)
	local st = states[player]
	if not st then
		return
	end
	for wid, def in pairs(WeaponConfig.Weapons) do
		if def.kind == "gun" then
			local owned = false
			for i = 1, 3 do
				if st.loadout[i] == wid then
					owned = true
				end
			end
			if owned then
				st.ammo[wid] = { mag = def.mag, reserve = def.reserve }
			end
		end
	end
	st.reloading = false
	st.slot = 1
end

function WeaponService.setupLoadout(player)
	if states[player] then
		return
	end
	local st = {
		loadout = {},
		ammo = {},
		slot = 1,
		reloading = false,
		lastFire = 0,
	}
	for i, wid in ipairs(WeaponConfig.Loadout) do
		st.loadout[i] = wid
	end
	for wid, def in pairs(WeaponConfig.Weapons) do
		if def.kind == "gun" then
			st.ammo[wid] = { mag = def.mag, reserve = def.reserve }
		end
	end
	states[player] = st

	-- fresh life = full ammo (event-driven, no loops)
	player.CharacterAdded:Connect(function()
		resetAmmo(player)
		task.defer(sendState, player)
	end)
	task.defer(sendState, player)
end

-- Admin/other services -------------------------------------------------------
function WeaponService.give(player, weaponId)
	local st = states[player]
	local def = WeaponConfig.get(weaponId)
	if not st or not def then
		return false
	end
	if def.kind == "gun" then
		st.loadout[def.slot] = weaponId
		st.ammo[weaponId] = { mag = def.mag, reserve = def.reserve }
	elseif def.kind == "melee" then
		st.loadout[3] = weaponId
	end
	Utility.notify(player, { k = "feed", text = "GIVEN: " .. def.name })
	sendState(player)
	return true
end

function WeaponService.getMag(player)
	local st = states[player]
	if not st then
		return nil
	end
	local wid = st.loadout[st.slot]
	local def = wid and WeaponConfig.get(wid)
	if not def or def.kind ~= "gun" then
		return nil
	end
	return st.ammo[wid].mag
end

function WeaponService.isReloading(player)
	local st = states[player]
	return st ~= nil and st.reloading
end

function WeaponService.getEquipped(player)
	local st = states[player]
	if not st then
		return nil
	end
	return st.loadout[st.slot], st
end

-- Fire -----------------------------------------------------------------------
local function handleFire(player, origin, direction)
	local st = states[player]
	if not st or st.reloading then
		return
	end
	local wid = st.loadout[st.slot]
	local def = wid and WeaponConfig.get(wid)
	if not def or def.kind ~= "gun" then
		return
	end

	local ammo = st.ammo[wid]
	if ammo.mag <= 0 then
		-- client should have sent a gun-butt instead; resync it
		sendState(player)
		return
	end

	-- server-side fire rate validation
	local now = os.clock()
	if now - st.lastFire < def.fireRate - CombatConfig.Validate.fireRateTolerance then
		return -- drop silently: client over-fired
	end

	-- rate limiter backstop against remote spam
	local uid = tostring(player.UserId)
	if not Utility.allow(uid .. ":fire", 1 / def.fireRate + 2, 8) then
		return
	end

	-- origin sanity: must originate near this player's head (anti-teleport aim)
	local char = player.Character
	local head = char and Utility.characterHead(char)
	if not head then
		return
	end
	if (Vector3.new(origin.x, origin.y, origin.z) - head.Position).Magnitude > Config.Combat.maxShotOriginDistance then
		return
	end

	-- direction sanity: roughly forward of the body
	local root = Utility.rootOf(char)
	if root then
		local flat = Vector3.new(direction.x, 0, direction.z)
		if flat.Magnitude > 0.001 and root.CFrame.LookVector:Dot(flat.Unit) < Config.Combat.minShotDot then
			return
		end
	end

	st.lastFire = now
	ammo.mag = ammo.mag - 1

	-- resolve hits server-side (authoritative raycast + damage)
	local CombatService = require(script.Parent.CombatService)
	CombatService.resolveGunshot(player, Vector3.new(origin.x, origin.y, origin.z), Vector3.new(direction.x, direction.y, direction.z), def)
end

-- Reload ---------------------------------------------------------------------
local function handleReload(player)
	local st = states[player]
	if not st or st.reloading then
		return
	end
	local wid = st.loadout[st.slot]
	local def = wid and WeaponConfig.get(wid)
	if not def or def.kind ~= "gun" then
		return
	end
	local ammo = st.ammo[wid]
	if ammo.mag >= def.mag or ammo.reserve <= 0 then
		return
	end
	st.reloading = true
	Utility.notify(player, { k = "reloadstart", wid = wid, time = def.reloadTime })

	task.delay(def.reloadTime + CombatConfig.Validate.reloadTolerance, function()
		if not states[player] then
			return
		end
		-- reload completes only if still holding the same gun and still alive
		local currentWid = st.loadout[st.slot]
		if currentWid == wid and player.Character then
			local needed = def.mag - ammo.mag
			local take = math.min(needed, ammo.reserve)
			ammo.mag = ammo.mag + take
			ammo.reserve = ammo.reserve - take
		end
		st.reloading = false
		if player.Parent then
			sendState(player)
		end
	end)
end

-- Switch ---------------------------------------------------------------------
local function handleSwitch(player, slot)
	local st = states[player]
	if not st then
		return
	end
	slot = math.floor(tonumber(slot) or 0)
	if slot < 1 or slot > 3 then
		return
	end
	local wid = st.loadout[slot]
	if wid == nil or wid == st.loadout[st.slot] then
		return
	end
	st.slot = slot
	st.reloading = false -- switching cancels a reload (classic feel)
	sendState(player)
end

function WeaponService.init()
	Players.PlayerAdded:Connect(function(player)
		WeaponService.setupLoadout(player)
	end)
	Players.PlayerRemoving:Connect(function(player)
		states[player] = nil
	end)

	FireRemote.OnServerEvent:Connect(function(player, origin, direction)
		if type(origin) ~= "table" and typeof(origin) ~= "Vector3" then
			return
		end
		if type(direction) ~= "table" and typeof(direction) ~= "Vector3" then
			return
		end
		handleFire(player, origin, direction)
	end)

	ReloadRemote.OnServerEvent:Connect(function(player)
		handleReload(player)
	end)

	SwitchRemote.OnServerEvent:Connect(function(player, slot)
		handleSwitch(player, slot)
	end)
end

return WeaponService
