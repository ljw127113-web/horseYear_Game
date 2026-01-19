# 快速链接 - 弹幕BOSS战游戏

## 🔗 游戏链接

### 主游戏界面（BOSS战主画面）
[点击打开主游戏](https://jolly-strudel-2edfc8.netlify.app/index.html?ws=wss://horseyeargame-production.up.railway.app)

### 玩家端（发送弹幕）
[点击打开玩家端](https://jolly-strudel-2edfc8.netlify.app/player.html?ws=wss://horseyeargame-production.up.railway.app)

### WebSocket测试工具
[点击打开测试工具](https://jolly-strudel-2edfc8.netlify.app/test-ws.html?ws=wss://horseyeargame-production.up.railway.app)

## 📝 WebSocket服务器地址

```
wss://horseyeargame-production.up.railway.app
```

## 🎯 使用方法

### 1. 打开主游戏界面
- 完成玩家设置（上传头像、输入名字）
- 开始游戏，等待其他玩家发送弹幕

### 2. 打开玩家端（可以多个）
- 在不同设备或浏览器标签页打开玩家端
- 完成玩家设置
- 输入弹幕内容并发送

### 3. 实时同步
- 所有玩家的弹幕会在主游戏界面实时显示
- 弹幕击中BOSS时会产生伤害和特效
- 所有玩家看到的游戏状态是同步的

## ⚙️ 技术架构

- **前端部署**：Netlify (静态文件)
- **WebSocket服务器**：Railway (Node.js)
- **实时通信**：WebSocket

## 🔧 自定义配置

如果需要使用不同的WebSocket服务器，可以通过URL参数指定：

```
?ws=wss://your-server.com
```

例如：
```
https://jolly-strudel-2edfc8.netlify.app/player.html?ws=wss://your-server.com
```
