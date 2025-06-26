// 📊 PersonaHire Ultimate - Token监控系统
// 详细的使用记录、每日统计、数据导出功能

class TokenDatabase {
    constructor() {
        this.storageKey = MONITORING_CONFIG.STORAGE_KEY;
        this.version = MONITORING_CONFIG.DATABASE_VERSION;
        this.initDatabase();
    }

    initDatabase() {
        const data = localStorage.getItem(this.storageKey);
        if (!data) {
            this.saveDatabase({
                usage_logs: [],
                daily_stats: {},
                metadata: {
                    created: new Date().toISOString(),
                    version: this.version
                }
            });
        }
    }

    getDatabase() {
        const data = localStorage.getItem(this.storageKey);
        return data ? JSON.parse(data) : null;
    }

    saveDatabase(data) {
        localStorage.setItem(this.storageKey, JSON.stringify(data));
    }

    logUsage(tokens, type = 'chat') {
        const db = this.getDatabase();
        const now = new Date();
        const timestamp = now.toISOString();
        const dateKey = now.toISOString().split('T')[0];
        const cost = Utils.calculateCost(tokens);

        // 添加到使用日志
        const logEntry = {
            id: Utils.generateId(),
            timestamp,
            tokens,
            type,
            cost: parseFloat(cost.toFixed(4)),
            model: API_CONFIG.ALLOWED_MODEL,
            session: this.getSessionId()
        };
        db.usage_logs.push(logEntry);

        // 更新每日统计
        if (!db.daily_stats[dateKey]) {
            db.daily_stats[dateKey] = {
                date: dateKey,
                total_tokens: 0,
                total_calls: 0,
                total_cost: 0,
                interview_count: 0,
                calls: []
            };
        }

        const dayStats = db.daily_stats[dateKey];
        dayStats.total_tokens += tokens;
        dayStats.total_calls += 1;
        dayStats.total_cost += cost;
        dayStats.calls.push(logEntry);

        // 如果是面试开始，增加面试计数
        if (type === 'interview_start') {
            dayStats.interview_count += 1;
        }

        this.saveDatabase(db);
        return logEntry;
    }

    getTodayStats() {
        const db = this.getDatabase();
        const today = new Date().toISOString().split('T')[0];
        return db.daily_stats[today] || {
            total_tokens: 0,
            total_calls: 0,
            total_cost: 0,
            interview_count: 0
        };
    }

    getAllStats() {
        const db = this.getDatabase();
        let totalTokens = 0;
        let totalCalls = 0;
        let totalCost = 0;
        let totalInterviews = 0;
        const days = Object.keys(db.daily_stats);

        days.forEach(day => {
            const stats = db.daily_stats[day];
            totalTokens += stats.total_tokens;
            totalCalls += stats.total_calls;
            totalCost += stats.total_cost;
            totalInterviews += stats.interview_count;
        });

        return {
            totalTokens,
            totalCalls,
            totalCost,
            totalInterviews,
            activeDays: days.length,
            avgDaily: days.length > 0 ? Math.round(totalTokens / days.length) : 0
        };
    }

    getDailyStats(startDate = null, endDate = null) {
        const db = this.getDatabase();
        let stats = Object.values(db.daily_stats);
        
        if (startDate && endDate) {
            stats = stats.filter(day => 
                day.date >= startDate && day.date <= endDate
            );
        }
        
        return stats.sort((a, b) => b.date.localeCompare(a.date));
    }

    getDayLogs(date) {
        const db = this.getDatabase();
        const dayStats = db.daily_stats[date];
        return dayStats ? dayStats.calls : [];
    }

    getAllLogs() {
        const db = this.getDatabase();
        return db.usage_logs.sort((a, b) => 
            new Date(b.timestamp) - new Date(a.timestamp)
        );
    }

    clearOldData(daysToKeep = MONITORING_CONFIG.RETENTION_PERIOD) {
        const db = this.getDatabase();
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
        const cutoffStr = cutoffDate.toISOString().split('T')[0];

        // 清理每日统计
        Object.keys(db.daily_stats).forEach(date => {
            if (date < cutoffStr) {
                delete db.daily_stats[date];
            }
        });

        // 清理使用日志
        db.usage_logs = db.usage_logs.filter(log => 
            log.timestamp.split('T')[0] >= cutoffStr
        );

        this.saveDatabase(db);
    }

