/* PersonaHire Ultimate - Token监控模块 */
/* 详细日志记录 + 使用统计 + 成本分析 */

// =============== 日志存储 ===============

// 内存中的日志存储（会话期间）
let tokenLogs = [];
let dailyStats = {};
let liveLogDisplay = [];

// 本地存储键名
const STORAGE_KEYS = {
    TOKEN_LOGS: 'personahire_token_logs',
    DAILY_STATS: 'personahire_daily_stats',
    USAGE_SETTINGS: 'personahire_usage_settings'
};

// =============== 日志记录功能 ===============

/**
 * 记录API调用详情
 * @param {string} apiType - API类型 (gpt-4.1, tts-1, tts-1-hd, elevenlabs)
 * @param {number} inputTokens - 输入Token数量
 * @param {number} outputTokens - 输出Token数量  
 * @param {number} cost - 本次调用成本
 * @param {number} responseTime - 响应时间(ms)
 * @param {Object} metadata - 额外元数据
 */
function logApiCall(apiType, inputTokens = 0, outputTokens = 0, cost = 0, responseTime = 0, metadata = {}) {
    const timestamp = new Date();
    const logEntry = {
        id: `log_${timestamp.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: timestamp.toISOString(),
        date: timestamp.toISOString().split('T')[0], // YYYY-MM-DD格式
        time: timestamp.toLocaleTimeString('zh-CN'),
        apiType: apiType,
        inputTokens: inputTokens,
        outputTokens: outputTokens,
        totalTokens: inputTokens + outputTokens,
        cost: cost,
        responseTime: responseTime,
        sessionId: currentSessionId,
        metadata: metadata
    };
    
    console.log('📊 Logging API call:', logEntry);
    
    // 添加到内存日志
    tokenLogs.push(logEntry);
    
    // 添加到实时显示日志（最多保留50条）
    liveLogDisplay.unshift(logEntry);
    if (liveLogDisplay.length > 50) {
        liveLogDisplay.pop();
    }
    
    // 保存到本地存储
    saveLogToStorage(logEntry);
    
    // 更新统计数据
    updateUsageStats(inputTokens + outputTokens, responseTime, cost);
    updateDailyStats(logEntry);
    
    // 更新UI显示
    if (isDeveloperMode) {
        updateLiveLogDisplay();
        updateStatsDisplay();
    }
}

/**
 * 保存日志到本地存储
 * @param {Object} logEntry - 日志条目
 */
function saveLogToStorage(logEntry) {
    try {
        // 获取现有日志
        const existingLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOKEN_LOGS) || '[]');
        
        // 添加新日志
        existingLogs.push(logEntry);
        
        // 保持最多1000条记录
        if (existingLogs.length > 1000) {
            existingLogs.splice(0, existingLogs.length - 1000);
        }
        
        // 保存回本地存储
        localStorage.setItem(STORAGE_KEYS.TOKEN_LOGS, JSON.stringify(existingLogs));
        
        console.log('💾 Log saved to localStorage');
    } catch (error) {
        console.error('❌ Failed to save log to storage:', error);
    }
}

/**
 * 从本地存储加载历史日志
 */
function loadLogsFromStorage() {
    try {
        const storedLogs = JSON.parse(localStorage.getItem(STORAGE_KEYS.TOKEN_LOGS) || '[]');
        tokenLogs = storedLogs;
        
        // 加载最近的日志到实时显示
        liveLogDisplay = storedLogs.slice(-50).reverse();
        
        console.log(`📚 Loaded ${storedLogs.length} logs from storage`);
        return storedLogs;
    } catch (error) {
        console.error('❌ Failed to load logs from storage:', error);
        return [];
    }
}

// =============== 统计数据管理 ===============

/**
 * 更新使用统计（兼容现有代码）
 * @param {number} tokensUsed - Token使用量
 * @param {number} responseTime - 响应时间
 * @param {number} cost - 成本
 */
function updateUsageStats(tokensUsed, responseTime, cost = 0) {
    apiCallCount++;
    totalTokensUsed += tokensUsed;
    responseTimes.push(responseTime);
    
    // 只有在开发者模式且元素存在时才更新DOM
    if (isDeveloperMode && document.getElementById('apiCallCount')) {
        document.getElementById('apiCallCount').textContent = apiCallCount;
        document.getElementById('tokenUsed').textContent = totalTokensUsed.toLocaleString();
        document.getElementById('estimatedCost').textContent = `$${calculateTotalCost().toFixed(4)}`;
        
        const avgTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
        document.getElementById('avgResponseTime').textContent = `${Math.round(avgTime)}ms`;
    }
}

/**
 * 更新每日统计
 * @param {Object} logEntry - 日志条目
 */
function updateDailyStats(logEntry) {
    const date = logEntry.date;
    
    if (!dailyStats[date]) {
        dailyStats[date] = {
            date: date,
            totalCalls: 0,
            totalTokens: 0,
            totalCost: 0,
            apiBreakdown: {},
            avgResponseTime: 0,
            responseTimes: []
        };
    }
    
    const dayStats = dailyStats[date];
    dayStats.totalCalls++;
    dayStats.totalTokens += logEntry.totalTokens;
    dayStats.totalCost += logEntry.cost;
    dayStats.responseTimes.push(logEntry.responseTime);
    dayStats.avgResponseTime = dayStats.responseTimes.reduce((a, b) => a + b, 0) / dayStats.responseTimes.length;
    
    // API类型分类统计
    if (!dayStats.apiBreakdown[logEntry.apiType]) {
        dayStats.apiBreakdown[logEntry.apiType] = {
            calls: 0,
            tokens: 0,
            cost: 0
        };
    }
    
    dayStats.apiBreakdown[logEntry.apiType].calls++;
    dayStats.apiBreakdown[logEntry.apiType].tokens += logEntry.totalTokens;
    dayStats.apiBreakdown[logEntry.apiType].cost += logEntry.cost;
    
    // 保存到本地存储
    localStorage.setItem(STORAGE_KEYS.DAILY_STATS, JSON.stringify(dailyStats));
}

/**
 * 计算总成本
 * @returns {number} 总成本
 */
function calculateTotalCost() {
    return tokenLogs.reduce((total, log) => total + log.cost, 0);
}

/**
 * 计算API调用成本
 * @param {number} inputTokens - 输入Token数
 * @param {number} outputTokens - 输出Token数
 * @param {string} model - 模型名称
 * @returns {number} 成本
 */
function calculateCost(inputTokens, outputTokens, model = 'gpt-4.1') {
    const prices = TOKEN_PRICES[model];
    if (!prices) return 0;
    
    if (typeof prices === 'object') {
        // GPT模型有输入输出不同价格
        const inputCost = (inputTokens / 1000) * prices.input;
        const outputCost = (outputTokens / 1000) * prices.output;
        return inputCost + outputCost;
    } else {
        // TTS模型按字符计费
        const totalChars = inputTokens + outputTokens;
        return (totalChars / 1000) * prices;
    }
}

// =============== UI更新函数 ===============

/**
 * 更新实时日志显示
 */
function updateLiveLogDisplay() {
    const liveLogsList = document.getElementById('liveLogsList');
    if (!liveLogsList) return;
    
    liveLogsList.innerHTML = '';
    
    liveLogDisplay.slice(0, 10).forEach(log => {
        const logElement = createLogElement(log);
        liveLogsList.appendChild(logElement);
    });
}

/**
 * 创建日志条目元素
 * @param {Object} log - 日志对象
 * @returns {HTMLElement} 日志元素
 */
function createLogElement(log) {
    const logDiv = document.createElement('div');
    logDiv.className = `log-entry ${getLogTypeClass(log.apiType)}`;
    
    const icon = getApiIcon(log.apiType);
    const tokenInfo = log.totalTokens > 0 ? `${log.inputTokens}→${log.outputTokens} tokens` : `${log.totalTokens} chars`;
    
    logDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
            <span>🕐 ${log.time} | ${icon} ${log.apiType.toUpperCase()}</span>
            <span style="font-weight: 600;">$${log.cost.toFixed(4)}</span>
        </div>
        <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
            ${tokenInfo} | ${log.responseTime}ms
        </div>
    `;
    
    return logDiv;
}

/**
 * 获取API类型对应的CSS类
 * @param {string} apiType - API类型
 * @returns {string} CSS类名
 */
function getLogTypeClass(apiType) {
    if (apiType.includes('gpt')) return 'api-call';
    if (apiType.includes('tts') || apiType.includes('elevenlabs')) return 'tts-call';
    return 'api-call';
}

/**
 * 获取API类型对应的图标
 * @param {string} apiType - API类型
 * @returns {string} 图标
 */
function getApiIcon(apiType) {
    if (apiType.includes('gpt')) return '🤖';
    if (apiType.includes('tts') || apiType.includes('elevenlabs')) return '🎵';
    return '⚡';
}

/**
 * 更新统计显示面板
 */
function updateStatsDisplay() {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = dailyStats[today];
    
    if (!todayStats) return;
    
    // 更新今日统计显示
    const todayStatsElement = document.getElementById('todayStats');
    if (todayStatsElement) {
        todayStatsElement.innerHTML = `
            <h5>📅 今日统计 (${today})</h5>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-number">${todayStats.totalCalls}</div>
                    <div class="stat-label">API调用</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${todayStats.totalTokens.toLocaleString()}</div>
                    <div class="stat-label">Token消耗</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">$${todayStats.totalCost.toFixed(4)}</div>
                    <div class="stat-label">今日成本</div>
                </div>
                <div class="stat-card">
                    <div class="stat-number">${Math.round(todayStats.avgResponseTime)}ms</div>
                    <div class="stat-label">平均响应</div>
                </div>
            </div>
        `;
    }
}

// =============== 日志查询和导出 ===============

/**
 * 获取指定时间范围的日志
 * @param {string} timeRange - 时间范围 (today, week, month, all)
 * @returns {Array} 日志数组
 */
function getLogsForTimeRange(timeRange) {
    const now = new Date();
    let startDate;
    
    switch (timeRange) {
        case 'today':
            startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            break;
        case 'week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
        default:
            return tokenLogs;
    }
    
    return tokenLogs.filter(log => new Date(log.timestamp) >= startDate);
}

/**
 * 生成日志摘要
 * @param {Array} logs - 日志数组
 * @returns {Object} 摘要信息
 */
function generateLogSummary(logs) {
    const summary = {
        totalCalls: logs.length,
        totalTokens: 0,
        totalCost: 0,
        avgResponseTime: 0,
        apiBreakdown: {},
        dateRange: {
            start: null,
            end: null
        }
    };
    
    if (logs.length === 0) return summary;
    
    // 计算总计
    const responseTimes = [];
    logs.forEach(log => {
        summary.totalTokens += log.totalTokens;
        summary.totalCost += log.cost;
        responseTimes.push(log.responseTime);
        
        // API分类统计
        if (!summary.apiBreakdown[log.apiType]) {
            summary.apiBreakdown[log.apiType] = { calls: 0, tokens: 0, cost: 0 };
        }
        summary.apiBreakdown[log.apiType].calls++;
        summary.apiBreakdown[log.apiType].tokens += log.totalTokens;
        summary.apiBreakdown[log.apiType].cost += log.cost;
    });
    
    // 计算平均响应时间
    summary.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    
    // 日期范围
    const timestamps = logs.map(log => new Date(log.timestamp));
    summary.dateRange.start = new Date(Math.min(...timestamps)).toISOString();
    summary.dateRange.end = new Date(Math.max(...timestamps)).toISOString();
    
    return summary;
}

/**
 * 导出Token使用日志
 * @param {string} timeRange - 时间范围
 * @param {string} format - 导出格式 (json, csv)
 */
function exportLogs(timeRange = 'all', format = 'json') {
    const logs = getLogsForTimeRange(timeRange);
    const summary = generateLogSummary(logs);
    
    const exportData = {
        exportInfo: {
            timestamp: new Date().toISOString(),
            timeRange: timeRange,
            format: format,
            totalRecords: logs.length
        },
        summary: summary,
        logs: logs
    };
    
    if (format === 'json') {
        downloadAsJSON(exportData, `token-logs-${timeRange}-${Date.now()}.json`);
    } else if (format === 'csv') {
        downloadAsCSV(logs, `token-logs-${timeRange}-${Date.now()}.csv`);
    }
    
    showSuccess(`✅ 已导出 ${logs.length} 条日志记录`);
}

/**
 * 下载JSON文件
 * @param {Object} data - 数据对象
 * @param {string} filename - 文件名
 */
function downloadAsJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json'
    });
    downloadBlob(blob, filename);
}

