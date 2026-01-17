# Railway WebSocket 连接问题检查清单

## 🔍 问题诊断

根据错误代码 **1006**（连接异常关闭），这是常见问题，请按以下步骤排查：

### ✅ 步骤1：检查Railway服务状态

在Railway Dashboard中：

1. **确认服务正在运行**
   - [ ] 进入项目页面
   - [ ] 查看服务状态是否为 "Running"（绿色）
   - [ ] 如果是 "Stopped" 或 "Sleeping"，点击 "Deploy" 重新部署

2. **查看部署日志**
   - [ ] 进入 "Deployments" → 最新部署 → "View Logs"
   - [ ] 确认看到：`✅ WebSocket服务器启动成功`
   - [ ] 确认看到：`端口: XXXX`（应该不是8080，而是Railway分配的端口）

### ✅ 步骤2：检查Railway网络配置

1. **启用Public访问**
   - [ ] 进入 "Settings" → "Networking"
   - [ ] 确认 **"Public"** 选项已启用
   - [ ] 记录 **"Public Domain"**（应该是 `horseyear_game.up.railway.app`）

2. **检查端口配置**
   - [ ] 代码中已使用 `process.env.PORT`（正确）
   - [ ] Railway会自动设置PORT环境变量
   - [ ] 日志中显示的端口应该与环境变量一致

### ✅ 步骤3：测试HTTP健康检查

在浏览器中访问：
```
https://horseyear_game.up.railway.app/health
```

应该返回JSON：
```json
{
  "status": "ok",
  "service": "danmaku-boss-websocket",
  "port": 端口号,
  "clients": 0
}
```

**如果HTTP请求失败**：
- Railway服务可能未正确运行
- 需要重新部署

### ✅ 步骤4：测试WebSocket连接

使用浏览器控制台（F12）测试：

```javascript
const ws = new WebSocket('wss://horseyear_game.up.railway.app');
ws.onopen = () => console.log('✅ 连接成功！', ws);
ws.onerror = (e) => console.error('❌ 错误', e);
ws.onmessage = (e) => console.log('📨 消息', e.data);
ws.onclose = (e) => console.log('🔌 关闭', e.code, e.reason);
```

### ✅ 步骤5：常见问题解决方案

#### 问题A：错误代码1006 + 服务器日志显示正常

**可能原因**：
1. Railway的WebSocket支持需要特殊配置
2. 防火墙或网络问题
3. SSL/TLS证书问题

**解决方案**：
1. 尝试访问健康检查端点确认服务运行
2. 检查Railway文档确认WebSocket支持
3. 考虑使用其他服务（如Render）

#### 问题B：服务器日志没有显示连接尝试

**可能原因**：
- 请求没有到达服务器
- Railway的网络路由问题

**解决方案**：
1. 检查Railway Public Domain是否正确
2. 尝试重新部署服务
3. 检查Railway网络设置

#### 问题C：连接立即关闭

**可能原因**：
- 服务器代码错误
- WebSocket协议不匹配

**解决方案**：
1. 查看Railway日志中的错误信息
2. 确认服务器代码已正确部署
3. 检查WebSocket库版本

### ✅ 步骤6：使用测试页面

1. 访问：`https://jolly-strudel-2edfc8.netlify.app/test-ws.html?ws=wss://horseyear_game.up.railway.app`
2. 点击"测试连接"
3. 查看详细的错误信息

## 🔧 临时解决方案

如果Railway WebSocket仍然无法工作，可以考虑：

### 方案1：使用Render替代

Render对WebSocket的支持可能更好：
1. 部署到Render（使用render.yaml配置）
2. 更新WebSocket地址为Render域名

### 方案2：使用本地服务器（开发/测试）

```bash
node server.js
```

然后使用：
- `ws://localhost:8080`（本地测试）

### 方案3：使用其他WebSocket服务

- Fly.io
- Heroku（如果可用）
- AWS Lambda + API Gateway（较复杂）

## 📝 下一步

1. **提交修复后的代码到Git**
2. **Railway会自动重新部署**
3. **查看Railway日志确认新部署成功**
4. **使用test-ws.html测试连接**
5. **如果仍然失败，查看Railway日志中的错误信息**

## 🆘 需要帮助时提供的信息

如果问题持续，请提供：
1. Railway部署日志（最近的10-20行）
2. 浏览器控制台完整错误日志
3. test-ws.html的测试结果
4. 健康检查端点（/health）的响应
