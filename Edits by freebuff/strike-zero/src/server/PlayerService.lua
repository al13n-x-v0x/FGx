--[[
	PlayerService.lua (ModuleScript -> ServerScriptService/Services)
	Teams, character setup, spawn points, respawn scheduling, spawn protection.
	All of it is event-driven: no per-frame or polling loops.
]]

local Players = game:GetService("Players")
local Config = require(game:GetService("ReplicatedStorage").Shared.Config)
local Utility = require(game:GetService("ReplicatedStorage").Shared.Utility)

local PlayerService = {}

local spawnCache = nil -- [teamId] = { {part...} }

-- Teams ----------------------------------------------------------------------
local function createTeams()
	for _, def in ipairs(Config.Teams) do
		local team = Instance.new("Team")
		team.Name = def.id
		team.TeamColor = BrickColor.new(def.color)
		team.AutoAssignable = false
		team.Parent = game:GetService("Teams")
	end
end

local function teamCounts()
	local counts = {}
	for _, t in ipairs(Config.Teams) do
		counts[t.id] = 0
	end
	for _, p in ipairs(Players:GetPlayers()) do
		if p.Team and counts[p.Team.Name] then
			counts[p.Team.Name] = counts[p.Team.Name] + 1
		end
	end
	return counts
end

local function pickTeam()
	local counts = teamCounts()
	local best, bestCount = Config.Teams[1].id, math.huge
	for _, t in ipairs(Config.Teams) do
		if counts[t.id] < bestCount then
			best, bestCount = t.id, counts[t.id]
		end
	end
	return game:GetService("Teams"):FindFirstChild(best)
end

-- Spawn points ---------------------------------------------------------------
local function spawnsFor(teamId)
	if spawnCache == nil then
		spawnCache = {}
		local map = workspace:FindFirstChild("StrikeMap")
		if map then
			for _, inst in ipairs(map:GetDescendants()) do
				local team = inst.Name:match("^Spawn_(%u+)_%d+$")
				if team and inst:IsA("BasePart") then
					local list = spawnCache[team]
					if list == nil then
						list = {}
						spawnCache[team] = list
					end
					list[#list + 1] = inst.Position
				end
			end
		end
	end
	return spawnCache[teamId]
end

local function randomSpawnCFrame(teamId)
	local list = spawnsFor(teamId)
	if list and #list > 0 then
		local pos = list[math.random(1, #list)]
		return CFrame.new(pos + Vector3.new(0, 4, 0))
	end
	return CFrame.new(0, 8, 0) -- map fallback
end

-- Spawn protection -----------------------------------------------------------
local function grantSpawnProtection(character)
	local ff = Instance.new("ForceField")
	ff.Parent = character
	task.delay(Config.SpawnForceFieldTime, function()
		if ff.Parent then
			ff:Destroy()
		end
	end)
end

-- Character setup -------------------------------------------------------------
local function onCharacter(player, character)
	local humanoid = character:WaitForChild("Humanoid")
	humanoid.MaxHealth = Config.MaxHealth
	humanoid.Health = Config.MaxHealth
	humanoid.UseJumpPower = true
	humanoid.JumpPower = Config.Movement.jumpPower
	local mult = humanoid:GetAttribute("SpeedMult") or 1
	humanoid.WalkSpeed = Config.Movement.walkSpeed * mult

	-- move the fresh character to a team spawn (event-driven, fires once)
	local teamId = Utility.getTeamId(player)
	if teamId then
		character:PivotTo(randomSpawnCFrame(teamId))
	end
	grantSpawnProtection(character)

	humanoid.Died:Connect(function()
		-- lazy require avoids circular module dependencies
		local MatchService = require(script.Parent.MatchService)
		MatchService.onPlayerDeath(player)
	end)
end

-- Public API -----------------------------------------------------------------
function PlayerService.respawn(player, delaySeconds)
	task.delay(delaySeconds or 0, function()
		if player.Parent and player:FindFirstChild("PlayerGui") ~= nil then
			player:LoadCharacter()
		end
	end)
end

function PlayerService.forceRespawn(player)
	if player.Character then
		local hum = Utility.humanoidOf(player.Character)
		if hum then
			hum.Health = 0
		end
	end
	PlayerService.respawn(player, 0.3)
end

function PlayerService.teleport(player, targetCFrame)
	local char = player.Character
	if char then
		char:PivotTo(targetCFrame)
	end
end

function PlayerService.getTeamSpawn(teamId)
	return randomSpawnCFrame(teamId)
end

-- Init ------------------------------------------------------------------------
function PlayerService.init()
	createTeams()

	local function onPlayer(player)
		local team = pickTeam()
		if team then
			player.Team = team
		end

		-- leaderstats (Roblox player list / scoreboard data)
		local ls = Instance.new("Folder")
		ls.Name = "leaderstats"
		local kills = Instance.new("IntValue")
		kills.Name = "Kills"
		kills.Parent = ls
		local deaths = Instance.new("IntValue")
		deaths.Name = "Deaths"
		deaths.Parent = ls
		ls.Parent = player

		if player.Character then
			onCharacter(player, player.Character)
		end
		player.CharacterAdded:Connect(function(char)
			onCharacter(player, char)
		end)

		-- arm the player instantly so weapons exist before first spawn
		local WeaponService = require(script.Parent.WeaponService)
		WeaponService.setupLoadout(player)
	end

	Players.PlayerAdded:Connect(onPlayer)
	for _, p in ipairs(Players:GetPlayers()) do
		onPlayer(p)
	end

	Players.PlayerRemoving:Connect(function(player)
		Utility.clearRate(tostring(player.UserId) .. ":fire")
		Utility.clearRate(tostring(player.UserId) .. ":melee")
	end)
end

return PlayerService