/**
 * 下载CSV文件
 * @param {Array} logs - 日志数组
 * @param {string} filename - 文件名
 */
function downloadAsCSV(logs, filename) {
    const headers = ['Timestamp', 'API Type', 'Input Tokens', 'Output Tokens', 'Total Tokens', 'Cost', 'Response Time', 'Session ID'];
    const csvContent = [
        headers.join(','),
        ...logs.map(log => [
            log.timestamp,
            log.apiType,
            log.inputTokens,
            log.outputTokens,
            log.totalTokens,
            log.cost,
            log.responseTime,
            log.sessionId
        ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    downloadBlob(blob, filename);
}

/**
 * 下载Blob对象
 * @param {Blob} blob - Blob对象
 * @param {string} filename - 文件名
 */
function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// =============== 初始化函数 ===============

/**
 * 初始化Token监控系统
 */
function initTokenMonitoring() {
    console.log('📊 Initializing token monitoring...');
    
    // 加载历史日志
    loadLogsFromStorage();
    
    // 初始化每日统计
    const storedStats = localStorage.getItem(STORAGE_KEYS.DAILY_STATS);
    if (storedStats) {
        dailyStats = JSON.parse(storedStats);
    }
    
    // 如果是开发者模式，初始化UI
    if (isDeveloperMode) {
        initTokenMonitoringUI();
    }
    
    console.log('✅ Token monitoring initialized');
}

/**
 * 初始化Token监控UI
 */
function initTokenMonitoringUI() {
    // 创建Token日志面板
    createTokenLogsPanel();
    
    // 更新显示
    updateLiveLogDisplay();
    updateStatsDisplay();
}

/**
 * 创建Token日志面板
 */
function createTokenLogsPanel() {
    const tokenLogsContainer = document.getElementById('tokenLogs');
    if (!tokenLogsContainer) return;
    
    tokenLogsContainer.innerHTML = `
        <h4>📋 Token使用日志</h4>
        
        <!-- 实时日志 -->
        <div class="live-logs">
            <h5>🔴 实时调用记录</h5>
            <div id="liveLogsList"></div>
        </div>
        
        <!-- 今日统计 -->
        <div id="todayStats" class="history-stats">
            <h5>📅 今日统计</h5>
        </div>
        
        <!-- 日志操作 -->
        <div class="detailed-logs" style="margin-top: 24px;">
            <div style="display: flex; gap: 12px; margin-bottom: 16px;">
                <select id="exportTimeRange">
                    <option value="today">今天</option>
                    <option value="week">本周</option>
                    <option value="month">本月</option>
                    <option value="all">全部</option>
                </select>
                <select id="exportFormat">
                    <option value="json">JSON格式</option>
                    <option value="csv">CSV格式</option>
                </select>
                <button onclick="exportTokenLogs()" style="background: linear-gradient(135deg, #28a745, #20c997); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                    📥 导出日志
                </button>
                <button onclick="clearTokenLogs()" style="background: linear-gradient(135deg, #dc3545, #c82333); color: white; border: none; padding: 8px 16px; border-radius: 8px; cursor: pointer;">
                    🗑️ 清空日志
                </button>
            </div>
        </div>
    `;
}

/**
 * 导出Token日志（UI调用）
 */
function exportTokenLogs() {
    const timeRange = document.getElementById('exportTimeRange')?.value || 'all';
    const format = document.getElementById('exportFormat')?.value || 'json';
    exportLogs(timeRange, format);
}

/**
 * 清空Token日志
 */
function clearTokenLogs() {
    if (confirm('确定要清空所有Token日志吗？此操作不可恢复。')) {
        tokenLogs = [];
        liveLogDisplay = [];
        dailyStats = {};
        
        localStorage.removeItem(STORAGE_KEYS.TOKEN_LOGS);
        localStorage.removeItem(STORAGE_KEYS.DAILY_STATS);
        
        // 重置统计变量
        apiCallCount = 0;
        totalTokensUsed = 0;
        responseTimes = [];
        
        // 更新UI
        if (isDeveloperMode) {
            updateLiveLogDisplay();
            updateStatsDisplay();
            updateUsageStats(0, 0, 0);
        }
        
        showSuccess('🗑️ Token日志已清空');
    }
}

// =============== 模块导出 ===============

// 确保全局可访问的函数
window.logApiCall = logApiCall;
window.updateUsageStats = updateUsageStats;
window.calculateCost = calculateCost;
window.exportLogs = exportLogs;
window.exportTokenLogs = exportTokenLogs;
window.clearTokenLogs = clearTokenLogs;
window.initTokenMonitoring = initTokenMonitoring;
window.getLogsForTimeRange = getLogsForTimeRange;
window.generateLogSummary = generateLogSummary;

console.log('📊 Token monitoring module loaded successfully');