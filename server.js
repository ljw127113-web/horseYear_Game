// WebSocket服务器 - 用于多玩家弹幕同步
const WebSocket = require('ws');

// 从环境变量获取端口，如果没有则使用默认值
const PORT = process.env.PORT || 8080;

// 创建WebSocket服务器
const server = require('http').createServer();
const wss = new WebSocket.Server({ server });

// 启动服务器
server.listen(PORT, () => {
    console.log(`✅ WebSocket服务器启动在端口 ${PORT}`);
    console.log(`访问 ws://localhost:${PORT} 或 wss://localhost:${PORT}`);
});

// 存储所有连接的客户端
const clients = new Set();
let gameState = null;

wss.on('connection', (ws, req) => {
    const clientId = `${req.socket.remoteAddress}-${Date.now()}`;
    console.log(`新客户端连接: ${clientId}`);
    
    clients.add(ws);
    
    // 发送当前游戏状态给新连接的客户端（如果有）
    if (gameState) {
        ws.send(JSON.stringify({
            type: 'gameState',
            data: gameState
        }));
    }
    
    // 接收消息
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            switch (data.type) {
                case 'bullet':
                    // 弹幕消息 - 广播给所有客户端（除了发送者）
                    broadcast(data, ws);
                    break;
                    
                case 'damage':
                    // 伤害消息 - 广播给所有客户端
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
                    console.log(`玩家连接: ${data.playerName}`);
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
                    break;
                    
                default:
                    console.log('未知消息类型:', data.type);
            }
        } catch (error) {
            console.error('消息解析错误:', error);
        }
    });
    
    // 客户端断开连接
    ws.on('close', () => {
        console.log(`客户端断开: ${clientId}`);
        clients.delete(ws);
    });
    
    // 错误处理
    ws.on('error', (error) => {
        console.error('WebSocket错误:', error);
        clients.delete(ws);
    });
});

// 广播消息给所有客户端（除了发送者）
function broadcast(data, sender) {
    const message = JSON.stringify(data);
    clients.forEach((client) => {
        if (client !== sender && client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// 定期清理断开的连接
setInterval(() => {
    clients.forEach((client) => {
        if (client.readyState === WebSocket.CLOSED || client.readyState === WebSocket.CLOSING) {
            clients.delete(client);
        }
    });
}, 30000);

console.log('等待客户端连接...');
