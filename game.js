// 默认游戏配置（从default-config.json同步，可直接修改这里）
// 注意：修改default-config.json后需要同步更新这里的值
const DEFAULT_CONFIG = {
    BOSS: {
        INITIAL_HP: 500,        // 从default-config.json同步
        MAX_HP: 500,            // 从default-config.json同步
        SIZE: 350,              // 从default-config.json同步
        MOVE_SPEED: 0.6,        // 从default-config.json同步
        MOVE_RANGE: { minX: 100, maxX: 900, minY: 150, maxY: 400 },
        IMAGE_URL: null
    },
    BULLET: {
        SPEED: 0.6,             // 从default-config.json同步
        HEIGHT: 60,             // 从default-config.json同步
        BASE_DAMAGE: 10,        // 从default-config.json同步
        CRITICAL_RATE: 0.15,    // 从default-config.json同步（15%）
        CRITICAL_MULTIPLIER: 5  // 从default-config.json同步
    },
    GAME: {
        FPS: 60
    }
};

// 游戏配置（可动态修改）
let CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

// ============ WebSocket多玩家支持 ============
let ws = null;
let wsConnected = false;

// WebSocket服务器地址配置
// 优先级：URL参数 > 环境变量 > 默认值
function getWebSocketUrl() {
    // 1. 优先使用URL参数
    const urlParams = new URLSearchParams(window.location.search);
    const urlParam = urlParams.get('ws');
    if (urlParam) {
        return urlParam;
    }
    
    // 2. 使用环境变量（如果在构建时设置）
    if (typeof WS_SERVER_URL !== 'undefined' && WS_SERVER_URL) {
        return WS_SERVER_URL;
    }
    
    // 3. 检查是否为生产环境（Netlify）
    const hostname = window.location.hostname;
    if (hostname.includes('netlify.app') || hostname !== 'localhost' && hostname !== '127.0.0.1') {
        // 生产环境默认地址（需要替换为实际的服务器地址）
        // 例如：'wss://your-server.railway.app'
        return null; // 返回null表示未配置，将提示用户
    }
    
    // 4. 开发环境默认地址
    return 'ws://localhost:8080';
}

const WS_SERVER_URL = getWebSocketUrl();

// 从配置文件加载默认设置
let loadedDefaultConfig = null;

async function loadDefaultConfigFromFile() {
    // 检测是否使用file://协议
    const isFileProtocol = window.location.protocol === 'file:';
    
    if (isFileProtocol) {
        // 使用file://协议时，直接使用内置的DEFAULT_CONFIG
        console.log('ℹ️ 使用file://协议打开，使用内置默认配置');
        loadedDefaultConfig = null; // 使用内置配置
        return false;
    }
    
    // 使用HTTP协议时，尝试从文件加载配置
    try {
        const response = await fetch('default-config.json');
        if (!response.ok) {
            throw new Error('配置文件加载失败');
        }
        const configData = await response.json();
        
        // 验证配置数据的完整性
        if (configData && configData.BOSS && configData.BULLET) {
            loadedDefaultConfig = configData;
            console.log('✅ 已从文件加载默认配置');
            return true;
        } else {
            throw new Error('配置文件格式错误');
        }
    } catch (error) {
        console.warn('无法加载配置文件，使用内置默认配置:', error.message);
        loadedDefaultConfig = null;
        return false;
    }
}

// 获取默认配置（优先使用文件配置，否则使用内置配置）
function getDefaultConfig() {
    if (loadedDefaultConfig) {
        return JSON.parse(JSON.stringify(loadedDefaultConfig));
    }
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}

// 图片缓存
const imageCache = new Map();

// 加载图片
function loadImage(url) {
    if (imageCache.has(url)) {
        return imageCache.get(url);
    }
    
    const img = new Image();
    img.src = url;
    imageCache.set(url, img);
    return img;
}

// 游戏状态（将在startGame时初始化）
const gameState = {
    player: {
        name: '',
        avatar: null,
        avatarUrl: ''
    },
    boss: {
        x: 0, // 将在initCanvas中设置
        y: 0, // 将在initCanvas中设置
        hp: 0, // 将在startGame时设置
        maxHp: 0, // 将在startGame时设置
        direction: { x: 1, y: 1 },
        isAlive: true,
        flashTimer: 0 // BOSS闪烁计时器
    },
    bullets: [],
    lastHitPlayer: null,
    isGameOver: false,
    battleLog: [],
    hitEffects: [], // 打击效果
    damageNumbers: [] // 伤害数字
};

// 统计数据系统（从LocalStorage加载）
const STATS_STORAGE_KEY = 'game_stats_data';

// 初始化统计数据
function initStats() {
    const savedStats = localStorage.getItem(STATS_STORAGE_KEY);
    if (savedStats) {
        try {
            gameState.stats = JSON.parse(savedStats);
        } catch (e) {
            gameState.stats = {};
        }
    } else {
        gameState.stats = {};
    }
}

// 记录玩家伤害
function recordDamage(playerName, damage, isCritical) {
    if (!gameState.stats[playerName]) {
        gameState.stats[playerName] = {
            totalDamage: 0,
            criticalCount: 0,
            hitCount: 0
        };
    }
    
    gameState.stats[playerName].totalDamage += damage;
    gameState.stats[playerName].hitCount++;
    if (isCritical) {
        gameState.stats[playerName].criticalCount++;
    }
    
    // 保存到LocalStorage
    localStorage.setItem(STATS_STORAGE_KEY, JSON.stringify(gameState.stats));
}

// 清空统计数据
function clearStats() {
    gameState.stats = {};
    localStorage.removeItem(STATS_STORAGE_KEY);
    updateStatsDisplay();
}

