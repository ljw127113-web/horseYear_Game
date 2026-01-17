// WebSocket服务器配置
// 这个文件用于配置WebSocket服务器地址

const WS_CONFIG = {
    // 默认服务器地址（开发环境）
    defaultUrl: 'ws://localhost:8080',
    
    // 生产环境服务器地址（需要根据实际部署修改）
    // 示例：
    // productionUrl: 'wss://your-server.railway.app',
    // productionUrl: 'wss://your-server.onrender.com',
    productionUrl: null,
    
    // 自动检测环境
    getServerUrl() {
        // 优先使用URL参数
        const urlParams = new URLSearchParams(window.location.search);
        const urlParam = urlParams.get('ws');
        if (urlParam) {
            return urlParam;
        }
        
        // 其次使用环境变量（如果在构建时设置）
        if (typeof WS_SERVER_URL !== 'undefined') {
            return WS_SERVER_URL;
        }
        
        // 使用生产环境地址（如果设置）
        if (this.productionUrl) {
            return this.productionUrl;
        }
        
        // 默认使用开发环境地址
        return this.defaultUrl;
    }
};