    resetAll() {
        this.saveDatabase({
            usage_logs: [],
            daily_stats: {},
            metadata: {
                created: new Date().toISOString(),
                version: this.version
            }
        });
    }

    exportData() {
        return this.getDatabase();
    }

    getSessionId() {
        return Utils.generateId();
    }
}

// 🎛️ 监控界面管理
class MonitoringInterface {
    constructor(tokenDB) {
        this.tokenDB = tokenDB;
        this.currentTab = 'daily';
    }

    // 刷新所有统计数据
    refreshAllStats() {
        const todayStats = this.tokenDB.getTodayStats();
        const allStats = this.tokenDB.getAllStats();

        // 更新实时显示
        this.updateElement('currentTokens', currentInterviewTokens);
        this.updateElement('todayTokens', todayStats.total_tokens);
        this.updateElement('todayCalls', todayStats.total_calls);
        this.updateElement('totalTokens', allStats.totalTokens);
        this.updateElement('totalCost', `$${allStats.totalCost.toFixed(3)}`);
        this.updateElement('avgDaily', allStats.avgDaily);

        // 刷新当前显示的表格
        this.refreshCurrentTab();
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = typeof value === 'number' ? Utils.formatNumber(value) : value;
        }
    }

    refreshCurrentTab() {
        switch (this.currentTab) {
            case 'daily':
                this.loadAllDays();
                break;
            case 'detailed':
                const logDate = document.getElementById('logDate').value;
                if (logDate) {
                    this.loadDayLogs();
                }
                break;
        }
    }

    // 标签页切换
    switchTab(tab) {
        this.currentTab = tab;
        
        // 切换按钮状态
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        event.target.classList.add('active');

        // 切换内容
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        document.getElementById(tab + 'Tab').classList.add('active');

        // 加载对应内容
        if (tab === 'daily') {
            this.loadAllDays();
        } else if (tab === 'detailed') {
            this.loadTodayLogs();
        }
    }

    // 加载每日统计
    loadAllDays() {
        const dailyStats = this.tokenDB.getDailyStats();
        const tbody = document.getElementById('dailyStatsBody');
        
        if (dailyStats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6c757d;">暂无数据</td></tr>';
            return;
        }

        tbody.innerHTML = dailyStats.map(day => `
            <tr>
                <td>${Utils.formatDate(day.date)}</td>
                <td>${Utils.formatNumber(day.total_calls)}</td>
                <td>${Utils.formatNumber(day.total_tokens)}</td>
                <td>$${day.total_cost.toFixed(3)}</td>
                <td>${Math.round(day.total_tokens / day.total_calls)}</td>
                <td>${day.interview_count}</td>
            </tr>
        `).join('');
    }

    // 按日期筛选
    filterByDate() {
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        
        if (!startDate || !endDate) {
            alert('请选择开始和结束日期');
            return;
        }

        const dailyStats = this.tokenDB.getDailyStats(startDate, endDate);
        const tbody = document.getElementById('dailyStatsBody');
        
        if (dailyStats.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: #6c757d;">选定时间范围内无数据</td></tr>';
            return;
        }

        tbody.innerHTML = dailyStats.map(day => `
            <tr>
                <td>${Utils.formatDate(day.date)}</td>
                <td>${Utils.formatNumber(day.total_calls)}</td>
                <td>${Utils.formatNumber(day.total_tokens)}</td>
                <td>$${day.total_cost.toFixed(3)}</td>
                <td>${Math.round(day.total_tokens / day.total_calls)}</td>
                <td>${day.interview_count}</td>
            </tr>
        `).join('');
    }

    // 加载今天的日志
    loadTodayLogs() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('logDate').value = today;
        this.loadDayLogs();
    }

    // 加载指定日期的日志
    loadDayLogs() {
        const date = document.getElementById('logDate').value;
        if (!date) return;

        const logs = this.tokenDB.getDayLogs(date);
        const logContainer = document.getElementById('usageLog');
        
        if (logs.length === 0) {
            logContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">该日期无使用记录</div>';
            return;
        }

        logContainer.innerHTML = logs.map(log => `
            <div class="log-entry">
                <div>
                    <div class="log-time">${Utils.formatFullTime(log.timestamp)}</div>
                    <div style="margin-top: 4px;">
                        <span class="log-type">${Utils.getTypeLabel(log.type)}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="log-tokens">${Utils.formatNumber(log.tokens)} tokens</div>
                    <div style="font-size: 12px; color: #6c757d;">$${log.cost.toFixed(4)}</div>
                </div>
            </div>
        `).join('');
    }

    // 加载所有日志
    loadAllLogs() {
        const logs = this.tokenDB.getAllLogs();
        const logContainer = document.getElementById('usageLog');
        
        if (logs.length === 0) {
            logContainer.innerHTML = '<div style="padding: 20px; text-align: center; color: #6c757d;">暂无使用记录</div>';
            return;
        }

        // 只显示最近100条记录
        const recentLogs = logs.slice(0, 100);
        
        logContainer.innerHTML = recentLogs.map(log => `
            <div class="log-entry">
                <div>
                    <div class="log-time">${Utils.formatFullTime(log.timestamp)}</div>
                    <div style="margin-top: 4px;">
                        <span class="log-type">${Utils.getTypeLabel(log.type)}</span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div class="log-tokens">${Utils.formatNumber(log.tokens)} tokens</div>
                    <div style="font-size: 12px; color: #6c757d;">$${log.cost.toFixed(4)}</div>
                </div>
            </div>
        `).join('');
    }

    // 数据导出功能
    exportToJSON() {
        const data = this.tokenDB.exportData();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        this.downloadFile(blob, `personahire-token-data-${new Date().toISOString().split('T')[0]}.json`);
    }

    exportToCSV() {
        const logs = this.tokenDB.getAllLogs();
        const csv = [
            ['时间', 'Token数量', '类型', '费用', '模型'],
            ...logs.map(log => [
                log.timestamp,
                log.tokens,
                log.type,
                log.cost.toFixed(4),
                log.model || 'gpt-4'
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadFile(blob, `personahire-usage-logs-${new Date().toISOString().split('T')[0]}.csv`);
    }

    exportDailyStats() {
        const dailyStats = this.tokenDB.getDailyStats();
        const csv = [
            ['日期', 'API调用次数', 'Token消耗', '费用', '面试次数'],
            ...dailyStats.map(day => [
                day.date,
                day.total_calls,
                day.total_tokens,
                day.total_cost.toFixed(4),
                day.interview_count
            ])
        ].map(row => row.join(',')).join('\n');
        
        const blob = new Blob([csv], { type: 'text/csv' });
        this.downloadFile(blob, `personahire-daily-stats-${new Date().toISOString().split('T')[0]}.csv`);
    }

    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 数据管理功能
    clearOldData() {
        if (confirm('确定要清理30天前的数据吗？此操作不可恢复。')) {
            this.tokenDB.clearOldData(30);
            this.refreshAllStats();
            if (typeof showMessage === 'function') {
                showMessage('✅ 已清理30天前的数据', 'success');
            }
        }
    }

    resetAllData() {
        if (confirm('确定要重置所有Token使用数据吗？此操作不可恢复！')) {
            this.tokenDB.resetAll();
            currentInterviewTokens = 0;
            this.refreshAllStats();
            if (typeof showMessage === 'function') {
                showMessage('✅ 所有数据已重置', 'success');
            }
        }
    }
}

// 🚀 初始化Token监控系统
let tokenDB;
let monitoringInterface;

function initializeTokenMonitoring() {
    try {
        tokenDB = new TokenDatabase();
        monitoringInterface = new MonitoringInterface(tokenDB);
        
        console.log('📊 Token监控系统初始化完成');
        return true;
    } catch (error) {
        console.error('❌ Token监控系统初始化失败:', error);
        return false;
    }
}

// 📤 导出监控接口
const TokenMonitoring = {
    logUsage: (tokens, type) => tokenDB?.logUsage(tokens, type),
    refreshStats: () => monitoringInterface?.refreshAllStats(),
    switchTab: (tab) => monitoringInterface?.switchTab(tab),
    filterByDate: () => monitoringInterface?.filterByDate(),
    loadAllDays: () => monitoringInterface?.loadAllDays(),
    loadTodayLogs: () => monitoringInterface?.loadTodayLogs(),
    loadDayLogs: () => monitoringInterface?.loadDayLogs(),
    loadAllLogs: () => monitoringInterface?.loadAllLogs(),
    exportToJSON: () => monitoringInterface?.exportToJSON(),
    exportToCSV: () => monitoringInterface?.exportToCSV(),
    exportDailyStats: () => monitoringInterface?.exportDailyStats(),
    clearOldData: () => monitoringInterface?.clearOldData(),
    resetAllData: () => monitoringInterface?.resetAllData()
};

console.log('📊 Token监控模块加载完成');