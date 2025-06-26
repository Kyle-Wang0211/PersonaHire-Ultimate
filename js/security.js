// 🛡️ PersonaHire Ultimate - 安全保护系统
// 防止API滥用、模型限制、使用量监控

class SecurityManager {
    constructor() {
        this.allowedModel = SECURITY_CONFIG.ALLOWED_MODELS[0]; // 默认gpt-4
        this.maxTokensPerRequest = SECURITY_CONFIG.MAX_TOKENS_PER_REQUEST;
        this.dailyTokenLimit = SECURITY_CONFIG.DAILY_TOKEN_LIMIT;
        this.usageLog = [];
        this.securityEvents = [];
        this.isInitialized = false;
        
        this.init();
    }
    
    init() {
        console.log('🛡️ 安全系统初始化...');
        this.loadSecurityLogs();
        this.validateEnvironment();
        this.isInitialized = true;
        console.log('✅ 安全系统已启用');
    }
    
    // 🔒 主要API调用接口
    async secureAPICall(messages, options = {}) {
        try {
            // 预检查
            this.validateRequest(messages, options);
            
            // 使用量检查
            await this.checkUsageLimits();
            
            // 构建安全请求
            const requestData = this.buildSecureRequest(messages, options);
            
            // 发送请求
            const response = await this.executeSecureRequest(requestData);
            
            // 验证响应
            this.validateResponse(response);
            
            // 记录使用
            this.logUsage(response);
            
            return response.choices[0].message.content;
            
        } catch (error) {
            this.handleSecurityError(error);
            throw error;
        }
    }
    
    // 🔍 请求验证
    validateRequest(messages, options) {
        // 验证消息格式
        if (!Array.isArray(messages) || messages.length === 0) {
            throw new SecurityError('无效的消息格式', 'INVALID_MESSAGES');
        }
        
        // 验证消息长度
        const totalLength = messages.reduce((sum, msg) => sum + (msg.content?.length || 0), 0);
        if (totalLength > 10000) {
            this.logSecurityEvent('EXCESSIVE_INPUT_LENGTH', { length: totalLength });
            throw new SecurityError('输入内容过长，为保护系统安全已拒绝', 'INPUT_TOO_LONG');
        }
        
        // 验证模型参数
        if (options.model && !SECURITY_CONFIG.ALLOWED_MODELS.includes(options.model)) {
            this.logSecurityEvent('BLOCKED_MODEL_ATTEMPT', { model: options.model });
            throw new SecurityError(`禁止使用模型: ${options.model}`, 'MODEL_BLOCKED');
        }
        
        console.log('✅ 请求验证通过');
    }
    
    // 📊 使用量检查
    async checkUsageLimits() {
        const todayUsage = this.getTodayUsage();
        
        // 检查每日限制
        if (todayUsage > this.dailyTokenLimit) {
            this.logSecurityEvent('DAILY_LIMIT_EXCEEDED', { usage: todayUsage, limit: this.dailyTokenLimit });
            throw new SecurityError(
                `已达到每日使用限制 (${todayUsage}/${this.dailyTokenLimit} tokens)`,
                'DAILY_LIMIT_EXCEEDED'
            );
        }
        
        // 检查短期使用频率
        const recentUsage = this.getRecentUsage(5); // 最近5分钟
        if (recentUsage > 5000) {
            this.logSecurityEvent('HIGH_FREQUENCY_USAGE', { usage: recentUsage });
            console.warn('⚠️ 检测到高频使用，请适度使用');
        }
        
        console.log(`📊 使用量检查通过: 今日 ${todayUsage}/${this.dailyTokenLimit} tokens`);
    }
    
    // 🔧 构建安全请求
    buildSecureRequest(messages, options) {
        const requestData = {
            model: this.allowedModel, // 强制使用安全模型
            messages: messages,
            max_tokens: Math.min(options.max_tokens || 800, this.maxTokensPerRequest),
            temperature: Math.min(options.temperature || 0.7, 1.0),
            presence_penalty: 0.1,
            frequency_penalty: 0.1,
            user: `PersonaHire-${Utils.generateId()}`,
            // 添加安全标识
            metadata: {
                app: 'PersonaHire-Ultimate',
                version: APP_CONFIG.version,
                security: 'enabled',
                timestamp: new Date().toISOString()
            }
        };
        
        console.log('🔧 安全请求构建完成:', { 
            model: requestData.model, 
            max_tokens: requestData.max_tokens 
        });
        
        return requestData;
    }
    
