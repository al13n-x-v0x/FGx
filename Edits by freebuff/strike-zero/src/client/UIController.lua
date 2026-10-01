--[[
	UIController.lua (ModuleScript -> StarterPlayerScripts/Controllers)
	Runtime-built competitive HUD: crosshair, health, ammo, scores, timer,
	kill feed, hit markers, damage feedback, streaks, match-end screen and
	the LOW/MEDIUM/HIGH graphics preset switcher. Everything is event-driven:
	this file contains no RunService loops and never polls.
]]

local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local TweenService = game:GetService("TweenService")
local Lighting = game:GetService("Lighting")

local Config = require(ReplicatedStorage.Shared.Config)
local Utility = require(ReplicatedStorage.Shared.Utility)
local WeaponConfig = require(ReplicatedStorage.Shared.WeaponConfig)

local UIController = {}

local hub = nil
local player = Players.LocalPlayer

local COLORS = {
	blade = Color3.fromRGB(255, 140, 50),
	frost = Color3.fromRGB(70, 160, 255),
	panel = Color3.fromRGB(18, 20, 26),
	text = Color3.fromRGB(235, 238, 245),
	dim = Color3.fromRGB(150, 156, 168),
	accent = Color3.fromRGB(120, 255, 170),
	danger = Color3.fromRGB(255, 80, 80),
}

local gui, refs = nil, {}

-- Construction helpers -------------------------------------------------------
local function mk(class, props, parent)
	local inst = Instance.new(class)
	for k, v in pairs(props) do
		inst[k] = v
	end
	inst.Parent = parent
	return inst
end

local function panel(name, size, pos, parent)
	local f = mk("Frame", {
		Name = name,
		Size = size,
		Position = pos,
		BackgroundColor3 = COLORS.panel,
		BackgroundTransparency = 0.25,
		BorderSizePixel = 0,
	}, parent)
	mk("UICorner", { CornerRadius = UDim.new(0, 8) }, f)
	return f
end

local function label(props, parent)
	props.BorderSizePixel = 0
	props.BackgroundTransparency = props.BackgroundTransparency or 1
	props.Font = props.Font or Enum.Font.GothamBold
	props.TextColor3 = props.TextColor3 or COLORS.text
	return mk("TextLabel", props, parent)
end

