const codigoLua = `  
local redzlib = loadstring(game:HttpGet("https://raw.githubusercontent.com/tbao143/Library-ui/refs/heads/main/Redzhubui"))()
local Window = redzlib:MakeWindow({
  Title = "Tropa do Egito : PathHack 🛰️",
  SubTitle = "by DKZIN 🥷🏼🇪🇬",
  SaveFolder = "hackpathconfig.lua"
})
Window:AddMinimizeButton({
  Button = { Image = "rbxassetid://71014873973869", BackgroundTransparency = 0 },
  Corner = { CornerRadius = UDim.new(35, 1) },
})

local PathTab = Window:MakeTab({"radar", "wifi"})
PathTab:AddSection({"Sistema de Rastreamento 🛰️"})

local Players = game:GetService("Players")
local PathfindingService = game:GetService("PathfindingService")
local RunService = game:GetService("RunService")
local LocalPlayer = Players.LocalPlayer

local targetName = ""
local following = false
local autoFollow = false
local lastHighlight = nil
local currentESPLine = nil
local pathLineParts = {}
local followThread = nil
local autoFollowThread = nil

local function getRoot(char) return char and (char:FindFirstChild("HumanoidRootPart") or char.PrimaryPart) end
local function getHumanoid(char) return char and char:FindFirstChildWhichIsA("Humanoid") end

local function findTarget(name)
	name = name:lower()
	for _, plr in pairs(Players:GetPlayers()) do
		if plr ~= LocalPlayer and plr.Character and plr.Name:lower():find(name) and getRoot(plr.Character) then
			return plr
		end
	end
end

local function getClosestPlayer()
	local char = LocalPlayer.Character
	if not char then return nil end
	local root = getRoot(char)
	if not root then return nil end

	local closestDist = math.huge
	local closestPlayer = nil

	for _, plr in pairs(Players:GetPlayers()) do
		if plr ~= LocalPlayer and plr.Character and getRoot(plr.Character) then
			local dist = (getRoot(plr.Character).Position - root.Position).Magnitude
			if dist < closestDist then
				closestDist = dist
				closestPlayer = plr
			end
		end
	end
	return closestPlayer
end

local function highlightTarget(char)
	if lastHighlight then lastHighlight:Destroy() end
	local hl = Instance.new("Highlight", workspace)
	hl.Name = "TargetHighlight"
	hl.Adornee = char
	hl.FillColor = Color3.fromRGB(255,255,0)
	hl.OutlineColor = Color3.fromRGB(255,0,0)
	hl.FillTransparency = 0.3
	hl.OutlineTransparency = 0
	lastHighlight = hl
end

local function clearVisuals()
	if lastHighlight then lastHighlight:Destroy() lastHighlight = nil end
	for _, p in pairs(pathLineParts) do if p and p.Parent then p:Destroy() end end
	pathLineParts = {}
	if currentESPLine then currentESPLine:Destroy() currentESPLine = nil end
end

local function createPathLines(waypoints)
	clearVisuals()
	for i = 1, #waypoints - 1 do
		local a, b = waypoints[i].Position, waypoints[i+1].Position
		a = Vector3.new(a.X, a.Y + 3.5, a.Z)
		b = Vector3.new(b.X, b.Y + 3.5, b.Z)
		local dist = (b - a).Magnitude
		local part = Instance.new("Part", workspace)
		part.Anchored = true part.CanCollide = false part.Transparency = 0.4
		part.Material = Enum.Material.Neon
		part.Color = Color3.fromHSV(tick()%5/5,1,1)
		part.Size = Vector3.new(0.15, 0.15, dist)
		part.CFrame = CFrame.new(a, b) * CFrame.new(0, 0, -dist/2)
		table.insert(pathLineParts, part)
	end
end

local function drawTracer(fromFunc, toFunc)
	if currentESPLine then currentESPLine:Destroy() end
	local beam = Instance.new("Beam", workspace)
	beam.FaceCamera = true beam.Width0 = 0.15 beam.Width1 = 0.15
	beam.Texture = "rbxassetid://252312373" beam.TextureSpeed = 2
	beam.Color = ColorSequence.new{ColorSequenceKeypoint.new(0, Color3.fromRGB(255,0,0)), ColorSequenceKeypoint.new(0.5, Color3.fromRGB(255,255,0)), ColorSequenceKeypoint.new(1, Color3.fromRGB(255,0,0))}
	local att0 = Instance.new("Attachment", workspace.Terrain)
	local att1 = Instance.new("Attachment", workspace.Terrain)
	beam.Attachment0 = att0 beam.Attachment1 = att1
	RunService:BindToRenderStep("UpdateTracer", 200, function()
		if att0 and att1 then
			att0.WorldPosition = fromFunc() + Vector3.new(0,3.5,0)
			att1.WorldPosition = toFunc() + Vector3.new(0,3.5,0)
		end
	end)
	currentESPLine = beam
end

local function faceTo(root, pos)
	if root and pos then
		root.CFrame = CFrame.new(root.Position, Vector3.new(pos.X, root.Position.Y, pos.Z))
	end
end

local function moveTo(hum, root, pos)
	hum:MoveTo(pos)
	local done = false
	local t = tick() + 6
	local conn = hum.MoveToFinished:Connect(function(ok) done = ok end)
	while not done and tick() < t and root.Parent do task.wait(0.03) end
	conn:Disconnect()
	return done
end

local function followLoop()
	local char = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
	local hum = getHumanoid(char)
	local root = getRoot(char)
	if not root or not hum then return end
	hum.AutoRotate = false hum.WalkSpeed = 35 if hum.SeatPart then hum.Sit = false end

	while following and targetName ~= "" and char.Parent do
		local target = findTarget(targetName)
		if not target or not target.Character or not getRoot(target.Character) then task.wait(0.2) continue end
		local tRoot = getRoot(target.Character)
		highlightTarget(target.Character)
		drawTracer(function() return root.Position end, function() return tRoot.Position end)

		local path = PathfindingService:CreatePath({
			AgentRadius = 2,
			AgentHeight = 6,
			AgentCanJump = true,
			AgentMaxSlope = 45
		})
		path:ComputeAsync(root.Position, tRoot.Position)

		if path.Status == Enum.PathStatus.Success then
			local waypoints = path:GetWaypoints()
			createPathLines(waypoints)
			for _, wp in ipairs(waypoints) do
				if not following or targetName == "" then break end
				if wp.Action == Enum.PathWaypointAction.Jump then hum.Jump = true end
				faceTo(root, wp.Position)
				if not moveTo(hum, root, wp.Position) then break end
			end
		else
			hum:MoveTo(tRoot.Position)
		end

		task.wait(0.02)
	end

	clearVisuals()
	hum.WalkSpeed = 16 hum.AutoRotate = true
end

local function autoFollowLoop()
	local char = LocalPlayer.Character or LocalPlayer.CharacterAdded:Wait()
	local hum = getHumanoid(char)
	local root = getRoot(char)
	if not root or not hum then return end
	hum.AutoRotate = false hum.WalkSpeed = 35 if hum.SeatPart then hum.Sit = false end

	while autoFollow and char.Parent do
		local target = getClosestPlayer()
		if target and target.Character and getRoot(target.Character) then
			targetName = target.Name -- sincroniza alvo pro highlight e linha
			highlightTarget(target.Character)
			drawTracer(function() return root.Position end, function() return getRoot(target.Character).Position end)

			local path = PathfindingService:CreatePath({
				AgentRadius = 2,
				AgentHeight = 6,
				AgentCanJump = true,
				AgentMaxSlope = 45
			})
			path:ComputeAsync(root.Position, getRoot(target.Character).Position)

			if path.Status == Enum.PathStatus.Success then
				local waypoints = path:GetWaypoints()
				createPathLines(waypoints)
				for _, wp in ipairs(waypoints) do
					if not autoFollow or not char.Parent then break end
					if wp.Action == Enum.PathWaypointAction.Jump then hum.Jump = true end
					faceTo(root, wp.Position)
					if not moveTo(hum, root, wp.Position) then break end
				end
			else
				hum:MoveTo(getRoot(target.Character).Position)
			end
		else
			clearVisuals()
			targetName = ""
			task.wait(0.5)
		end
		task.wait(0.03)
	end

	clearVisuals()
	hum.WalkSpeed = 16
	hum.AutoRotate = true
end

PathTab:AddTextBox({
	Name = "👤 Nick do Alvo",
	Description = "Digite quem deseja rastrear",
	PlaceholderText = "ex: dkzin",
	Callback = function(v) targetName = v end
})

PathTab:AddToggle({
	Name = "📡 Rastrear",
	Default = false,
	Callback = function(state)
		if state then
			if targetName ~= "" and not following then
				following = true
				followThread = coroutine.create(followLoop)
				coroutine.resume(followThread)
			end
		else
			following = false
			if followThread then
				followThread = nil
				clearVisuals()
			end
		end
	end
})

PathTab:AddToggle({
	Name = "🤖 Auto Rastrear",
	Default = false,
	Callback = function(state)
		if state then
			if not autoFollow then
				autoFollow = true
				autoFollowThread = coroutine.create(autoFollowLoop)
				coroutine.resume(autoFollowThread)
			end
		else
			autoFollow = false
			if autoFollowThread then
				autoFollowThread = nil
				clearVisuals()
			end
		end
	end
})
`

fetch('https://suaapi.com/enviar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ script: codigoLua })
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err))
