// WebSocket服务器 - 用于多玩家弹幕同步
const WebSocket = require('ws');
const http = require('http');

// 从环境变量获取端口（Railway会自动设置），如果没有则使用默认值
const PORT = process.env.PORT || 8080;

// 存储所有连接的客户端
const clients = new Set();
let gameState = null;

// 创建HTTP服务器（处理健康检查和WebSocket升级）
const server = http.createServer((req, res) => {
    const url = require('url');
    const parsedUrl = url.parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';
    
    // 调试日志
    console.log(`📥 HTTP请求: ${req.method} ${pathname} (原始URL: ${req.url})`);

    // 处理健康检查请求（Railway需要）
    if (pathname === '/' || pathname === '/health') {
        const response = {
            status: 'ok', 
            service: 'danmaku-boss-websocket',
            port: PORT,
            clients: clients.size,
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };
        
        res.writeHead(200, { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end(JSON.stringify(response));
        console.log(`✅ 健康检查响应: 200 OK - ${JSON.stringify(response)}`);
        return;
    }

    // 处理OPTIONS请求（CORS预检）
    if (req.method === 'OPTIONS') {
        res.writeHead(200, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type'
        });
        res.end();
        return;
    }
    
    // 其他HTTP请求返回404
    const errorResponse = {
        error: 'Not Found',
        path: pathname,
        message: 'This endpoint does not exist. Use /health for health check.',
        availableEndpoints: ['/', '/health']
    };
    
    res.writeHead(404, { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
    });
    res.end(JSON.stringify(errorResponse));
    console.log(`❌ 404错误: ${pathname}`);
});

// 创建WebSocket服务器
const wss = new WebSocket.Server({ 
    server,
    perMessageDeflate: false, // 禁用压缩，避免Railway问题
    clientTracking: true,
    // 允许所有来源（生产环境可能需要限制）
    verifyClient: (info, callback) => {
        callback(true);
    }
});

// 启动服务器（必须监听0.0.0.0，Railway要求）
server.listen(PORT, '0.0.0.0', (err) => {
    if (err) {
        console.error('❌ 服务器启动失败:', err);
        process.exit(1);
    }
    console.log(`✅ WebSocket服务器启动成功`);
    console.log(`   端口: ${PORT}`);
    console.log(`   监听地址: 0.0.0.0:${PORT}`);
    console.log(`   环境: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   HTTP健康检查: http://0.0.0.0:${PORT}/health`);
    console.log(`   WebSocket端点: ws://0.0.0.0:${PORT}`);
});

// 处理服务器错误
server.on('error', (error) => {
    console.error('❌ HTTP服务器错误:', error);
});

wss.on('connection', (ws, req) => {
    const clientId = `${req.socket.remoteAddress || req.headers['x-forwarded-for'] || 'unknown'}-${Date.now()}`;
    console.log(`✅ 新客户端连接: ${clientId}`);
    console.log(`   请求URL: ${req.url}`);
    console.log(`   来源: ${req.headers.origin || '无'}`);
    console.log(`   User-Agent: ${req.headers['user-agent']?.substring(0, 50) || '无'}`);
    console.log(`   当前连接数: ${clients.size + 1}`);
    
    clients.add(ws);
    
    // 发送欢迎消息
    try {
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'WebSocket连接成功',
            clientId: clientId,
            timestamp: Date.now()
        }));
        console.log(`   ✅ 已发送欢迎消息给: ${clientId}`);
    } catch (error) {
        console.error('❌ 发送欢迎消息失败:', error);
    }
    
    // 发送当前游戏状态给新连接的客户端（如果有）
    if (gameState) {
        try {
            ws.send(JSON.stringify({
                type: 'gameState',
                data: gameState
            }));
        } catch (error) {
            console.error('❌ 发送游戏状态失败:', error);
        }
    }
    
    // 接收消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
                case 'bullet':
                    // 弹幕消息 - 广播给所有客户端（除了发送者）
                    console.log(`📨 收到弹幕: ${data.player?.name} - "${data.text}"`);
                    broadcast(data, ws);
                    break;
                    
                case 'damage':
                    // 伤害消息 - 广播给所有客户端
                    console.log(`💥 收到伤害: ${data.player?.name} - ${data.damage} (暴击: ${data.isCritical ? '是' : '否'})`);
                    broadcast(data, ws);
                    // 更新游戏状态
                    if (data.bossHP !== undefined) {
                        if (!gameState) gameState = {};
                        gameState.bossHP = data.bossHP;
                        gameState.bossMaxHP = data.bossMaxHP || 1000;
                    }
                    break;
                    
                case 'playerInfo':
                    // 玩家信息（连接时发送）
                    console.log(`👤 玩家连接: ${data.playerName || data.player?.name}`);
                    // 广播给其他玩家
                    broadcast({
                        type: 'playerJoined',
                        playerName: data.playerName || data.player?.name,
                        avatarUrl: data.avatarUrl || data.player?.avatarUrl
                    }, ws);
                    break;
                    
                case 'bossState':
                    // BOSS状态更新
                    if (!gameState) gameState = {};
                    gameState.boss = data.boss;
                    broadcast(data, ws);
                    break;
                    
                case 'gameReset':
                    // 游戏重置
                    gameState = null;
                    broadcast(data, ws);
                    console.log('🔄 游戏已重置');
                    break;
                    
                default:
                    console.log(`⚠️ 未知消息类型: ${data.type}`);
            }
        } catch (error) {
            console.error('❌ 消息解析错误:', error);
            console.error('   原始消息:', message.toString().substring(0, 100));
        }
    });
    
    // 客户端断开连接
    ws.on('close', (code, reason) => {
        console.log(`🔌 客户端断开: ${clientId}`);
        console.log(`   Code: ${code}, Reason: ${reason ? reason.toString() : '无'}`);
        clients.delete(ws);
        console.log(`   当前连接数: ${clients.size}`);
    });
    
    // 错误处理
    ws.on('error', (error) => {
        console.error(`❌ WebSocket错误 [${clientId}]:`, error.message || error);
        clients.delete(ws);
    });
});

// 广播消息给所有客户端（除了发送者）
function broadcast(data, sender) {
    const message = JSON.stringify(data);
    let sentCount = 0;
    clients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            try {
                client.send(message);
                sentCount++;
            } catch (error) {
                console.error('❌ 广播消息失败:', error);
            }
        }
    });
    if (sentCount > 0) {
        console.log(`📢 广播消息给 ${sentCount} 个客户端`);
    }
}

// 定期清理断开的连接
setInterval(() => {
    let cleaned = 0;
    clients.forEach((client) => {
        if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
            clients.delete(client);
            cleaned++;
        }
    });
    if (cleaned > 0) {
        console.log(`🧹 清理了 ${cleaned} 个断开的连接`);
    }
}, 30000);

// 定期输出服务器状态
setInterval(() => {
    console.log(`📊 服务器状态 - 端口: ${PORT}, 连接数: ${clients.size}, 游戏状态: ${gameState ? '有' : '无'}`);
}, 60000); // 每分钟输出一次

console.log('⏳ 等待客户端连接...');