local function buildHUD()
	gui = mk("ScreenGui", {
		Name = "SZ_HUD",
		ResetOnSpawn = false,
		IgnoreGuiInset = true,
		ZIndexBehavior = Enum.ZIndexBehavior.Sibling,
	}, player:WaitForChild("PlayerGui"))

	-- crosshair (4 lines + center dot) --------------------------------------
	local cross = mk("Frame", {
		Name = "Crosshair",
		Size = UDim2.fromOffset(0, 0),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		BackgroundTransparency = 1,
	}, gui)
	refs.cross = {}
	for i = 1, 4 do
		refs.cross[i] = mk("Frame", {
			BackgroundColor3 = COLORS.text,
			BorderSizePixel = 0,
			Size = UDim2.fromOffset(2, 8),
			AnchorPoint = Vector2.new(0.5, 0.5),
		}, cross)
	end
	refs.crossDot = mk("Frame", {
		BackgroundColor3 = COLORS.text,
		BorderSizePixel = 0,
		Size = UDim2.fromOffset(3, 3),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Parent = cross,
	}, cross)

	-- hitmarker + damage numbers --------------------------------------------
	refs.hitmarker = label({
		Name = "Hitmarker",
		Size = UDim2.fromOffset(60, 60),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.5),
		Text = "x",
		TextSize = 30,
		TextTransparency = 1,
	}, gui)

	refs.dmgLabels = {}
	for i = 1, 3 do
		refs.dmgLabels[i] = label({
			Name = "Dmg" .. i,
			Size = UDim2.fromOffset(120, 30),
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromScale(0.5, 0.45),
			Text = "",
			TextSize = 20,
			TextTransparency = 1,
		}, gui)
	end

	-- damage vignette --------------------------------------------------------
	refs.flash = mk("Frame", {
		Name = "DamageFlash",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.fromRGB(200, 20, 20),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		ZIndex = 0,
	}, gui)

	-- health (bottom-left) ---------------------------------------------------
	local health = panel("Health", UDim2.fromOffset(260, 54), UDim2.new(0, 16, 1, -70), gui)
	refs.healthText = label({
		Size = UDim2.new(1, -20, 0, 22),
		Position = UDim2.fromOffset(12, 4),
		Text = "100",
		TextSize = 20,
		TextXAlignment = Enum.TextXAlignment.Left,
	}, health)
	refs.healthBarBG = mk("Frame", {
		Size = UDim2.new(1, -24, 0, 12),
		Position = UDim2.fromOffset(12, 32),
		BackgroundColor3 = Color3.fromRGB(40, 44, 52),
		BorderSizePixel = 0,
	}, health)
	mk("UICorner", { CornerRadius = UDim.new(0, 6) }, refs.healthBarBG)
	refs.healthBar = mk("Frame", {
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = COLORS.accent,
		BorderSizePixel = 0,
	}, refs.healthBarBG)
	mk("UICorner", { CornerRadius = UDim.new(0, 6) }, refs.healthBar)

	-- ammo (bottom-right) ----------------------------------------------------
	local ammo = panel("Ammo", UDim2.fromOffset(240, 78), UDim2.new(1, -256, 1, -94), gui)
	refs.weaponName = label({
		Size = UDim2.new(1, -20, 0, 20),
		Position = UDim2.fromOffset(12, 6),
		Text = "VK-7 RIFLE",
		TextSize = 15,
		TextColor3 = COLORS.dim,
		TextXAlignment = Enum.TextXAlignment.Right,
	}, ammo)
	refs.ammoText = label({
		Size = UDim2.new(1, -20, 0, 34),
		Position = UDim2.fromOffset(12, 26),
		Text = "30 / 90",
		TextSize = 30,
		TextXAlignment = Enum.TextXAlignment.Right,
	}, ammo)
	refs.slots = {}
	for i = 1, 3 do
		refs.slots[i] = label({
			Name = "Slot" .. i,
			Size = UDim2.fromOffset(26, 20),
			Position = UDim2.fromOffset(12 + (i - 1) * 30, 54),
			Text = tostring(i),
			TextSize = 13,
			BackgroundColor3 = Color3.fromRGB(45, 50, 60),
			BackgroundTransparency = 0.35,
		}, ammo)
		mk("UICorner", { CornerRadius = UDim.new(0, 5) }, refs.slots[i])
	end

	-- top bar: scores + timer ------------------------------------------------
	local top = panel("TopBar", UDim2.fromOffset(430, 54), UDim2.new(0.5, -215, 0, 10), gui)
	refs.scoreBlaze = label({
		Size = UDim2.fromOffset(140, 34),
		Position = UDim2.fromOffset(14, 10),
		Text = "BLAZE 0",
		TextSize = 22,
		TextColor3 = COLORS.blade,
		TextXAlignment = Enum.TextXAlignment.Left,
	}, top)
	refs.scoreFrost = label({
		Size = UDim2.fromOffset(140, 34),
		Position = UDim2.new(1, -154, 0, 10),
		Text = "0 FROST",
		TextSize = 22,
		TextColor3 = COLORS.frost,
		TextXAlignment = Enum.TextXAlignment.Right,
	}, top)
	refs.timer = label({
		Size = UDim2.fromOffset(110, 34),
		Position = UDim2.new(0.5, -55, 0, 10),
		Text = "5:00",
		TextSize = 22,
		TextColor3 = COLORS.dim,
	}, top)
	refs.limit = label({
		Size = UDim2.fromOffset(430, 12),
		Position = UDim2.fromOffset(0, 42),
		Text = "FIRST TO 30",
		TextSize = 10,
		TextColor3 = COLORS.dim,
	}, top)

	-- kill feed (pooled labels, top-right) -----------------------------------
	local feed = mk("Frame", {
		Name = "KillFeed",
		Size = UDim2.fromOffset(340, 160),
		Position = UDim2.new(1, -356, 0, 76),
		BackgroundTransparency = 1,
	}, gui)
	mk("UIListLayout", {
		FillDirection = Enum.FillDirection.Vertical,
		HorizontalAlignment = Enum.HorizontalAlignment.Right,
		Padding = UDim.new(0, 4),
	}, feed)
	refs.feed = {}
	for i = 1, 6 do
		refs.feed[i] = label({
			Name = "Feed" .. i,
			Size = UDim2.fromOffset(340, 22),
			BackgroundColor3 = COLORS.panel,
			BackgroundTransparency = 0.3,
			TextSize = 14,
			TextTransparency = 1,
		}, feed)
		mk("UICorner", { CornerRadius = UDim.new(0, 6) }, refs.feed[i])
	end
	refs.feedCursor = 1
	refs.feedTokens = {}
