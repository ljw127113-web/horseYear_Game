# Railway WebSocket连接问题排查指南

## 错误代码 1006 分析

错误代码 `1006` 表示：
- WebSocket连接异常关闭
- 通常是服务器没有响应或拒绝连接
- 可能是网络问题、服务器未运行、或端口/路径配置错误

## 问题诊断

### 1. 检查Railway服务器状态

在Railway项目中：

1. **查看部署日志**
   - 进入 Deployments
   - 查看最新部署的日志
   - 应该看到：`✅ WebSocket服务器启动在端口 XXXX`

2. **确认端口配置**
   - Railway会自动设置 `PORT` 环境变量
   - 代码应该使用 `process.env.PORT` 而不是硬编码的8080
   - 检查日志确认实际监听的端口

3. **检查服务是否运行**
   - 在Railway Dashboard确认服务状态为 "Running"
   - 如果显示 "Sleeping" 或 "Stopped"，需要重启

### 2. Railway WebSocket特殊配置

Railway对WebSocket有特殊要求：

1. **必须监听 `0.0.0.0`**
   ```javascript
   server.listen(PORT, '0.0.0.0', ...)
   ```

2. **需要处理HTTP健康检查**
   - Railway会定期发送GET请求检查服务状态
   - 必须返回200状态码

3. **可能需要处理路径**
   - 某些情况下需要监听根路径 `/`
   - 或特定的WebSocket路径

### 3. 测试连接

#### 方法1：使用浏览器控制台

```javascript
const ws = new WebSocket('wss://horseyear_game.up.railway.app');
ws.onopen = () => console.log('✅ 连接成功');
ws.onerror = (e) => console.error('❌ 错误', e);
ws.onmessage = (e) => console.log('消息:', e.data);
```

#### 方法2：使用curl（如果有命令行访问）

```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" \
  https://horseyear_game.up.railway.app
```

## 可能的原因和解决方案

### 原因1：端口不匹配

**症状**：服务器监听8080，但Railway分配的端口不同

**解决方案**：确保使用 `process.env.PORT`

### 原因2：Railway服务未公开

**症状**：只能内网访问

**解决方案**：
1. Railway Settings → Networking
2. 确保 "Public" 选项已启用
3. 记录 Public Domain

### 原因3：WebSocket路径问题

**症状**：HTTP请求正常，但WebSocket失败

**解决方案**：尝试添加路径（如果Railway需要）

### 原因4：Railway不支持WebSocket

**症状**：所有连接都失败

**解决方案**：
- 检查Railway文档确认WebSocket支持
- 考虑使用其他服务（如Render、Fly.io）

## 下一步行动

1. ✅ 确认服务器代码已更新（使用PORT环境变量）
2. ✅ 重新部署到Railway
3. ✅ 检查Railway日志确认端口
4. ✅ 使用test-ws.html测试连接
5. ✅ 如果仍然失败，考虑使用其他WebSocket服务