// 更新统计排名显示
function updateStatsDisplay() {
    const damageRankingEl = document.getElementById('damageRanking');
    const criticalRankingEl = document.getElementById('criticalRanking');
    
    if (!damageRankingEl || !criticalRankingEl) return;
    
    // 获取所有玩家数据
    const players = Object.keys(gameState.stats).map(name => ({
        name: name,
        totalDamage: gameState.stats[name].totalDamage,
        criticalCount: gameState.stats[name].criticalCount
    }));
    
    // 伤害输出排名
    players.sort((a, b) => b.totalDamage - a.totalDamage);
    damageRankingEl.innerHTML = '';
    if (players.length === 0) {
        damageRankingEl.innerHTML = '<div class="ranking-item-empty">暂无数据</div>';
    } else {
        players.slice(0, 10).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span class="ranking-rank">${index + 1}</span>
                <span class="ranking-name">${player.name}</span>
                <span class="ranking-value">${player.totalDamage.toLocaleString()}</span>
            `;
            damageRankingEl.appendChild(item);
        });
    }
    
    // 暴击次数排名
    players.sort((a, b) => b.criticalCount - a.criticalCount);
    criticalRankingEl.innerHTML = '';
    if (players.length === 0) {
        criticalRankingEl.innerHTML = '<div class="ranking-item-empty">暂无数据</div>';
    } else {
        players.slice(0, 10).forEach((player, index) => {
            const item = document.createElement('div');
            item.className = 'ranking-item';
            item.innerHTML = `
                <span class="ranking-rank">${index + 1}</span>
                <span class="ranking-name">${player.name}</span>
                <span class="ranking-value">${player.criticalCount}次</span>
            `;
            criticalRankingEl.appendChild(item);
        });
    }
}

// 在gameState中添加stats属性
if (!gameState.stats) {
    gameState.stats = {};
}

// DOM元素
const elements = {
    playerSetup: document.getElementById('playerSetup'),
    gameArea: document.getElementById('gameArea'),
    killerDisplay: document.getElementById('killerDisplay'),
    avatarInput: document.getElementById('avatarInput'),
    avatarPreview: document.getElementById('avatarPreview'),
    uploadBtn: document.getElementById('uploadBtn'),
    playerName: document.getElementById('playerName'),
    confirmSetup: document.getElementById('confirmSetup'),
    currentPlayerAvatar: document.getElementById('currentPlayerAvatar'),
    currentPlayerName: document.getElementById('currentPlayerName'),
    bulletInput: document.getElementById('bulletInput'),
    sendBullet: document.getElementById('sendBullet'),
    gameCanvas: document.getElementById('gameCanvas'),
    hpBar: document.getElementById('hpBar'),
    currentHP: document.getElementById('currentHP'),
    maxHP: document.getElementById('maxHP'),
    battleLog: document.getElementById('battleLog'),
    killerAvatar: document.getElementById('killerAvatar'),
    killerName: document.getElementById('killerName'),
    playAgain: document.getElementById('playAgain'),
    openConfigBtn: document.getElementById('openConfigBtn'),
    versionDisplay: document.getElementById('versionDisplay'),
    versionNumber: document.getElementById('versionNumber'),
    configPanel: document.getElementById('configPanel'),
    closeConfigBtn: document.getElementById('closeConfigBtn'),
    clearStatsBtn: document.getElementById('clearStatsBtn'),
    bossImageInput: document.getElementById('bossImageInput'),
    bossImagePreview: document.getElementById('bossImagePreview'),
    uploadBossImageBtn: document.getElementById('uploadBossImageBtn'),
    bossHP: document.getElementById('bossHP'),
    bossSpeed: document.getElementById('bossSpeed'),
    bulletDamage: document.getElementById('bulletDamage'),
    bulletSpeed: document.getElementById('bulletSpeed'),
    criticalRate: document.getElementById('criticalRate'),
    criticalMultiplier: document.getElementById('criticalMultiplier'),
    saveConfigBtn: document.getElementById('saveConfigBtn'),
    resetConfigBtn: document.getElementById('resetConfigBtn'),
    clearStatsBtn: document.getElementById('clearStatsBtn')
};

// Canvas上下文
const ctx = elements.gameCanvas.getContext('2d');

// 初始化Canvas（移动端优化）
function initCanvas() {
    // 获取实际可用尺寸（考虑移动端浏览器UI）
    const updateCanvasSize = () => {
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        elements.gameCanvas.width = width;
        elements.gameCanvas.height = height;
        
        // 调整BOSS初始位置到屏幕中央
        gameState.boss.x = width / 2;
        gameState.boss.y = height / 2;
        
        // 调整BOSS移动范围（移动端优化）
        const minY = Math.min(150, height * 0.15);
        const maxY = Math.max(height - 200, height * 0.7);
        
        CONFIG.BOSS.MOVE_RANGE = {
            minX: CONFIG.BOSS.SIZE,
            maxX: width - CONFIG.BOSS.SIZE,
            minY: minY,
            maxY: maxY
        };
    };
    
    updateCanvasSize();
    
    // 延迟处理resize，避免移动端频繁触发
    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const width = window.innerWidth;
            const height = window.innerHeight;
            
            elements.gameCanvas.width = width;
            elements.gameCanvas.height = height;
            
            // 重新调整BOSS位置和移动范围
            gameState.boss.x = Math.min(gameState.boss.x, width - CONFIG.BOSS.SIZE);
            gameState.boss.y = Math.min(gameState.boss.y, height - 200);
            
            const minY = Math.min(150, height * 0.15);
            const maxY = Math.max(height - 200, height * 0.7);
            
            CONFIG.BOSS.MOVE_RANGE = {
                minX: CONFIG.BOSS.SIZE,
                maxX: width - CONFIG.BOSS.SIZE,
                minY: minY,
                maxY: maxY
            };
        }, 100);
    });
    
    // 移动端防止双击缩放
    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd <= 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, false);
    
    // 防止移动端默认拖拽行为
    document.addEventListener('touchmove', (e) => {
        // 只在canvas区域外阻止默认行为
        if (e.target !== elements.gameCanvas) {
            e.preventDefault();
        }
    }, { passive: false });
}

// 玩家设置相关
elements.uploadBtn.addEventListener('click', () => {
    elements.avatarInput.click();
});

elements.avatarInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            gameState.player.avatarUrl = event.target.result;
            elements.avatarPreview.src = event.target.result;
            elements.avatarPreview.style.display = 'block';
            document.querySelector('.avatar-placeholder').style.display = 'none';
            checkSetupComplete();
        };
        reader.readAsDataURL(file);
    }
});

elements.playerName.addEventListener('input', () => {
    checkSetupComplete();
});

function checkSetupComplete() {
    const hasAvatar = gameState.player.avatarUrl !== '';
    const hasName = elements.playerName.value.trim() !== '';
    elements.confirmSetup.disabled = !(hasAvatar && hasName);
}

elements.confirmSetup.addEventListener('click', () => {
    gameState.player.name = elements.playerName.value.trim();
    gameState.player.avatar = elements.avatarPreview.src;
    elements.currentPlayerAvatar.src = gameState.player.avatarUrl;
    elements.currentPlayerName.textContent = gameState.player.name;
    
    elements.playerSetup.style.display = 'none';
    elements.gameArea.style.display = 'block';
    
    initCanvas();
    startGame();
    
    // 连接WebSocket服务器（延迟连接，确保游戏已初始化）
    setTimeout(() => {
        connectWebSocket();
    }, 500);
});

// 发送弹幕（移动端优化）
elements.sendBullet.addEventListener('click', () => {
    sendBullet();
    // 移动端输入框优化：点击发送按钮后自动聚焦到输入框
    setTimeout(() => {
        elements.bulletInput.focus();
    }, 100);
});

// 移动端触摸支持
elements.sendBullet.addEventListener('touchend', (e) => {
    e.preventDefault();
    sendBullet();
    setTimeout(() => {
        elements.bulletInput.focus();
    }, 100);
});

elements.bulletInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBullet();
    }
});

function sendBullet() {
    const text = elements.bulletInput.value.trim();
    if (text === '' || gameState.isGameOver) return;
    
    const bullet = {
        id: Date.now() + Math.random(),
        player: {
            name: gameState.player.name,
            avatarUrl: gameState.player.avatarUrl
        },
        text: text,
        x: elements.gameCanvas.width + 100, // 从右侧开始（向左移动）
        y: Math.random() * (elements.gameCanvas.height - 200) + 100,
        width: 0, // 将在绘制时计算
        height: CONFIG.BULLET.HEIGHT
    };
    
    // 添加到本地弹幕列表
    gameState.bullets.push(bullet);
    
    // 通过WebSocket发送给服务器（广播给其他玩家）
    if (wsConnected && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'bullet',
            player: bullet.player,
            text: bullet.text,
            id: bullet.id
        }));
    }
    
    elements.bulletInput.value = '';
}

// 接收其他玩家的弹幕
function receiveBulletFromPlayer(data) {
    if (!data.player || !data.text) return;
    
    // 检查弹幕ID是否已存在，避免重复添加
    if (data.id) {
        const existingBullet = gameState.bullets.find(b => b.id === data.id);
        if (existingBullet) {
            console.log(`弹幕ID ${data.id} 已存在，跳过重复添加`);
            return;
        }
    }
    
    const bullet = {
        id: data.id || Date.now() + Math.random(),
        player: {
            name: data.player.name,
            avatarUrl: data.player.avatarUrl || ''
        },
        text: data.text,
        x: elements.gameCanvas.width + 100, // 从右侧开始（向左移动）
        y: Math.random() * (elements.gameCanvas.height - 200) + 100,
        width: 0, // 将在绘制时计算
        height: CONFIG.BULLET.HEIGHT
    };
    
    gameState.bullets.push(bullet);
    console.log(`收到玩家 ${data.player.name} 的弹幕: ${data.text}`);
}

// BOSS移动
function updateBoss() {
    if (!gameState.boss.isAlive) return;
    
    // 简单的来回移动
    gameState.boss.x += gameState.boss.direction.x * CONFIG.BOSS.MOVE_SPEED;
    gameState.boss.y += gameState.boss.direction.y * CONFIG.BOSS.MOVE_SPEED * 0.5;
    
    // 边界检测
    if (gameState.boss.x <= CONFIG.BOSS.MOVE_RANGE.minX || 
        gameState.boss.x >= CONFIG.BOSS.MOVE_RANGE.maxX) {
        gameState.boss.direction.x *= -1;
    }
    
    if (gameState.boss.y <= CONFIG.BOSS.MOVE_RANGE.minY || 
        gameState.boss.y >= CONFIG.BOSS.MOVE_RANGE.maxY) {
        gameState.boss.direction.y *= -1;
    }
}

// 碰撞检测（圆形BOSS与矩形弹幕）
function checkCollision(bullet, boss) {
    // BOSS是圆形，半径为 CONFIG.BOSS.SIZE / 2
    const bossRadius = CONFIG.BOSS.SIZE / 2;
    const bossCenterX = boss.x;
    const bossCenterY = boss.y;
    
    // 弹幕是矩形
    const bulletLeft = bullet.x;
    const bulletRight = bullet.x + bullet.width;
    const bulletTop = bullet.y;
    const bulletBottom = bullet.y + bullet.height;
    
    // 找到矩形上距离圆心最近的点
    let closestX = Math.max(bulletLeft, Math.min(bossCenterX, bulletRight));
    let closestY = Math.max(bulletTop, Math.min(bossCenterY, bulletBottom));
    
    // 计算最近点到圆心的距离
    const dx = bossCenterX - closestX;
    const dy = bossCenterY - closestY;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // 如果距离小于等于圆的半径，则发生碰撞
    return distance <= bossRadius;
}

// 伤害计算
function calculateDamage() {
    const isCritical = Math.random() < CONFIG.BULLET.CRITICAL_RATE;
    const damage = isCritical 
        ? CONFIG.BULLET.BASE_DAMAGE * CONFIG.BULLET.CRITICAL_MULTIPLIER
        : CONFIG.BULLET.BASE_DAMAGE;
    
    return { damage, isCritical };
}

// 更新弹幕
function updateBullets() {
    for (let i = gameState.bullets.length - 1; i >= 0; i--) {
        const bullet = gameState.bullets[i];
        
        // 移动弹幕（向左移动）
        bullet.x -= CONFIG.BULLET.SPEED;
        
        // 检查是否超出屏幕（从左侧出去）
        if (bullet.x + bullet.width < -100) {
            gameState.bullets.splice(i, 1);
            continue;
        }
        
        // 碰撞检测
        if (gameState.boss.isAlive && checkCollision(bullet, gameState.boss)) {
            // 计算伤害
            const { damage, isCritical } = calculateDamage();
            
            // 记录统计数据
            recordDamage(bullet.player.name, damage, isCritical);
            
            // 创建打击效果和伤害数字
            createHitEffect(bullet.x, bullet.y, isCritical);
            createDamageNumber(gameState.boss.x, gameState.boss.y - CONFIG.BOSS.SIZE / 2, damage, isCritical);
            
            // 扣除BOSS血量
            gameState.boss.hp = Math.max(0, gameState.boss.hp - damage);
            
            // 记录最后一击
            if (gameState.boss.hp <= 0) {
                gameState.boss.isAlive = false;
                gameState.lastHitPlayer = {
                    name: bullet.player.name,
                    avatarUrl: bullet.player.avatarUrl
                };
                gameState.isGameOver = true;
            }
            
            // 添加战斗日志
            addBattleLog(bullet.player.name, damage, isCritical);
            
            // 移除弹幕
            gameState.bullets.splice(i, 1);
        }
    }
}

// 创建打击效果（增强版）
function createHitEffect(x, y, isCritical) {
    const particleCount = isCritical ? 50 : 25; // 增加粒子数量
    const effectDuration = isCritical ? 60 : 35; // 增加持续时间
    
    for (let i = 0; i < particleCount; i++) {
        const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.5;
        const speed = isCritical ? 4 + Math.random() * 4 : 2.5 + Math.random() * 2.5;
        
        gameState.hitEffects.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: effectDuration,
            maxLife: effectDuration,
            size: isCritical ? 6 + Math.random() * 5 : 3 + Math.random() * 3, // 增大粒子尺寸
            isCritical: isCritical,
            color: isCritical ? '#ffd700' : '#ff6b6b'
        });
    }
    
    // 暴击时添加额外的闪光效果
    if (isCritical) {
        for (let i = 0; i < 20; i++) {
            gameState.hitEffects.push({
                x: x + (Math.random() - 0.5) * 40,
                y: y + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 5,
                vy: (Math.random() - 0.5) * 5,
                life: 40,
                maxLife: 40,
                size: 8 + Math.random() * 6,
                isCritical: true,
                color: '#ffffff'
            });
        }
    }
}

// 创建伤害数字（停留时间翻倍）
function createDamageNumber(x, y, damage, isCritical) {
    gameState.damageNumbers.push({
        x: x + (Math.random() - 0.5) * 60, // 随机位置
        y: y,
        vx: (Math.random() - 0.5) * 2,
        vy: -3 - Math.random() * 2, // 向上飞
        damage: damage,
        life: 120, // 120帧（翻倍）
        maxLife: 120,
        isCritical: isCritical,
        scale: isCritical ? 1.5 : 1.0
    });
}

// 更新打击效果
function updateHitEffects() {
    for (let i = gameState.hitEffects.length - 1; i >= 0; i--) {
        const effect = gameState.hitEffects[i];
        
        effect.x += effect.vx;
        effect.y += effect.vy;
        effect.vx *= 0.95; // 减速
        effect.vy *= 0.95;
        effect.life--;
        
        if (effect.life <= 0) {
            gameState.hitEffects.splice(i, 1);
        }
    }
}

// 更新伤害数字
function updateDamageNumbers() {
    for (let i = gameState.damageNumbers.length - 1; i >= 0; i--) {
        const number = gameState.damageNumbers[i];
        
        number.x += number.vx;
        number.y += number.vy;
        number.vy += 0.15; // 重力效果
        number.life--;
        
        if (number.life <= 0) {
            gameState.damageNumbers.splice(i, 1);
        }
    }
}

// 绘制打击效果
function drawHitEffects() {
    gameState.hitEffects.forEach(effect => {
        const alpha = effect.life / effect.maxLife;
        
        ctx.save();
        ctx.globalAlpha = alpha;
        
        if (effect.isCritical) {
            // 暴击时绘制闪光效果
            const gradient = ctx.createRadialGradient(
                effect.x, effect.y, 0,
                effect.x, effect.y, effect.size * 3
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, '#ffd700');
            gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(effect.x, effect.y, effect.size * 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // 绘制粒子
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    });
}

// 绘制伤害数字
function drawDamageNumbers() {
    gameState.damageNumbers.forEach(number => {
        const alpha = Math.min(1, number.life / 30); // 前半段渐入，后半段渐出
        const progress = (number.maxLife - number.life) / number.maxLife;
        const scale = number.scale * (1 + progress * 0.5); // 逐渐放大
        
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(number.x, number.y);
        ctx.scale(scale, scale);
        
        // 绘制阴影
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = number.isCritical ? 'bold 36px Arial' : 'bold 28px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`-${number.damage}`, 2, 2);
        
        // 绘制数字
        if (number.isCritical) {
            // 暴击：金色渐变 + 描边
            const gradient = ctx.createLinearGradient(-50, 0, 50, 0);
            gradient.addColorStop(0, '#ffd700');
            gradient.addColorStop(0.5, '#ffed4e');
            gradient.addColorStop(1, '#ff6b6b');
            ctx.fillStyle = gradient;
            
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.strokeText(`-${number.damage}`, 0, 0);
        } else {
            // 普通：白色
            ctx.fillStyle = '#ffffff';
        }
        
        ctx.fillText(`-${number.damage}`, 0, 0);
        
        // 暴击时添加额外的"CRITICAL!"文字
        if (number.isCritical && progress < 0.5) {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 20px Arial';
            ctx.fillText('CRITICAL!', 0, -30);
        }
        
        ctx.restore();
    });
}

// 添加战斗日志
function addBattleLog(playerName, damage, isCritical) {
    const logItem = document.createElement('div');
    logItem.className = `battle-log-item ${isCritical ? 'critical' : ''}`;
    const criticalText = isCritical ? '💥 暴击！' : '';
    logItem.textContent = `${playerName} 对BOSS造成 ${damage} 点伤害 ${criticalText}`;
    
    elements.battleLog.insertBefore(logItem, elements.battleLog.firstChild);
    
    // 限制日志数量
    while (elements.battleLog.children.length > 20) {
        elements.battleLog.removeChild(elements.battleLog.lastChild);
    }
}

// 绘制游戏
function draw() {
    // 清空画布
    ctx.clearRect(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
    
    // 绘制背景网格（可选）
    drawBackground();
    
    // 绘制BOSS
    if (gameState.boss.isAlive) {
        drawBoss();
    }
    
    // 绘制打击效果（在BOSS下方）
    drawHitEffects();
    
    // 绘制弹幕
    drawBullets();
    
    // 绘制伤害数字（在最上层）
    drawDamageNumbers();
    
    // 更新血量显示
    updateHPDisplay();
}

// 绘制背景
function drawBackground() {
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, elements.gameCanvas.width, elements.gameCanvas.height);
    
    // 绘制网格线
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < elements.gameCanvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, elements.gameCanvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < elements.gameCanvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(elements.gameCanvas.width, y);
        ctx.stroke();
    }
}

// 绘制BOSS
function drawBoss() {
    const boss = gameState.boss;
    const size = CONFIG.BOSS.SIZE;
    
    // 更新闪烁计时器
    if (boss.flashTimer > 0) {
        boss.flashTimer--;
    }
    
    // 如果有闪烁效果，添加闪光覆盖层
    if (boss.flashTimer > 0) {
        const flashAlpha = (boss.flashTimer / 10) * 0.5;
        ctx.save();
        ctx.globalAlpha = flashAlpha;
        
        // 绘制闪光效果（金色光晕）
        const gradient = ctx.createRadialGradient(
            boss.x, boss.y, 0,
            boss.x, boss.y, size
        );
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.3, '#ffd700');
        gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(boss.x, boss.y, size, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    // 如果有上传的BOSS图片，使用图片
    if (CONFIG.BOSS.IMAGE_URL) {
        const img = loadImage(CONFIG.BOSS.IMAGE_URL);
        
        if (img.complete && img.naturalWidth > 0) {
            // 绘制BOSS图片，裁剪成圆形
            ctx.save();
            
            // 创建圆形裁剪路径
            ctx.beginPath();
            ctx.arc(boss.x, boss.y, size / 2, 0, Math.PI * 2);
            ctx.clip();
            
            // 闪烁时调整亮度
            if (boss.flashTimer > 0) {
                ctx.filter = 'brightness(1.5)';
            }
            
            // 绘制图片，按比例缩放适应设定尺寸
            ctx.drawImage(img, 
                boss.x - size / 2, 
                boss.y - size / 2, 
                size, 
                size
            );
            
            ctx.restore();
            
            // 绘制圆形边框（可选，用于视觉确认）
            ctx.strokeStyle = boss.flashTimer > 0 ? '#ffffff' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = boss.flashTimer > 0 ? 5 : 3;
            ctx.beginPath();
            ctx.arc(boss.x, boss.y, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // 图片未加载完成，绘制占位符
            drawBossPlaceholder();
        }
    } else {
        // 没有图片，绘制默认BOSS
        drawBossPlaceholder();
    }
    
    // BOSS文字（始终显示）
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 32px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('BOSS', boss.x, boss.y + size / 2 + 30);
}

// 绘制默认BOSS占位符
function drawBossPlaceholder() {
    const boss = gameState.boss;
    
    // 闪烁时改变颜色
    const flashColor = boss.flashTimer > 0 ? '#ffd700' : '#ff6b6b';
    const flashColor2 = boss.flashTimer > 0 ? '#ffed4e' : '#c92a2a';
    
    // BOSS主体（圆形）
    const gradient = ctx.createRadialGradient(
        boss.x, boss.y, 0,
        boss.x, boss.y, CONFIG.BOSS.SIZE / 2
    );
    gradient.addColorStop(0, flashColor);
    gradient.addColorStop(1, flashColor2);
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(boss.x, boss.y, CONFIG.BOSS.SIZE / 2, 0, Math.PI * 2);
    ctx.fill();
    
    // BOSS边框
    ctx.strokeStyle = boss.flashTimer > 0 ? '#ffffff' : '#fff';
    ctx.lineWidth = boss.flashTimer > 0 ? 5 : 3;
    ctx.stroke();
    
    // BOSS眼睛（按比例放大）
    const eyeSize = CONFIG.BOSS.SIZE * 0.1;
    const eyeOffsetX = CONFIG.BOSS.SIZE * 0.15;
    const eyeOffsetY = CONFIG.BOSS.SIZE * 0.1;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(boss.x - eyeOffsetX, boss.y - eyeOffsetY, eyeSize, 0, Math.PI * 2);
    ctx.arc(boss.x + eyeOffsetX, boss.y - eyeOffsetY, eyeSize, 0, Math.PI * 2);
    ctx.fill();
    
    // BOSS瞳孔
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(boss.x - eyeOffsetX, boss.y - eyeOffsetY, eyeSize / 2, 0, Math.PI * 2);
    ctx.arc(boss.x + eyeOffsetX, boss.y - eyeOffsetY, eyeSize / 2, 0, Math.PI * 2);
    ctx.fill();
}

// 绘制弹幕
function drawBullets() {
    gameState.bullets.forEach(bullet => {
        // 计算弹幕宽度（根据文字长度）
        ctx.font = '18px Arial'; // 使用与绘制时相同的字体大小
        const textMetrics = ctx.measureText(`${bullet.player.name}: ${bullet.text}`);
        bullet.width = textMetrics.width + 80; // 加上头像和边距
        
        // 绘制弹幕背景
        const x = bullet.x;
        const y = bullet.y;
        const width = bullet.width;
        const height = bullet.height;
        const radius = height / 2;
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arc(x + width - radius, y + radius, radius, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(x + radius, y + height);
        ctx.arc(x + radius, y + radius, radius, Math.PI / 2, -Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        
        // 绘制边框
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 绘制头像
        if (bullet.player.avatarUrl) {
            const avatarSize = height - 12; // 增大头像尺寸
            const avatarX = x + 6;
            const avatarY = y + 6;
            const avatarCenterX = avatarX + avatarSize / 2;
            const avatarCenterY = avatarY + avatarSize / 2;
            
            const img = loadImage(bullet.player.avatarUrl);
            
            // 如果图片已加载，绘制圆形头像
            if (img.complete && img.naturalWidth > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
                
                // 绘制头像边框
                ctx.strokeStyle = '#667eea';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // 图片未加载完成，绘制占位符
                ctx.fillStyle = '#ddd';
                ctx.beginPath();
                ctx.arc(avatarCenterX, avatarCenterY, avatarSize / 2, 0, Math.PI * 2);
                ctx.fill();
            }
        }
        
        // 绘制文字
        ctx.fillStyle = '#333';
        ctx.font = 'bold 18px Arial'; // 增大字体
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        const textX = x + (bullet.player.avatarUrl ? 70 : 15);
        ctx.fillText(`${bullet.player.name}:`, textX, y + height / 2);
        
        ctx.fillStyle = '#666';
        ctx.font = '18px Arial'; // 增大字体
        const nameWidth = ctx.measureText(`${bullet.player.name}: `).width;
        ctx.fillText(bullet.text, textX + nameWidth, y + height / 2);
    });
}

// 更新血量显示
function updateHPDisplay() {
    const hpPercent = (gameState.boss.hp / gameState.boss.maxHp) * 100;
    elements.hpBar.style.width = `${hpPercent}%`;
    elements.currentHP.textContent = Math.max(0, Math.floor(gameState.boss.hp));
    elements.maxHP.textContent = gameState.boss.maxHp;
    
    // 血量颜色变化
    if (hpPercent > 50) {
        elements.hpBar.style.background = 'linear-gradient(90deg, #51cf66 0%, #40c057 100%)';
    } else if (hpPercent > 25) {
        elements.hpBar.style.background = 'linear-gradient(90deg, #ffd43b 0%, #fcc419 100%)';
    } else {
        elements.hpBar.style.background = 'linear-gradient(90deg, #ff6b6b 0%, #ee5a6f 100%)';
    }
}

// 显示击杀者
function showKiller() {
    if (!gameState.lastHitPlayer) return;
    
    elements.killerAvatar.src = gameState.lastHitPlayer.avatarUrl;
    elements.killerName.textContent = gameState.lastHitPlayer.name;
    elements.killerDisplay.style.display = 'flex';
}

// 游戏主循环
function gameLoop() {
    if (!gameState.isGameOver) {
        updateBoss();
        updateBullets();
        updateHitEffects();
        updateDamageNumbers();
    } else if (gameState.lastHitPlayer && elements.killerDisplay.style.display === 'none') {
        showKiller();
    } else if (gameState.isGameOver) {
        // 游戏结束后继续更新效果
        updateHitEffects();
        updateDamageNumbers();
    }
    
    draw();
    requestAnimationFrame(gameLoop);
}

// 启动游戏
function startGame() {
    // 初始化BOSS血量
    gameState.boss.hp = CONFIG.BOSS.INITIAL_HP;
    gameState.boss.maxHp = CONFIG.BOSS.MAX_HP;
    gameState.boss.isAlive = true;
    gameState.boss.x = elements.gameCanvas.width / 2;
    gameState.boss.y = elements.gameCanvas.height / 2;
    gameState.boss.flashTimer = 0;
    
    // 更新血量显示
    updateHPDisplay();
    
    gameLoop();
}

// 再来一次（重置游戏时也会重新读取默认配置）
elements.playAgain.addEventListener('click', async () => {
    // 重新加载配置文件，使用文件中的默认配置来重置游戏
    await loadDefaultConfigFromFile();
    const defaultConfig = getDefaultConfig();
    
    // 使用文件中的默认配置重置游戏配置
    CONFIG.BOSS.INITIAL_HP = defaultConfig.BOSS.INITIAL_HP;
    CONFIG.BOSS.MAX_HP = defaultConfig.BOSS.MAX_HP;
    CONFIG.BOSS.SIZE = defaultConfig.BOSS.SIZE;
    CONFIG.BOSS.MOVE_SPEED = defaultConfig.BOSS.MOVE_SPEED;
    CONFIG.BOSS.MOVE_RANGE = defaultConfig.BOSS.MOVE_RANGE;
    
    CONFIG.BULLET.SPEED = defaultConfig.BULLET.SPEED;
    CONFIG.BULLET.HEIGHT = defaultConfig.BULLET.HEIGHT;
    CONFIG.BULLET.BASE_DAMAGE = defaultConfig.BULLET.BASE_DAMAGE;
    CONFIG.BULLET.CRITICAL_RATE = defaultConfig.BULLET.CRITICAL_RATE;
    CONFIG.BULLET.CRITICAL_MULTIPLIER = defaultConfig.BULLET.CRITICAL_MULTIPLIER;
    
    // 重置游戏状态
    gameState.boss = {
        x: elements.gameCanvas.width / 2,
        y: elements.gameCanvas.height / 2,
        hp: CONFIG.BOSS.INITIAL_HP,
        maxHp: CONFIG.BOSS.MAX_HP,
        direction: { x: 1, y: 1 },
        isAlive: true,
        flashTimer: 0
    };
    gameState.bullets = [];
    gameState.lastHitPlayer = null;
    gameState.isGameOver = false;
    gameState.battleLog = [];
    gameState.hitEffects = [];
    gameState.damageNumbers = [];
    
    // 清空战斗日志
    elements.battleLog.innerHTML = '';
    
    // 隐藏击杀者展示
    elements.killerDisplay.style.display = 'none';
    
    // 更新血量显示
    updateHPDisplay();
});

// ============ 配置面板相关功能 ============

// 加载配置到输入框
function loadConfigToUI() {
    elements.bossHP.value = CONFIG.BOSS.INITIAL_HP;
    elements.bossSpeed.value = CONFIG.BOSS.MOVE_SPEED;
    elements.bulletDamage.value = CONFIG.BULLET.BASE_DAMAGE;
    elements.bulletSpeed.value = CONFIG.BULLET.SPEED;
    elements.criticalRate.value = Math.round(CONFIG.BULLET.CRITICAL_RATE * 100);
    elements.criticalMultiplier.value = CONFIG.BULLET.CRITICAL_MULTIPLIER;
    
    // 加载BOSS图片
    if (CONFIG.BOSS.IMAGE_URL) {
        elements.bossImagePreview.src = CONFIG.BOSS.IMAGE_URL;
        elements.bossImagePreview.style.display = 'block';
        document.querySelector('.boss-image-placeholder').style.display = 'none';
    } else {
        elements.bossImagePreview.style.display = 'none';
        document.querySelector('.boss-image-placeholder').style.display = 'block';
    }
}

// 应用配置到游戏
function applyConfig() {
    // 更新BOSS配置
    CONFIG.BOSS.INITIAL_HP = parseInt(elements.bossHP.value);
    CONFIG.BOSS.MAX_HP = parseInt(elements.bossHP.value);
    CONFIG.BOSS.MOVE_SPEED = parseFloat(elements.bossSpeed.value);
    
    // 更新弹幕配置
    CONFIG.BULLET.BASE_DAMAGE = parseInt(elements.bulletDamage.value);
    CONFIG.BULLET.SPEED = parseFloat(elements.bulletSpeed.value);
    CONFIG.BULLET.CRITICAL_RATE = parseFloat(elements.criticalRate.value) / 100;
    CONFIG.BULLET.CRITICAL_MULTIPLIER = parseFloat(elements.criticalMultiplier.value);
    
    // 如果游戏正在运行，更新BOSS血量
    if (elements.gameArea.style.display !== 'none') {
        const currentHpPercent = gameState.boss.hp / gameState.boss.maxHp;
        gameState.boss.hp = Math.floor(CONFIG.BOSS.MAX_HP * currentHpPercent);
        gameState.boss.maxHp = CONFIG.BOSS.MAX_HP;
        updateHPDisplay();
    }
}

// 打开配置面板
elements.openConfigBtn.addEventListener('click', () => {
    loadConfigToUI();
    updateStatsDisplay(); // 更新统计数据
    elements.configPanel.style.display = 'flex';
});

// 关闭配置面板
elements.closeConfigBtn.addEventListener('click', () => {
    elements.configPanel.style.display = 'none';
});

// 点击配置面板外部关闭
elements.configPanel.addEventListener('click', (e) => {
    if (e.target === elements.configPanel) {
        elements.configPanel.style.display = 'none';
    }
});

// BOSS图片上传
elements.uploadBossImageBtn.addEventListener('click', () => {
    elements.bossImageInput.click();
});

elements.bossImageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
            CONFIG.BOSS.IMAGE_URL = event.target.result;
            elements.bossImagePreview.src = event.target.result;
            elements.bossImagePreview.style.display = 'block';
            document.querySelector('.boss-image-placeholder').style.display = 'none';
            
            // 预加载图片
            loadImage(event.target.result);
            
            // BOSS图片变更时增加版本号
            incrementVersion();
        };
        reader.readAsDataURL(file);
    }
});

// 保存配置
elements.saveConfigBtn.addEventListener('click', () => {
    applyConfig();
    incrementVersion(); // 配置变更时增加版本号
    alert('配置已保存！版本号已更新：' + getVersionString());
    elements.configPanel.style.display = 'none';
});

// 重置配置（从文件读取默认配置）
elements.resetConfigBtn.addEventListener('click', async () => {
    if (confirm('确定要重置为默认配置吗？')) {
        // 重新加载配置文件
        await loadDefaultConfigFromFile();
        
        // 使用默认配置（优先使用文件配置）
        const defaultConfig = getDefaultConfig();
        
        CONFIG.BOSS.INITIAL_HP = defaultConfig.BOSS.INITIAL_HP;
        CONFIG.BOSS.MAX_HP = defaultConfig.BOSS.MAX_HP;
        CONFIG.BOSS.SIZE = defaultConfig.BOSS.SIZE;
        CONFIG.BOSS.MOVE_SPEED = defaultConfig.BOSS.MOVE_SPEED;
        CONFIG.BOSS.MOVE_RANGE = defaultConfig.BOSS.MOVE_RANGE;
        CONFIG.BOSS.IMAGE_URL = defaultConfig.BOSS.IMAGE_URL || null;
        
        CONFIG.BULLET.SPEED = defaultConfig.BULLET.SPEED;
        CONFIG.BULLET.HEIGHT = defaultConfig.BULLET.HEIGHT;
        CONFIG.BULLET.BASE_DAMAGE = defaultConfig.BULLET.BASE_DAMAGE;
        CONFIG.BULLET.CRITICAL_RATE = defaultConfig.BULLET.CRITICAL_RATE;
        CONFIG.BULLET.CRITICAL_MULTIPLIER = defaultConfig.BULLET.CRITICAL_MULTIPLIER;
        
        loadConfigToUI();
        applyConfig();
        incrementVersion(); // 配置变更时增加版本号
        
        const source = loadedDefaultConfig ? '配置文件' : '内置默认配置';
        alert(`已重置为默认配置（来源：${source}）！版本号已更新：${getVersionString()}`);
    }
});

// ============ 版本号管理 ============

// 当前版本号（默认值，如果无法从文件加载则使用此值）
// 从version.json同步：{"version":"1.0.0.0","lastUpdated":"2024-01-01T00:00:00Z"}
let currentVersion = { major: 1, minor: 0, patch: 0, build: 0 };

// 版本号存储键名
const VERSION_STORAGE_KEY = 'game_version_info';
const VERSION_LOCAL_BUILD_KEY = 'game_version_local_build';

// 从文件加载版本号
async function loadVersionFromFile() {
    // 检测是否使用file://协议
    const isFileProtocol = window.location.protocol === 'file:';
    
    if (isFileProtocol) {
        // 使用file://协议时，使用默认版本号
        console.log('ℹ️ 使用file://协议，使用默认版本号');
        updateVersionDisplay();
        return false;
    }
    
    try {
        const response = await fetch('version.json');
        if (!response.ok) {
            throw new Error('版本文件加载失败');
        }
        const versionData = await response.json();
        
        if (versionData && versionData.version) {
            const parts = versionData.version.split('.');
            if (parts.length === 4) {
                currentVersion = {
                    major: parseInt(parts[0]) || 1,
                    minor: parseInt(parts[1]) || 0,
                    patch: parseInt(parts[2]) || 0,
                    build: parseInt(parts[3]) || 0
                };
                
                // 检查本地是否有额外的构建号
                const localBuild = localStorage.getItem(VERSION_LOCAL_BUILD_KEY);
                if (localBuild) {
                    const localBuildNum = parseInt(localBuild);
                    if (localBuildNum > currentVersion.build) {
                        currentVersion.build = localBuildNum;
                    }
                }
                
                updateVersionDisplay();
                console.log('版本号加载成功:', getVersionString());
                return true;
            }
        }
        throw new Error('版本号格式错误');
    } catch (error) {
        console.warn('无法加载版本文件，使用默认版本号:', error.message);
        // 尝试从LocalStorage恢复
        const savedVersion = localStorage.getItem(VERSION_STORAGE_KEY);
        if (savedVersion) {
            try {
                currentVersion = JSON.parse(savedVersion);
                updateVersionDisplay();
                return true;
            } catch (e) {
                console.warn('无法从LocalStorage恢复版本号');
            }
        }
        return false;
    }
}

// 增加版本号（最后一位）
function incrementVersion() {
    currentVersion.build++;
    
    // 检查最大值
    if (currentVersion.build > 99999) {
        currentVersion.build = 0;
        currentVersion.patch++;
        
        if (currentVersion.patch > 999) {
            currentVersion.patch = 0;
            currentVersion.minor++;
            
            if (currentVersion.minor > 999) {
                currentVersion.minor = 0;
                currentVersion.major++;
            }
        }
    }
    
    // 保存到LocalStorage
    localStorage.setItem(VERSION_STORAGE_KEY, JSON.stringify(currentVersion));
    localStorage.setItem(VERSION_LOCAL_BUILD_KEY, currentVersion.build.toString());
    
    updateVersionDisplay();
    console.log('版本号已更新:', getVersionString());
    
    return getVersionString();
}

// 获取版本号字符串
function getVersionString() {
    return `${currentVersion.major}.${currentVersion.minor}.${currentVersion.patch}.${currentVersion.build}`;
}

// 更新版本号显示
function updateVersionDisplay() {
    if (elements.versionNumber) {
        elements.versionNumber.textContent = getVersionString();
    }
}

// 初始化统计数据
initStats();

// 清空统计数据按钮
if (elements.clearStatsBtn) {
    elements.clearStatsBtn.addEventListener('click', () => {
        if (confirm('确定要清空所有统计数据吗？此操作不可恢复！')) {
            clearStats();
            alert('统计数据已清空！');
        }
    });
}

// 初始化：加载默认配置文件并在启动时使用
(async function initializeConfig() {
    const loaded = await loadDefaultConfigFromFile();
    if (loaded && loadedDefaultConfig) {
        // 如果成功加载了配置文件，使用文件配置来初始化CONFIG
        const defaultConfig = getDefaultConfig();
        CONFIG.BOSS.INITIAL_HP = defaultConfig.BOSS.INITIAL_HP;
        CONFIG.BOSS.MAX_HP = defaultConfig.BOSS.MAX_HP;
        CONFIG.BOSS.SIZE = defaultConfig.BOSS.SIZE;
        CONFIG.BOSS.MOVE_SPEED = defaultConfig.BOSS.MOVE_SPEED;
        CONFIG.BOSS.MOVE_RANGE = defaultConfig.BOSS.MOVE_RANGE;
        CONFIG.BOSS.IMAGE_URL = defaultConfig.BOSS.IMAGE_URL || null;
        
        CONFIG.BULLET.SPEED = defaultConfig.BULLET.SPEED;
        CONFIG.BULLET.HEIGHT = defaultConfig.BULLET.HEIGHT;
        CONFIG.BULLET.BASE_DAMAGE = defaultConfig.BULLET.BASE_DAMAGE;
        CONFIG.BULLET.CRITICAL_RATE = defaultConfig.BULLET.CRITICAL_RATE;
        CONFIG.BULLET.CRITICAL_MULTIPLIER = defaultConfig.BULLET.CRITICAL_MULTIPLIER;
        
        // 立即更新UI中的默认值（如果配置面板可见）
        loadConfigToUI();
        
        console.log('配置加载完成，已使用文件配置初始化:', CONFIG.BOSS.INITIAL_HP);
    } else {
        // 使用内置默认配置时也要更新UI
        loadConfigToUI();
        console.log('配置加载完成，使用内置默认配置');
    }
})();

// 加载版本号
loadVersionFromFile().then(() => {
    console.log('版本号加载完成');
});

// ============ WebSocket连接 ============
function connectWebSocket() {
    const serverUrl = getWebSocketUrl();
    
    if (!serverUrl) {
        console.warn('⚠️ WebSocket服务器地址未配置');
        console.warn('请通过URL参数指定服务器地址，例如：?ws=wss://your-server.railway.app');
        console.warn('或者在代码中配置生产环境服务器地址');
        return; // 不连接，游戏将在单机模式下运行
    }
    
    console.log('正在连接到WebSocket服务器:', serverUrl);
    
    try {
        ws = new WebSocket(serverUrl);
        
        ws.onopen = () => {
            console.log('已连接到WebSocket服务器');
            wsConnected = true;
            
            // 发送玩家信息
            if (gameState.player.name) {
                ws.send(JSON.stringify({
                    type: 'playerInfo',
                    playerName: gameState.player.name,
                    avatarUrl: gameState.player.avatarUrl
                }));
            }
        };
        
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                
                switch (data.type) {
                    case 'bullet':
                        // 接收弹幕（使用ID去重，避免重复添加）
                        // 注意：即使是自己的弹幕，服务器也会广播回来，但通过ID去重不会重复添加
                        if (data.player && data.text) {
                            receiveBulletFromPlayer(data);
                        }
                        break;
                        
                    case 'damage':
                        // 接收其他玩家造成的伤害（仅显示日志，不重复计算）
                        if (data.player && data.player.name !== gameState.player.name) {
                            addBattleLog(data.player.name, data.damage, data.isCritical);
                            // 同步BOSS血量（如果不同）
                            if (data.bossHP !== undefined && data.bossHP < gameState.boss.hp) {
                                gameState.boss.hp = data.bossHP;
                            }
                        }
                        break;
                        
                    case 'bossState':
                        // 接收BOSS状态更新（如果需要）
                        if (data.boss) {
                            gameState.boss.x = data.boss.x || gameState.boss.x;
                            gameState.boss.y = data.boss.y || gameState.boss.y;
                        }
                        break;
                        
                    case 'gameReset':
                        // 游戏重置
                        if (confirm('其他玩家已重置游戏，是否同步？')) {
                            location.reload();
                        }
                        break;
                }
            } catch (error) {
                console.error('消息解析错误:', error);
            }
        };
        
        ws.onerror = (error) => {
            console.error('WebSocket错误:', error);
            wsConnected = false;
        };
        
        ws.onclose = () => {
            console.log('WebSocket连接已关闭');
            wsConnected = false;
            // 尝试重连（可选）
            // setTimeout(connectWebSocket, 3000);
        };
    } catch (error) {
        console.warn('WebSocket连接失败:', error.message);
        console.warn('游戏将在单机模式下运行');
    }
}

// 启动游戏时连接WebSocket（延迟连接，等待玩家设置完成）
elements.confirmSetup.addEventListener('click', () => {
    // 原有的设置代码...
    // 然后连接WebSocket
    setTimeout(() => {
        connectWebSocket();
    }, 500);
}, { once: false });

// 页面卸载时断开连接
window.addEventListener('beforeunload', () => {
    if (ws) {
        ws.close();
    }
});

// 初始化Canvas
initCanvas();
