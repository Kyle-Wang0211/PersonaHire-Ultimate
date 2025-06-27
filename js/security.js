// PersonaHire Ultimate - 安全管理模块
// 负责输入验证、API安全、数据保护

class SecurityManager {
    constructor() {
        this.rateLimitMap = new Map();
        this.blacklistedPatterns = [
            /(?:hack|exploit|bypass|inject|script|eval|exec)/i,
            /(?:password|secret|token|key|auth)/i,
            /(?:<script|javascript:|data:|vbscript:)/i
        ];
        this.maxMessageLength = 2000;
        this.maxMessagesPerMinute = 10;
        this.suspiciousAttempts = 0;
        this.maxSuspiciousAttempts = 5;
    }

    // 验证API密钥格式
    validateApiKey(key, type = 'openai') {
        if (!key || typeof key !== 'string') {
            return { valid: false, error: 'API密钥不能为空' };
        }

        switch (type) {
            case 'openai':
                if (!key.startsWith('sk-') || key.length < 40) {
                    return { valid: false, error: 'OpenAI API密钥格式无效' };
                }
                break;
            case 'elevenlabs':
                if (key.length < 20) {
                    return { valid: false, error: 'ElevenLabs API密钥格式无效' };
                }
                break;
        }

        return { valid: true };
    }

    // 验证用户输入
    validateUserInput(input) {
        if (!input || typeof input !== 'string') {
            return { valid: false, error: '输入不能为空' };
        }

        // 检查长度
        if (input.length > this.maxMessageLength) {
            return { 
                valid: false, 
                error: `消息长度不能超过${this.maxMessageLength}字符（当前：${input.length}字符）` 
            };
        }

        // 检查可疑模式
        for (const pattern of this.blacklistedPatterns) {
            if (pattern.test(input)) {
                this.suspiciousAttempts++;
                console.warn('检测到可疑输入模式:', pattern);
                
                if (this.suspiciousAttempts >= this.maxSuspiciousAttempts) {
                    return { 
                        valid: false, 
                        error: '检测到多次可疑输入，请联系管理员' 
                    };
                }
                
                return { 
                    valid: false, 
                    error: '输入包含不允许的内容，请重新输入' 
                };
            }
        }

        return { valid: true };
    }

    // 速率限制检查
    checkRateLimit(userId = 'default') {
        const now = Date.now();
        const userRequests = this.rateLimitMap.get(userId) || [];
        
        // 移除1分钟前的请求
        const recentRequests = userRequests.filter(time => now - time < 60000);
        
        if (recentRequests.length >= this.maxMessagesPerMinute) {
            return { 
                allowed: false, 
                error: `请求频率过高，请等待${Math.ceil((recentRequests[0] + 60000 - now) / 1000)}秒后重试` 
            };
        }

        // 添加当前请求时间
        recentRequests.push(now);
        this.rateLimitMap.set(userId, recentRequests);

        return { allowed: true };
    }

    // 清理输入内容
    sanitizeInput(input) {
        if (!input || typeof input !== 'string') return '';

        return input
            .trim()
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;')
            .substring(0, this.maxMessageLength);
    }

    // 验证API响应
    validateApiResponse(response, expectedFields = []) {
        if (!response || typeof response !== 'object') {
            return { valid: false, error: 'API响应格式无效' };
        }

        // 检查必需字段
        for (const field of expectedFields) {
            if (!(field in response)) {
                return { valid: false, error: `API响应缺少必需字段: ${field}` };
            }
        }

        return { valid: true };
    }

    // 检测并阻止潜在的提示注入
    detectPromptInjection(input) {
        const injectionPatterns = [
            /ignore\s+(?:previous|above|all)\s+instructions?/i,
            /forget\s+(?:everything|all|previous)/i,
            /you\s+are\s+now\s+(?:a|an)\s+/i,
            /new\s+instructions?:/i,
            /system\s*:\s*/i,
            /assistant\s*:\s*/i,
            /human\s*:\s*/i,
            /role\s*:\s*(?:system|assistant|user)/i,
            /pretend\s+(?:you\s+are|to\s+be)/i,
            /act\s+as\s+(?:if|a|an)/i
        ];

        for (const pattern of injectionPatterns) {
            if (pattern.test(input)) {
                console.warn('检测到提示注入尝试:', input);
                return { 
                    detected: true, 
                    error: '检测到不当输入，请使用正常的面试回答' 
                };
            }
        }

        return { detected: false };
    }