end

-- Feedback: hit markers, numbers, flash --------------------------------------
local hitToken, dmgCursor, feedTokens = 0, 1, {}

local function showHitmarker(kind)
	hitToken = hitToken + 1
	local my = hitToken
	local hm = refs.hitmarker
	hm.Text = kind == "blocked" and "o" or "x"
	hm.TextColor3 = kind == "kill" and COLORS.danger
		or (kind == "head" and Color3.fromRGB(255, 210, 80)
		or (kind == "blocked" and COLORS.dim or COLORS.text))
	hm.TextSize = kind == "kill" and 38 or 30
	hm.TextTransparency = 0
	TweenService:Create(hm, TweenInfo.new(0.28, Enum.EasingStyle.Quad), { TextTransparency = 1 }):Play()
end

local function showDamageNumber(text, color)
	local lbl = refs.dmgLabels[dmgCursor]
	dmgCursor = dmgCursor % #refs.dmgLabels + 1
	lbl.Text = text
	lbl.TextColor3 = color or COLORS.text
	lbl.TextTransparency = 0
	lbl.Position = UDim2.fromScale(0.5, 0.45)
	TweenService:Create(lbl, TweenInfo.new(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		Position = UDim2.fromScale(0.5, 0.38),
		TextTransparency = 1,
	}):Play()
end

local function damageFlash()
	local f = refs.flash
	f.BackgroundTransparency = 0.72
	TweenService:Create(f, TweenInfo.new(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.Out), {
		BackgroundTransparency = 1,
	}):Play()
end

-- Kill feed -----------------------------------------------------------------
local function pushFeed(text, color)
	local lbl = refs.feed[refs.feedCursor]
	refs.feedCursor = refs.feedCursor % #refs.feed + 1
	feedTokens[lbl] = (feedTokens[lbl] or 0) + 1
	local my = feedTokens[lbl]
	lbl.Text = text
	lbl.TextColor3 = color or COLORS.text
	lbl.TextTransparency = 0
	task.delay(6, function()
		if feedTokens[lbl] == my and lbl.Parent then
			TweenService:Create(lbl, TweenInfo.new(0.3), { TextTransparency = 1 }):Play()
		end
	end)
end

-- Toasts (announcements / feed messages) -------------------------------------
local function buildToasts()
	refs.announce = label({
		Name = "Announce",
		Size = UDim2.fromOffset(700, 60),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.3),
		Text = "",
		TextSize = 34,
		TextTransparency = 1,
	}, gui)
	refs.streak = label({
		Name = "Streak",
		Size = UDim2.fromOffset(500, 44),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.38),
		Text = "",
		TextSize = 26,
		TextColor3 = Color3.fromRGB(255, 200, 80),
		TextTransparency = 1,
	}, gui)
	refs.combo = label({
		Name = "Combo",
		Size = UDim2.fromOffset(300, 30),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.62),
		Text = "",
		TextSize = 20,
		TextColor3 = COLORS.accent,
		TextTransparency = 1,
	}, gui)
	refs.blockTag = label({
		Name = "BlockTag",
		Size = UDim2.fromOffset(200, 26),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.57),
		Text = "BLOCK",
		TextSize = 16,
		TextColor3 = COLORS.frost,
		TextTransparency = 1,
	}, gui)
