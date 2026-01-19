# 快速部署指南 - 5分钟上手

## 🚀 超快速部署（推荐流程）

### 第一步：部署WebSocket服务器到Railway（2分钟）

1. 访问 https://railway.app
2. 使用GitHub登录
3. 点击 "New Project" → "Deploy from GitHub repo"
4. 选择你的仓库
5. Railway会自动检测并部署
6. **记录部署后的URL**（例如：`your-project.up.railway.app`）
7. **WebSocket地址**：`wss://your-project.up.railway.app`

### 第二步：部署静态文件到Netlify（1分钟）

1. 访问 https://app.netlify.com
2. 点击 "Add new site" → "Import an existing project"
3. 选择你的GitHub仓库
4. 构建设置：
   - Build command: 留空
   - Publish directory: `/`
5. 点击 "Deploy site"
6. **记录Netlify域名**（例如：`your-site.netlify.app`）

### 第三步：连接配置（1分钟）

访问游戏时，使用以下URL格式：

**主游戏界面：**
```
https://your-site.netlify.app/index.html?ws=wss://your-project.up.railway.app
```

**玩家端：**
```
https://your-site.netlify.app/player.html?ws=wss://your-project.up.railway.app
```

### 第四步：测试（1分钟）

1. 在一个浏览器标签页打开主游戏界面（使用上面的URL）
2. 在另一个标签页打开玩家端（使用上面的URL）
3. 在玩家端发送弹幕
4. 在主游戏界面应该能看到弹幕

---

## ✅ 完成！

就这么简单！现在你的游戏已经可以在线使用了。

详细说明请查看 `DEPLOY-GUIDE.md`
