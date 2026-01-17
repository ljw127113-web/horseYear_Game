# 部署指南 - Netlify + WebSocket服务器

## 概述

由于Netlify是静态网站托管服务，不支持WebSocket服务器，我们需要：
1. **静态文件**（HTML/CSS/JS）部署到Netlify
2. **WebSocket服务器**部署到支持Node.js的服务（如Railway、Render等）

## 方案一：Railway部署WebSocket服务器（推荐，免费）

### 第一步：部署静态文件到Netlify

1. **准备文件**
   - 确保以下文件在Git仓库中：
     - `index.html`
     - `player.html`
     - `style.css`
     - `game.js`
     - `default-config.json`
     - `version.json`

2. **连接到Netlify**
   - 登录 [Netlify](https://app.netlify.com)
   - 点击 "Add new site" → "Import an existing project"
   - 连接你的Git仓库（GitHub/GitLab/Bitbucket）
   - 构建设置：
     - **Build command**: 留空（不需要构建）
     - **Publish directory**: `/` (根目录)
   - 点击 "Deploy site"

3. **获取Netlify域名**
   - 部署完成后，你会得到一个类似 `https://your-site.netlify.app` 的域名
   - 记录这个域名

### 第二步：部署WebSocket服务器到Railway

1. **注册Railway账号**
   - 访问 [Railway](https://railway.app)
   - 使用GitHub账号登录（推荐，每月有免费额度）

2. **创建新项目**
   - 点击 "New Project"
   - 选择 "Deploy from GitHub repo"
   - 选择你的Git仓库

3. **配置Railway**
   - Railway会自动检测到 `server.js` 和 `package.json`
   - 如果未自动检测，手动设置：
     - **Root Directory**: `/` (根目录)
     - **Start Command**: `node server.js`

4. **配置环境变量（如果需要）**
   - 在Railway项目的Variables标签页
   - 添加环境变量（如果需要的话）

5. **获取Railway域名**
   - 部署完成后，Railway会提供一个公共域名
   - 格式类似：`your-project.railway.app`
   - **重要**：需要在Railway设置中启用WebSocket支持
   - 记录这个域名和端口（通常是443或自定义端口）

### 第三步：配置WebSocket地址

需要修改代码，让WebSocket地址可以通过环境变量或配置来设置。

#### 方法1：修改 `game.js` 和 `player.html`，从URL参数读取服务器地址

已经实现了这个功能，可以通过URL参数传递：
- 主游戏：`index.html?ws=wss://your-server.railway.app`
- 玩家端：`player.html?ws=wss://your-server.railway.app`

#### 方法2：创建一个配置文件

让我创建一个配置文件来管理服务器地址...

### 第四步：更新Railway配置以支持WebSocket

在Railway项目设置中：
1. 进入 "Settings" → "Networking"
2. 确保端口设置为8080（或你在server.js中设置的端口）
3. 确保 "Public" 选项已启用

### 第五步：测试

1. 访问Netlify部署的静态网站
2. 在Railway查看日志，确认服务器正在运行
3. 测试WebSocket连接

---

## 方案二：使用Render部署WebSocket服务器（免费替代方案）

### 第一步：Netlify部署（同方案一）

### 第二步：Render部署WebSocket服务器

1. **注册Render账号**
   - 访问 [Render](https://render.com)
   - 使用GitHub账号登录

2. **创建Web Service**
   - 点击 "New" → "Web Service"
   - 连接你的Git仓库
   - 配置：
     - **Name**: danmaku-boss-server
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `node server.js`
     - **Instance Type**: Free

3. **获取Render域名**
   - Render会提供一个 `*.onrender.com` 域名
   - 记录这个域名

4. **注意**
   - Render免费版会在15分钟不活动后休眠
   - 首次访问可能需要等待启动（冷启动）
   - 对于生产环境，考虑升级到付费版

---

## 方案三：本地服务器 + 内网穿透（测试用）

如果只是测试，可以使用：
- **ngrok**: `ngrok http 8080`
- **localtunnel**: `lt --port 8080`

---

## 详细配置步骤

### 修改代码以支持动态服务器地址

我需要创建一个配置文件来存储服务器地址...