    // 🌐 执行安全请求
    async executeSecureRequest(requestData) {
        const startTime = Date.now();
        
        const response = await fetch(API_CONFIG.OPENAI_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`,
                'User-Agent': `${APP_CONFIG.name}/${APP_CONFIG.version}`,
                'X-Security-Level': 'Protected',
                'X-Request-Source': 'PersonaHire-Ultimate'
            },
            body: JSON.stringify(requestData)
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new APIError(
                error.error?.message || '请求失败',
                response.status,
                error.error?.code
            );
        }
        
        const data = await response.json();
        const responseTime = Date.now() - startTime;
        
        // 添加响应时间信息
        data._responseTime = responseTime;
        data._timestamp = new Date().toISOString();
        
        console.log(`🌐 API请求完成: ${responseTime}ms`);
        return data;
    }
    
    // ✅ 响应验证
    validateResponse(data) {
        // 验证响应结构
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new SecurityError('API响应格式异常', 'INVALID_RESPONSE');
        }
        
        // 验证模型
        if (data.model && !data.model.includes('gpt-4')) {
            this.logSecurityEvent('UNEXPECTED_MODEL_RESPONSE', { model: data.model });
            console.warn('⚠️ 响应模型异常:', data.model);
        }
        
        // 验证Token使用量
        if (data.usage && data.usage.total_tokens > this.maxTokensPerRequest * 1.5) {
            this.logSecurityEvent('EXCESSIVE_TOKEN_USAGE', { 
                tokens: data.usage.total_tokens,
                limit: this.maxTokensPerRequest 
            });
            console.warn('⚠️ Token使用量异常:', data.usage.total_tokens);
        }
        
        console.log('✅ 响应验证通过');
    }
    
    // 📝 记录使用
    logUsage(data) {
        if (!data.usage) return;
        
        const usageEntry = {
            id: Utils.generateId(),
            timestamp: data._timestamp || new Date().toISOString(),
            model: data.model || this.allowedModel,
            tokens: data.usage.total_tokens,
            input_tokens: data.usage.prompt_tokens,
            output_tokens: data.usage.completion_tokens,
            cost: Utils.calculateCost(data.usage.total_tokens),
            response_time: data._responseTime || 0,
            status: 'success',
            security_level: 'protected'
        };
        
        this.usageLog.push(usageEntry);
        
        // 更新当前面试统计
        if (typeof currentInterviewTokens !== 'undefined') {
            currentInterviewTokens += data.usage.total_tokens;
        }
        
        // 通知Token监控系统
        if (typeof tokenDB !== 'undefined') {
            tokenDB.logUsage(data.usage.total_tokens, 'protected-chat');
        }
        
        console.log('📝 使用记录已保存:', usageEntry);
    }
    
    // 🚨 安全事件记录
    logSecurityEvent(eventType, details = {}) {
        const securityEvent = {
            id: Utils.generateId(),
            timestamp: new Date().toISOString(),
            type: eventType,
            level: this.getEventLevel(eventType),
            details: details,
            user_agent: navigator.userAgent,
            url: window.location.href,
            session: this.getSessionId()
        };
        
        this.securityEvents.push(securityEvent);
        
        // 保存到持久存储
        this.saveSecurityLogs();
        
        // 根据级别进行不同处理
        switch (securityEvent.level) {
            case 'critical':
                console.error('🚨 安全警报:', securityEvent);
                this.notifySecurityAlert(securityEvent);
                break;
            case 'warning':
                console.warn('⚠️ 安全警告:', securityEvent);
                break;
            default:
                console.log('📋 安全事件:', securityEvent);
        }
    }
    
    // 🔍 获取事件级别
    getEventLevel(eventType) {
        const criticalEvents = ['DAILY_LIMIT_EXCEEDED', 'MODEL_BLOCKED', 'EXCESSIVE_TOKEN_USAGE'];
        const warningEvents = ['HIGH_FREQUENCY_USAGE', 'UNEXPECTED_MODEL_RESPONSE'];
        
        if (criticalEvents.includes(eventType)) return 'critical';
        if (warningEvents.includes(eventType)) return 'warning';
        return 'info';
    }
    
    // 🚨 安全警报通知
    notifySecurityAlert(event) {
        // 显示用户警告
        if (typeof showMessage === 'function') {
            showMessage(
                `🚨 安全警报: ${event.type} - ${JSON.stringify(event.details)}`,
                'error'
            );
        }
        
        // 可以添加更多通知方式
        // 例如：发送到监控系统、邮件通知等
    }
    
    // 📊 使用统计方法
    getTodayUsage() {
        const today = new Date().toISOString().split('T')[0];
        return this.usageLog
            .filter(log => log.timestamp.startsWith(today))
            .reduce((total, log) => total + log.tokens, 0);
    }
    
    getRecentUsage(minutes) {
        const cutoff = new Date(Date.now() - minutes * 60 * 1000);
        return this.usageLog
            .filter(log => new Date(log.timestamp) > cutoff)
            .reduce((total, log) => total + log.tokens, 0);
    }
    
    // 💾 数据持久化
    saveSecurityLogs() {
        try {
            localStorage.setItem('personahire_security_logs', JSON.stringify({
                usage: this.usageLog.slice(-100), // 只保留最近100条
                events: this.securityEvents.slice(-50), // 只保留最近50条事件
                updated: new Date().toISOString()
            }));
        } catch (error) {
            console.warn('保存安全日志失败:', error);
        }
    }
    
    loadSecurityLogs() {
        try {
            const saved = localStorage.getItem('personahire_security_logs');
            if (saved) {
                const data = JSON.parse(saved);
                this.usageLog = data.usage || [];
                this.securityEvents = data.events || [];
                console.log('📋 安全日志已加载');
            }
        } catch (error) {
            console.warn('加载安全日志失败:', error);
        }
    }
    
    // 🔍 环境验证
    validateEnvironment() {
        // 检查是否在HTTPS环境
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            console.warn('⚠️ 建议使用HTTPS协议以确保安全');
        }
        
        // 检查API Key格式
        if (openaiKey && !openaiKey.startsWith('sk-')) {
            this.logSecurityEvent('INVALID_API_KEY_FORMAT', { key_start: openaiKey.substring(0, 3) });
        }
    }
    
    // 🆔 会话ID
    getSessionId() {
        let sessionId = sessionStorage.getItem('personahire_session');
        if (!sessionId) {
            sessionId = Utils.generateId();
            sessionStorage.setItem('personahire_session', sessionId);
        }
        return sessionId;
    }
    
    // 📊 获取安全统计
    getSecurityStats() {
        return {
            totalRequests: this.usageLog.length,
            totalTokens: this.usageLog.reduce((sum, log) => sum + log.tokens, 0),
            totalCost: this.usageLog.reduce((sum, log) => sum + log.cost, 0),
            securityEvents: this.securityEvents.length,
            todayUsage: this.getTodayUsage(),
            avgResponseTime: this.usageLog.length > 0 
                ? this.usageLog.reduce((sum, log) => sum + log.response_time, 0) / this.usageLog.length 
                : 0
        };
    }
    
    // 🔄 重置安全数据
    resetSecurityData() {
        this.usageLog = [];
        this.securityEvents = [];
        localStorage.removeItem('personahire_security_logs');
        console.log('🔄 安全数据已重置');
    }
}

// 🚨 自定义错误类型
class SecurityError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'SecurityError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

class APIError extends Error {
    constructor(message, status, code) {
        super(message);
        this.name = 'APIError';
        this.status = status;
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}

// 🛡️ 全局安全管理器实例
let securityManager;

// 🚀 初始化安全系统
function initializeSecurity() {
    try {
        securityManager = new SecurityManager();
        console.log('🛡️ 安全系统初始化完成');
        return true;
    } catch (error) {
        console.error('❌ 安全系统初始化失败:', error);
        return false;
    }
}

// 📤 导出安全接口
const SecureAPI = {
    // 🔒 安全的GPT调用
    async callGPT(messages, options = {}) {
        if (!securityManager || !securityManager.isInitialized) {
            throw new SecurityError('安全系统未初始化', 'SECURITY_NOT_INITIALIZED');
        }
        return await securityManager.secureAPICall(messages, options);
    },
    
    // 📊 获取安全统计
    getStats() {
        return securityManager ? securityManager.getSecurityStats() : null;
    },
    
    // 🔄 重置数据
    reset() {
        if (securityManager) {
            securityManager.resetSecurityData();
        }
    },
    
    // 🚨 手动记录安全事件
    logEvent(type, details) {
        if (securityManager) {
            securityManager.logSecurityEvent(type, details);
        }
    }
};

console.log('🛡️ 安全模块加载完成');