end

local function flashText(lbl, text, seconds, size)
	lbl.Text = text
	if size then
		lbl.TextSize = size
	end
	lbl.TextTransparency = 0
	TweenService:Create(lbl, TweenInfo.new(0.4, Enum.EasingStyle.Quad, Enum.EasingDirection.In), {
		TextTransparency = 1,
	}):Play()
end

-- Match end overlay ----------------------------------------------------------
local function buildEndOverlay()
	refs.endOverlay = mk("Frame", {
		Name = "EndOverlay",
		Size = UDim2.fromScale(1, 1),
		BackgroundColor3 = Color3.fromRGB(8, 9, 12),
		BackgroundTransparency = 1,
		BorderSizePixel = 0,
		Visible = false,
		ZIndex = 5,
	}, gui)
	refs.endTitle = label({
		Size = UDim2.fromOffset(800, 80),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.42),
		Text = "",
		TextSize = 54,
		ZIndex = 6,
	}, refs.endOverlay)
	refs.endScore = label({
		Size = UDim2.fromOffset(600, 40),
		AnchorPoint = Vector2.new(0.5, 0.5),
		Position = UDim2.fromScale(0.5, 0.52),
		Text = "",
		TextSize = 26,
		TextColor3 = COLORS.dim,
		ZIndex = 6,
	}, refs.endOverlay)
end

-- Crosshair ------------------------------------------------------------------
local crossGap = 7
local baseGap = 7

local function layoutCrosshair(gap)
	local c = refs.cross
	c[1].Position = UDim2.fromOffset(0, -gap)
	c[2].Position = UDim2.fromOffset(0, gap)
	c[3].Position = UDim2.fromOffset(-gap, 0)
	c[3].Rotation = 90
	c[4].Position = UDim2.fromOffset(gap, 0)
	c[4].Rotation = 90
end

local function bloomCrosshair()
	layoutCrosshair(baseGap + 5)
	task.delay(0.09, function()
		layoutCrosshair(baseGap)
	end)
end

-- Health ---------------------------------------------------------------------
local healthConn = nil

local function watchCharacter(char)
	if healthConn then
		healthConn:Disconnect()
		healthConn = nil
	end
	local hum = char:WaitForChild("Humanoid")
	local function update()
		local pct = Utility.clamp(hum.Health / math.max(1, hum.MaxHealth), 0, 1)
		refs.healthText.Text = tostring(math.floor(hum.Health + 0.5))
		refs.healthBar.Size = UDim2.fromScale(pct, 1)
		refs.healthBar.BackgroundColor3 = Color3.fromRGB(
			math.floor(90 + 165 * (1 - pct)),
			math.floor(80 + 140 * pct),
			math.floor(80 + 40 * pct)
		)
	end
	healthConn = hum.HealthChanged:Connect(update)
	update()
end

-- Graphics presets (client-local: never replicates, zero server cost) --------
local savedMaterials = nil
local postEffects = nil

