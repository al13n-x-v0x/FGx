--[[
	Utility.lua (ModuleScript -> ReplicatedStorage/Shared)
	Small shared helpers: signals, math, team lookups, server rate limiting,
	and placeholder audio playback. No game logic lives here.
]]

local Config = require(script.Parent.Config)

local Utility = {}

-- Math -----------------------------------------------------------------------
function Utility.clamp(v, lo, hi)
	if v < lo then
		return lo
	elseif v > hi then
		return hi
	end
	return v
end

function Utility.lerp(a, b, t)
	return a + (b - a) * t
end

function Utility.formatTime(seconds)
	seconds = math.max(0, math.floor(seconds))
	return string.format("%d:%02d", math.floor(seconds / 60), seconds % 60)
end

-- Signal ---------------------------------------------------------------------
-- Minimal connect/fire signal used to wire services and controllers together.
-- Connections are stored per-signal; callers disconnect on teardown to avoid
-- leaks (the memory-leak rule from the design doc).
local Signal = {}
Signal.__index = Signal

function Utility.newSignal()
	return setmetatable({ _handlers = {} }, Signal)
end

function Signal:Connect(fn)
	local handlers = self._handlers
	handlers[fn] = true
	local conn = {}
	conn.Connected = true
	conn.Disconnect = function()
		conn.Connected = false
		handlers[fn] = nil
	end
	return conn
end

function Signal:Fire(...)
	-- snapshot so handlers can disconnect during fire
	local snapshot = {}
	for fn in pairs(self._handlers) do
		snapshot[#snapshot + 1] = fn
	end
	for i = 1, #snapshot do
		local ok, err = pcall(snapshot[i], ...)
		if not ok then
			warn("[STRIKE//ZERO] signal handler error: " .. tostring(err))
		end
	end
end

-- Event hub (named signals) used by the client bootstrap ---------------------
function Utility.newHub()
	local hub = { _signals = {} }
	function hub:on(name, fn)
		local sig = self._signals[name]
		if sig == nil then
			sig = Utility.newSignal()
			self._signals[name] = sig
		end
		return sig:Connect(fn)
	end
	function hub:emit(name, ...)
		local sig = self._signals[name]
		if sig then
			sig:Fire(...)
		end
	end
	return hub
end

-- Teams ----------------------------------------------------------------------
function Utility.getTeamId(player)
	if player.Team then
		return player.Team.Name
	end
	return nil
end

function Utility.areEnemies(a, b)
	if a == b then
		return false
	end
	local ta, tb = Utility.getTeamId(a), Utility.getTeamId(b)
	if ta == nil or tb == nil then
		return true -- free-for-all fallback (never used in TDM, but safe)
	end
	return ta ~= tb
end

-- Server rate limiting (token bucket, event-driven: no loops) ---------------
local buckets = {}

function Utility.allow(key, rate, burst)
	-- returns true if `key` may perform an action at `rate` events/second,
	-- allowing a short burst of `burst`.
	local now = os.clock()
	local b = buckets[key]
	if b == nil then
		b = { tokens = burst, at = now }
		buckets[key] = b
	end
	local refill = (now - b.at) * rate
	b.tokens = math.min(burst, b.tokens + refill)
	b.at = now
	if b.tokens >= 1 then
		b.tokens = b.tokens - 1
		return true
	end
	return false
end

function Utility.clearRate(key)
	buckets[key] = nil
end

-- Audio ----------------------------------------------------------------------
-- Placeholder hooks: play nothing until ids are configured. Sounds are created
-- locally in SoundService so they never replicate (zero network cost).
local sounds = {}

function Utility.play(category, volume)
	local id = Config.Audio[category]
	if id == nil or id == "" then
		return -- silent placeholder hook
	end
	local SoundService = game:GetService("SoundService")
	local snd = sounds[category]
	if snd == nil then
		snd = Instance.new("Sound")
		snd.Name = "SZ_" .. category
		snd.Looped = false
		snd.Parent = SoundService
		sounds[category] = snd
	end
	snd.SoundId = id
	snd.Volume = volume or 0.5
	snd:Play()
end

-- Remote notification (server only) -------------------------------------------
-- One shared RemoteEvent carries every server->client message, keyed by k=...
-- so we never spawn a flood of separate RemoteEvents.
local notifyRemote

function Utility.notify(player, payload)
	if notifyRemote == nil then
		local ReplicatedStorage = game:GetService("ReplicatedStorage")
		notifyRemote = ReplicatedStorage:WaitForChild("Remotes"):WaitForChild("Notify")
	end
	if player then
		notifyRemote:FireClient(player, payload)
	else
		notifyRemote:FireAllClients(payload)
	end
end

-- Misc -----------------------------------------------------------------------
function Utility.characterHead(character)
	local head = character:FindFirstChild("Head")
	return head
end

function Utility.rootOf(character)
	return character:FindFirstChild("HumanoidRootPart")
end

function Utility.humanoidOf(character)
	return character:FindFirstChildOfClass("Humanoid")
end

return Utility
