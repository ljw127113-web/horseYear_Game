# Railway WebSocket 连接问题排查

## 问题分析

根据错误日志，主要问题是：
1. URL参数解析可能有问题
2. Railway的WebSocket配置可能需要特殊处理

## Railway WebSocket配置检查

### 1. 确认Railway服务配置

在Railway项目中检查：

1. **Settings → Networking**
   - 确保 **Public** 选项已启用
   - 检查 **Port** 设置（Railway会自动设置PORT环境变量）

2. **Deployments → 查看最新部署日志**
   - 应该看到：`✅ WebSocket服务器启动在端口 XXXX`
   - 端口号应该是Railway自动分配的（通常是443或其他）

### 2. Railway WebSocket地址格式

Railway的WebSocket地址应该是：
```
wss://horseyear_game.up.railway.app
```

**注意**：
- 不需要指定端口号（Railway自动处理）
- 使用 `wss://`（安全WebSocket）
- 不要添加路径（如 `/ws` 等）

### 3. 测试连接

可以使用以下方法测试Railway WebSocket是否正常：

#### 方法1：浏览器控制台测试

在浏览器控制台（F12）运行：

```javascript
const ws = new WebSocket('wss://horseyear_game.up.railway.app');
ws.onopen = () => console.log('✅ 连接成功');
ws.onerror = (e) => console.error('❌ 连接失败', e);
ws.onclose = () => console.log('连接关闭');
```

#### 方法2：在线WebSocket测试工具

访问 https://www.websocket.org/echo.html
输入：`wss://horseyear_game.up.railway.app`

### 4. 常见问题

#### 问题1：Railway服务休眠

Railway免费版不会休眠，但如果服务未运行：
- 检查Railway部署状态
- 查看日志确认服务正在运行

#### 问题2：端口问题

Railway会自动设置PORT环境变量，代码已支持：
```javascript
const PORT = process.env.PORT || 8080;
```

如果还有问题，检查Railway的日志确认实际端口。

#### 问题3：HTTPS/WSS要求

如果Railway强制HTTPS，必须使用 `wss://` 协议。

## 快速测试URL

使用以下URL测试玩家端：

```
https://jolly-strudel-2edfc8.netlify.app/player.html?ws=wss://horseyear_game.up.railway.app
```

## 调试步骤

1. 打开浏览器控制台（F12）
2. 访问玩家端URL
3. 查看控制台输出：
   - `URL参数 ws: wss://horseyear_game.up.railway.app`
   - `正在连接到WebSocket服务器: wss://horseyear_game.up.railway.app`
   - `已连接到服务器` 或错误信息

4. 如果连接失败，查看错误详情：
   - 网络错误
   - 协议错误
   - 超时错误

## 如果仍然无法连接

1. 确认Railway服务正在运行（查看Railway日志）
2. 确认Railway Public选项已启用
3. 尝试在Railway中添加自定义域名
4. 检查防火墙设置
5. 联系Railway支持查看WebSocket支持情况