local function applyGraphics(name)
	local preset = Config.Graphics[name]
	if not preset then
		return
	end
	player:SetAttribute("GraphicsPreset", name)

	Lighting.GlobalShadows = preset.shadows
	Lighting.FogEnd = preset.fogEnd

	if postEffects then
		for _, e in ipairs(postEffects) do
			e:Destroy()
		end
		postEffects = nil
	end
	if preset.postEffects then
		local bloom = Instance.new("BloomEffect")
		bloom.Name = "SZ_Bloom"
		bloom.Intensity = 0.4
		bloom.Size = 28
		bloom.Threshold = 1.1
		bloom.Parent = Lighting
		local cc = Instance.new("ColorCorrectionEffect")
		cc.Name = "SZ_CC"
		cc.Contrast = 0.06
		cc.Saturation = 0.06
		cc.Parent = Lighting
		postEffects = { bloom, cc }
	end

	-- LOW flattens map materials locally: far fewer texture samples to sample,
	-- which is the cheapest big win on integrated GPUs.
	local map = workspace:FindFirstChild("StrikeMap")
	if map then
		if savedMaterials == nil then
			savedMaterials = {}
			for _, d in ipairs(map:GetDescendants()) do
				if d:IsA("BasePart") then
					savedMaterials[#savedMaterials + 1] = { part = d, material = d.Material }
				end
			end
		end
		for _, entry in ipairs(savedMaterials) do
			if entry.part.Parent then
				if preset.mapMaterials then
					entry.part.Material = entry.material
				else
					entry.part.Material = Enum.Material.SmoothPlastic
				end
			end
		end
	end
	if refs.presetLabel then
		refs.presetLabel.Text = "GRAPHICS: " .. name
	end
end

local function buildSettings()
	local btn = mk("TextButton", {
		Name = "GfxButton",
		Size = UDim2.fromOffset(92, 30),
		Position = UDim2.fromOffset(16, 12),
		BackgroundColor3 = COLORS.panel,
		BackgroundTransparency = 0.25,
		BorderSizePixel = 0,
		Font = Enum.Font.GothamBold,
		Text = "GFX",
		TextColor3 = COLORS.text,
		TextSize = 14,
	}, gui)
	mk("UICorner", { CornerRadius = UDim.new(0, 8) }, btn)

	local frame = panel("Settings", UDim2.fromOffset(210, 150), UDim2.fromOffset(16, 50), gui)
	frame.Visible = false
	refs.presetLabel = label({
		Size = UDim2.new(1, -20, 0, 24),
		Position = UDim2.fromOffset(10, 8),
		Text = "GRAPHICS: " .. Config.DefaultGraphics,
		TextSize = 14,
		TextColor3 = COLORS.dim,
	}, frame)

	local presets = { "LOW", "MEDIUM", "HIGH" }
	for i, name in ipairs(presets) do
		local b = mk("TextButton", {
			Size = UDim2.new(1, -20, 0, 30),
			Position = UDim2.fromOffset(10, 34 + (i - 1) * 36),
			BackgroundColor3 = Color3.fromRGB(45, 50, 60),
			BorderSizePixel = 0,
			Font = Enum.Font.GothamBold,
			Text = name,
			TextColor3 = COLORS.text,
			TextSize = 14,
		}, frame)
		mk("UICorner", { CornerRadius = UDim.new(0, 6) }, b)
		b.Activated:Connect(function()
			applyGraphics(name)
		end)
	end

	btn.Activated:Connect(function()
		frame.Visible = not frame.Visible
	end)
end

-- Init: all hub subscriptions (event-driven, no loops) -----------------------
function UIController.init(h)
	hub = h
	buildHUD()
	buildToasts()
	buildEndOverlay()
	buildSettings()
	layoutCrosshair(baseGap)

	-- match state ------------------------------------------------------------
	hub:on("n_scores", function(p)
		refs.scoreBlaze.Text = "BLAZE " .. tostring(p.blaze or 0)
		refs.scoreFrost.Text = tostring(p.frost or 0) .. " FROST"
		refs.limit.Text = "FIRST TO " .. tostring(p.limit or Config.Match.scoreLimit)
		if p.phase == "live" and refs.endOverlay.Visible then
			refs.endOverlay.Visible = false
		end
	end)
	hub:on("n_timer", function(p)
		refs.timer.Text = Utility.formatTime(p.t or 0)
	end)
	hub:on("n_kill", function(p)
		if p.killer == "" or p.killer == nil then
			pushFeed(p.victim .. " died", COLORS.dim)
			return
		end
		local hs = p.head and "  [HS]" or ""
		local mine = p.killer == player.Name
		local color = mine and COLORS.accent or (p.team == "BLAZE" and COLORS.blade or COLORS.frost)
		pushFeed((mine and "YOU" or p.killer) .. "  >  " .. p.victim .. "  · " .. p.weapon .. hs, color)
		if mine then
			Utility.play("kill", 0.5)
		end
	end)
	hub:on("n_matchend", function(p)
		refs.endOverlay.Visible = true
		refs.endOverlay.BackgroundTransparency = 0.15
		if p.winner == "DRAW" then
			refs.endTitle.Text = "DRAW"
			refs.endTitle.TextColor3 = COLORS.text
		elseif p.winner == "BLAZE" then
			refs.endTitle.Text = "BLAZE WINS"
			refs.endTitle.TextColor3 = COLORS.blade
		else
			refs.endTitle.Text = "FROST WINS"
			refs.endTitle.TextColor3 = COLORS.frost
		end
		refs.endScore.Text = tostring(p.blaze or 0) .. "   -   " .. tostring(p.frost or 0)
	end)

	-- combat feedback --------------------------------------------------------
	hub:on("n_hit", function(p)
		if p.blocked then
			showHitmarker("blocked")
			showDamageNumber("BLOCKED", COLORS.dim)
			return
		end
		local kind = p.killed and "kill" or (p.head and "head" or "normal")
		showHitmarker(kind)
		showDamageNumber("-" .. tostring(p.dmg or 0),
			p.killed and COLORS.danger or (p.head and Color3.fromRGB(255, 210, 80) or COLORS.text))
		Utility.play("hit", 0.45)
	end)
	hub:on("n_damaged", function()
		damageFlash()
	end)
	hub:on("n_streak", function(p)
		flashText(refs.streak, tostring(p.n) .. " KILL STREAK!", 1.5, 26)
		Utility.play("ui", 0.5)
	end)
	hub:on("n_parry", function()
		refs.combo.TextColor3 = COLORS.accent
		flashText(refs.combo, "PARRY!", 1, 26)
	end)
	hub:on("n_parried", function()
		refs.combo.TextColor3 = COLORS.danger
		flashText(refs.combo, "PARRIED!", 1, 22)
	end)
	hub:on("n_block", function(p)
		refs.blockTag.TextTransparency = p.active and 0 or 1
	end)
	hub:on("combo", function(p)
		if p.kind == "LIGHT" and p.combo and p.combo > 1 then
			refs.combo.TextColor3 = COLORS.accent
			flashText(refs.combo, "COMBO x" .. tostring(p.combo), 0.7, 20)
		elseif p.kind == "GUNBUTT" then
			refs.combo.TextColor3 = COLORS.text
			flashText(refs.combo, "GUN BUTT!", 0.7, 20)
		end
	end)
	hub:on("blockstate", function(active)
		refs.blockTag.TextTransparency = active and 0 or 1
	end)

	-- announcements ----------------------------------------------------------
	hub:on("n_announce", function(p)
		flashText(refs.announce, tostring(p.text), 2.5, 34)
	end)
	hub:on("n_feed", function(p)
		flashText(refs.announce, tostring(p.text), 2, 24)
	end)

	-- weapon / ammo ----------------------------------------------------------
	hub:on("ammo", function(p)
		if p.melee then
			refs.ammoText.Text = "--"
			if p.name then
				refs.weaponName.Text = p.name
			end
			return
		end
		refs.ammoText.Text = tostring(p.mag or 0) .. " / " .. tostring(p.reserve or 0)
		if p.name then
			refs.weaponName.Text = p.name
		end
		if (p.mag or 0) > 0 then
			bloomCrosshair()
		end
	end)
	hub:on("weapon", function(p)
		refs.weaponName.Text = p.name
		for i = 1, 3 do
			refs.slots[i].BackgroundColor3 = (i == p.slot) and COLORS.accent or Color3.fromRGB(45, 50, 60)
		end
		local def = WeaponConfig.get(p.wid)
		baseGap = 7 + (def and def.spread or 1) * 1.6
		layoutCrosshair(baseGap)
	end)

	-- health -----------------------------------------------------------------
	player.CharacterAdded:Connect(watchCharacter)
	if player.Character then
		watchCharacter(player.Character)
	end

	-- graphics presets --------------------------------------------------------
	applyGraphics(Config.DefaultGraphics)
end

return UIController