    // 生成安全的请求头
    getSecureHeaders(apiKey) {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'User-Agent': 'PersonaHire-Ultimate/1.0',
            'X-Request-Source': 'web-app'
        };
    }

    // 安全的错误处理
    handleSecureError(error, context = '') {
        // 记录详细错误信息（仅在开发模式）
        if (window.configManager?.isDeveloperMode) {
            console.error(`[Security] ${context}:`, error);
        }

        // 返回用户友好的错误信息
        if (error.message?.includes('401')) {
            return 'API密钥无效，请检查密钥是否正确';
        } else if (error.message?.includes('429')) {
            return 'API请求频率过高，请稍后重试';
        } else if (error.message?.includes('403')) {
            return 'API访问被拒绝，请检查权限设置';
        } else if (error.message?.includes('network')) {
            return '网络连接异常，请检查网络连接';
        } else {
            return '服务暂时不可用，请稍后重试';
        }
    }

    // 数据加密存储（简单的XOR加密）
    encryptData(data, key = 'PersonaHire2024') {
        let result = '';
        for (let i = 0; i < data.length; i++) {
            result += String.fromCharCode(
                data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
            );
        }
        return btoa(result);
    }

    // 数据解密
    decryptData(encryptedData, key = 'PersonaHire2024') {
        try {
            const data = atob(encryptedData);
            let result = '';
            for (let i = 0; i < data.length; i++) {
                result += String.fromCharCode(
                    data.charCodeAt(i) ^ key.charCodeAt(i % key.length)
                );
            }
            return result;
        } catch (error) {
            console.error('数据解密失败:', error);
            return null;
        }
    }

    // 清理敏感数据
    clearSensitiveData() {
        // 清理localStorage中的敏感信息
        const sensitiveKeys = ['openai_api_key', 'eleven_api_key'];
        sensitiveKeys.forEach(key => {
            if (localStorage.getItem(key)) {
                localStorage.removeItem(key);
            }
        });

        // 清理内存中的敏感数据
        if (window.configManager) {
            window.configManager.apiKeys.openai = '';
            window.configManager.apiKeys.elevenlabs = '';
        }

        // 清理表单数据
        const forms = document.querySelectorAll('input[type="password"]');
        forms.forEach(input => input.value = '');
    }

    // 生成CSP（内容安全策略）违规报告
    reportCSPViolation(violationEvent) {
        console.warn('CSP违规检测:', {
            blockedURI: violationEvent.blockedURI,
            documentURI: violationEvent.documentURI,
            violatedDirective: violationEvent.violatedDirective,
            timestamp: new Date().toISOString()
        });
    }

    // 初始化安全设置
    initialize() {
        // 设置CSP违规监听
        document.addEventListener('securitypolicyviolation', (e) => {
            this.reportCSPViolation(e);
        });

        // 防止控制台代码注入警告
        if (!window.configManager?.isDeveloperMode) {
            console.log('%c🛡️ 安全警告', 'color: red; font-size: 20px; font-weight: bold;');
            console.log('%c请勿在此处粘贴或执行不明代码！', 'color: red; font-size: 16px;');
            console.log('%c这可能导致您的账户信息被盗取。', 'color: red; font-size: 16px;');
        }

        // 页面隐藏时清理敏感数据
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // 页面隐藏时的安全措施
                this.temporaryCleanup();
            }
        });

        // 页面卸载时清理
        window.addEventListener('beforeunload', () => {
            this.clearTemporaryData();
        });
    }

    // 临时清理
    temporaryCleanup() {
        // 暂停音频播放
        if (window.audioManager?.currentAudio) {
            window.audioManager.currentAudio.pause();
        }
    }

    // 清理临时数据
    clearTemporaryData() {
        // 清理可能的临时缓存
        if (window.tokenMonitor) {
            window.tokenMonitor.saveStats();
        }
    }

    // 验证文件上传（如果需要）
    validateFileUpload(file) {
        const allowedTypes = ['text/plain', 'application/json'];
        const maxSize = 1024 * 1024; // 1MB

        if (!allowedTypes.includes(file.type)) {
            return { valid: false, error: '不支持的文件类型' };
        }

        if (file.size > maxSize) {
            return { valid: false, error: '文件大小超过限制（1MB）' };
        }

        return { valid: true };
    }
}

// 初始化安全管理器
window.securityManager = new SecurityManager();
window.securityManager.initialize();