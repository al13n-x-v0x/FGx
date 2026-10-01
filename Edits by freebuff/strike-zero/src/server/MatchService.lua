--[[
	MatchService.lua (ModuleScript -> ServerScriptService/Services)
	Team Deathmatch: scores, match timer, kill feed, streaks, win detection,
	match-end screen and automatic next-round transition.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)

local MatchService = {}

local scores = {} -- [teamId] = number
local streaks = {} -- [player] = number
local phase = "live" -- "live" | "over"
local remaining = Config.Match.timeLimit
local killFeed = {} -- keep last N entries so late joiners can be caught up

local function scoreOf(teamId)
	return scores[teamId] or 0
end

local function broadcastScores()
	Utility.notify(nil, {
		k = "scores",
		blaze = scoreOf("BLAZE"),
		frost = scoreOf("FROST"),
		limit = Config.Match.scoreLimit,
		phase = phase,
	})
end

local function leaderstat(player, name)
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		return ls:FindFirstChild(name)
	end
	return nil
end

local function winnerOf()
	local b, f = scoreOf("BLAZE"), scoreOf("FROST")
	if b > f then
		return "BLAZE"
	elseif f > b then
		return "FROST"
	end
	return "DRAW"
end

local function endMatch()
	if phase == "over" then
		return
	end
	phase = "over"
	local winner = winnerOf()
	Utility.notify(nil, {
		k = "matchend",
		winner = winner,
		blaze = scoreOf("BLAZE"),
		frost = scoreOf("FROST"),
	})
	Utility.notify(nil, { k = "announce", text = winner .. " WINS THE ROUND" })

	-- automatic next-round transition
	task.delay(Config.Match.intermission, function()
		scores = { BLAZE = 0, FROST = 0 }
		streaks = {}
		remaining = Config.Match.timeLimit
		phase = "live"
		broadcastScores()
		Utility.notify(nil, { k = "timer", t = remaining })
		Utility.notify(nil, { k = "announce", text = "NEW ROUND - GO!" })
		-- fresh life for everyone
		local PlayerService = require(script.Parent.PlayerService)
		for _, p in ipairs(Players:GetPlayers()) do
			PlayerService.forceRespawn(p)
		end
	end)
end

local function checkWin()
	if scoreOf("BLAZE") >= Config.Match.scoreLimit or scoreOf("FROST") >= Config.Match.scoreLimit then
		endMatch()
	end
end

-- Kill pipeline --------------------------------------------------------------
function MatchService.registerKill(killer, victim, weaponName, headshot)
	-- scoring (suicides / falls: killer == nil)
	if killer and killer ~= victim and Utility.areEnemies(killer, victim) then
		local team = Utility.getTeamId(killer)
		if team then
			scores[team] = scoreOf(team) + 1
		end
		local k = leaderstat(killer, "Kills")
		if k then
			k.Value = k.Value + 1
		end
		local streak = (streaks[killer] or 0) + 1
		streaks[killer] = streak
		if streak >= 3 then
			Utility.notify(killer, { k = "streak", n = streak })
		end
	end
	if victim then
		streaks[victim] = 0
		local d = leaderstat(victim, "Deaths")
		if d then
			d.Value = d.Value + 1
		end
	end

	local entry = {
		k = "kill",
		killer = killer and killer.Name or "",
		victim = victim and victim.Name or "",
		weapon = weaponName or "",
		head = headshot and true or false,
		team = killer and Utility.getTeamId(killer) or "",
	}
	killFeed[#killFeed + 1] = entry
	if #killFeed > 8 then
		table.remove(killFeed, 1)
	end
	Utility.notify(nil, entry)
	broadcastScores()
	checkWin()
end

function MatchService.onPlayerDeath(victim)
	-- attribute the kill using recent damage info
	local CombatService = require(script.Parent.CombatService)
	local last = CombatService.getLastAttacker(victim)
	local killer, weapon, head = nil, "FALL", false
	if last and (os.clock() - last.at) < 5 then
		killer = last.attacker
		weapon = last.weapon
		head = last.head
	end
	MatchService.registerKill(killer, victim, weapon, head)

	local PlayerService = require(script.Parent.PlayerService)
	PlayerService.respawn(victim, Config.Match.respawnDelay)
end

function MatchService.getSpectatorFeed()
	return killFeed
end

-- Init ------------------------------------------------------------------------
function MatchService.init()
	scores = { BLAZE = 0, FROST = 0 }
	remaining = Config.Match.timeLimit
	phase = "live"

	-- 1 Hz match clock: the only periodic server loop in the game.
	task.spawn(function()
		while true do
			task.wait(1)
			if #Players:GetPlayers() > 0 then
				if phase == "live" then
					remaining = remaining - 1
					Utility.notify(nil, { k = "timer", t = remaining })
					if remaining <= 0 then
						endMatch()
					end
				end
			end
		end
	end)

	-- catch up late joiners when they arrive
	Players.PlayerAdded:Connect(function(player)
		task.delay(1, function()
			if player.Parent then
				Utility.notify(player, { k = "scores", blaze = scoreOf("BLAZE"), frost = scoreOf("FROST"), limit = Config.Match.scoreLimit, phase = phase })
				Utility.notify(player, { k = "timer", t = remaining })
				for _, entry in ipairs(killFeed) do
					Utility.notify(player, entry)
				end
			end
		end)
	end)
end

return MatchService
