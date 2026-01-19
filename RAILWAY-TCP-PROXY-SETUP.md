# Railway TCP Proxy 配置指南

## 重要发现

你的Railway域名是：`horseyeargame-production.up.railway.app`

对于WebSocket连接，Railway需要**TCP Proxy**才能正常工作！

## 配置步骤

### 1. TCP Proxy 配置（必需）

TCP Proxy是WebSocket连接的关键：

1. **在Railway项目中**：
   - 进入 **Settings** → **Networking**
   - 找到 **TCP Proxy** 部分
   - 点击 **"Generate Proxy Domain"** 或 **"Add TCP Proxy"**
   
2. **Railway会生成一个TCP Proxy域名**，格式类似：
   ```
   xxx.up.railway.app:xxxxx
   ```
   这是一个特殊的TCP端点，用于WebSocket连接。

3. **端口配置**：
   - TCP Proxy会显示一个端口号（通常是5位数字）
   - 这个端口用于WebSocket连接

### 2. 使用TCP Proxy进行WebSocket连接

**重要**：WebSocket不能使用HTTP域名，必须使用TCP Proxy域名！

**正确的WebSocket地址格式**：
```
wss://[TCP-Proxy域名]:[TCP-Proxy端口]
```

例如（假设Railway生成的TCP Proxy）：
```
wss://xxxxx.up.railway.app:12345
```

### 3. Custom Domain（可选）

Custom Domain用于绑定自己的域名：
- 如果你想使用 `your-domain.com` 而不是Railway提供的域名
- 需要配置DNS记录
- 对于WebSocket，仍然需要TCP Proxy

**暂时不需要配置Custom Domain**，除非你有自己的域名。

## 详细配置步骤

### 步骤1：启用TCP Proxy

1. 在Railway Dashboard中
2. 进入你的项目
3. 点击 **Settings** → **Networking**
4. 滚动到 **TCP Proxy** 部分
5. 点击 **"Generate Proxy Domain"** 或 **"Enable TCP Proxy"**
6. Railway会生成：
   - TCP Proxy域名（格式：`xxx.up.railway.app`）
   - TCP Proxy端口（通常是5位数字，如 `12345`）

### 步骤2：记录TCP Proxy信息

记录以下信息：
- TCP Proxy域名：`xxx.up.railway.app`
- TCP Proxy端口：`12345`（示例）

### 步骤3：更新WebSocket地址

使用TCP Proxy信息更新WebSocket连接地址：

**格式**：
```
wss://[TCP-Proxy域名]:[TCP-Proxy端口]
```

**示例**（假设生成的信息）：
```
wss://xxxxx.up.railway.app:12345
```

### 步骤4：测试连接

使用更新后的TCP Proxy地址测试：

**玩家端URL**：
```
https://jolly-strudel-2edfc8.netlify.app/player.html?ws=wss://[TCP-Proxy域名]:[TCP-Proxy端口]
```

**测试页面**：
```
https://jolly-strudel-2edfc8.netlify.app/test-ws.html?ws=wss://[TCP-Proxy域名]:[TCP-Proxy端口]
```

## 重要说明

### HTTP vs TCP Proxy

- **HTTP域名** (`horseyeargame-production.up.railway.app`): 
  - 用于HTTP请求（如健康检查 `/health`）
  - 不能用于WebSocket连接
  
- **TCP Proxy域名**:
  - 专门用于WebSocket和其他TCP连接
  - 必须使用TCP Proxy才能建立WebSocket连接

### 端口说明

- **HTTP端口** (8080): 用于HTTP请求
- **TCP Proxy端口** (通常是5位数字): 用于WebSocket连接

## 常见问题

### Q1: TCP Proxy在哪里找到？

A: Railway Settings → Networking → TCP Proxy部分

### Q2: TCP Proxy端口是多少？

A: Railway会自动生成一个5位数字的端口（如12345）

### Q3: 为什么不能直接用HTTP域名连接WebSocket？

A: Railway的HTTP域名用于HTTP/HTTPS流量，WebSocket需要TCP连接，必须使用TCP Proxy。

### Q4: TCP Proxy是免费的吗？

A: Railway的TCP Proxy在免费计划中可用。

## 下一步操作

1. ✅ 在Railway中启用TCP Proxy
2. ✅ 记录TCP Proxy域名和端口
3. ✅ 使用TCP Proxy地址更新WebSocket连接
4. ✅ 测试连接

## 如果找不到TCP Proxy选项

如果Railway界面中没有TCP Proxy选项，可能需要：

1. 检查Railway计划（某些功能可能需要特定计划）
2. 查看Railway文档确认WebSocket支持
3. 考虑切换到Render（对WebSocket支持更好）
