/* PersonaHire Ultimate - 安全验证模块 */
/* API验证 + 错误处理 + 安全检查 */

// =============== API连接测试 ===============

/**
 * 测试OpenAI API连接和权限
 * @param {string} apiKey - OpenAI API密钥
 * @returns {Object} 测试结果
 */
async function testOpenAIConnection(apiKey) {
    try {
        console.log('🧪 Testing OpenAI connection...');
        
        const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            const hasGPT4 = data.data.some(model => model.id.includes('gpt-4'));
            const hasGPT41 = data.data.some(model => model.id.includes('gpt-4.1') || model.id.includes('gpt-4-turbo'));
            
            console.log('✅ OpenAI connection successful');
            console.log('Models available:', data.data.length);
            console.log('GPT-4 access:', hasGPT4);
            console.log('GPT-4.1 access:', hasGPT41);
            
            return { 
                success: true, 
                hasGPT4, 
                hasGPT41,
                models: data.data.length,
                info: hasGPT41 ? 'GPT-4.1权限已验证' : hasGPT4 ? '仅GPT-4权限' : '仅GPT-3.5权限'
            };
        } else {
            const errorData = await response.json();
            console.error('❌ OpenAI connection failed:', errorData);
            return { 
                success: false, 
                error: `认证失败: ${errorData.error?.message || 'Unknown error'}` 
            };
        }
    } catch (error) {
        console.error('❌ OpenAI connection error:', error);
        return { 
            success: false, 
            error: `网络错误: ${error.message}` 
        };
    }
}

/**
 * 测试ElevenLabs API连接
 * @param {string} apiKey - ElevenLabs API密钥
 * @returns {Object} 测试结果
 */
async function testElevenLabsConnection(apiKey) {
    try {
        console.log('🧪 Testing ElevenLabs connection...');
        
        const response = await fetch('https://api.elevenlabs.io/v1/user', {
            headers: {
                'xi-api-key': apiKey,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            const data = await response.json();
            console.log('✅ ElevenLabs connection successful');
            console.log('User data:', data);
            
            return { 
                success: true, 
                info: `剩余字符: ${data.subscription?.character_count || 'N/A'}`,
                quota: data.subscription?.character_count || 0
            };
        } else {
            const errorData = await response.json();
            console.error('❌ ElevenLabs connection failed:', errorData);
            return { 
                success: false, 
                error: `认证失败: ${errorData.detail?.message || 'Invalid API key'}` 
            };
        }
    } catch (error) {
        console.error('❌ ElevenLabs connection error:', error);
        return { 
            success: false, 
            error: `网络错误: ${error.message}` 
        };
    }
}

// =============== API密钥验证 ===============

/**
 * 验证OpenAI API密钥格式
 * @param {string} key - API密钥
 * @returns {Object} 验证结果
 */
function validateOpenAIKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'API密钥不能为空' };
    }
    
    if (!key.startsWith('sk-')) {
        return { valid: false, error: 'OpenAI API密钥必须以 "sk-" 开头' };
    }
    
    if (key.length < 20) {
        return { valid: false, error: 'API密钥长度不足，请检查是否完整' };
    }
    
    // 检查是否包含非法字符
    const validChars = /^sk-[A-Za-z0-9-_]+$/;
    if (!validChars.test(key)) {
        return { valid: false, error: 'API密钥包含无效字符' };
    }
    
    return { valid: true };
}

/**
 * 验证ElevenLabs API密钥格式
 * @param {string} key - API密钥
 * @returns {Object} 验证结果
 */
function validateElevenLabsKey(key) {
    if (!key || typeof key !== 'string') {
        return { valid: false, error: 'ElevenLabs API密钥不能为空' };
    }
    
    if (key.length < 10) {
        return { valid: false, error: 'API密钥长度不足，请检查是否完整' };
    }
    
    // ElevenLabs密钥通常是32位字母数字组合
    const validChars = /^[A-Za-z0-9]+$/;
    if (!validChars.test(key)) {
        return { valid: false, error: 'API密钥格式无效，只能包含字母和数字' };
    }
    
    return { valid: true };
}

// =============== 综合API测试 ===============

/**
 * 测试所有配置的API连接
 */
async function testAllApis() {
    console.log('🔍 Starting comprehensive API testing...');
    
    // 获取测试用的API密钥
    const openaiInput = document.getElementById('openaiKey');
    const elevenInput = document.getElementById('elevenKey');
    
    const testOpenaiKey = openaiInput?.value.trim() || openaiKey;
    const testElevenKey = elevenInput?.value.trim() || elevenKey;
    
    // 显示Token状态面板
    const tokenStatus = document.getElementById('tokenStatus');
    if (tokenStatus) {
        tokenStatus.style.display = 'block';
    }
    
    // 测试OpenAI连接
    await testOpenAI(testOpenaiKey);
    
    // 测试ElevenLabs连接（如果提供了密钥）
    if (testElevenKey) {
        await testElevenLabs(testElevenKey);
    } else {
        updateStatusIndicator('elevenStatus', 'disconnected', '未配置');
    }
    
    console.log('✅ API testing completed');
}

/**
 * 测试OpenAI连接并更新UI
 * @param {string} testKey - 测试用的API密钥
 */
async function testOpenAI(testKey) {
    const statusEl = document.getElementById('openaiStatus');
    const infoEl = document.getElementById('openaiInfo');
    const gptStatusEl = document.getElementById('gptStatus');
    const gptInfoEl = document.getElementById('gptInfo');
    
    if (!testKey) {
        updateStatusIndicator('openaiStatus', 'disconnected', '未配置');
        updateStatusIndicator('gptStatus', 'disconnected', '无密钥');
        return;
    }
    
    // 验证密钥格式
    const validation = validateOpenAIKey(testKey);
    if (!validation.valid) {
        updateStatusIndicator('openaiStatus', 'error', validation.error);
        updateStatusIndicator('gptStatus', 'error', '密钥无效');
        return;
    }
    
    // 设置测试状态
    updateStatusIndicator('openaiStatus', 'testing', '测试中...');
    updateStatusIndicator('gptStatus', 'testing', '验证中...');
    
    // 执行连接测试
    const result = await testOpenAIConnection(testKey);
    
    if (result.success) {
        updateStatusIndicator('openaiStatus', 'connected', result.info);
        updateStatusIndicator('gptStatus', 
            result.hasGPT41 ? 'connected' : result.hasGPT4 ? 'warning' : 'error',
            result.hasGPT41 ? '有GPT-4.1权限' : result.hasGPT4 ? '仅GPT-4权限' : '无GPT-4权限'
        );
    } else {
        updateStatusIndicator('openaiStatus', 'error', result.error);
        updateStatusIndicator('gptStatus', 'error', '无法验证');
    }
}

/**
 * 测试ElevenLabs连接并更新UI
 * @param {string} testKey - 测试用的API密钥
 */
async function testElevenLabs(testKey) {
    const statusEl = document.getElementById('elevenStatus');
    const infoEl = document.getElementById('elevenInfo');
    
    // 验证密钥格式
    const validation = validateElevenLabsKey(testKey);
    if (!validation.valid) {
        updateStatusIndicator('elevenStatus', 'error', validation.error);
        return;
    }
    
    // 设置测试状态
    updateStatusIndicator('elevenStatus', 'testing', '测试中...');
    
    // 执行连接测试
    const result = await testElevenLabsConnection(testKey);
    
    if (result.success) {
        updateStatusIndicator('elevenStatus', 'connected', result.info);
    } else {
        updateStatusIndicator('elevenStatus', 'error', result.error);
    }
}

/**
 * 更新状态指示器
 * @param {string} elementId - 状态指示器元素ID
 * @param {string} status - 状态类型 (connected/testing/warning/error/disconnected)
 * @param {string} info - 状态信息
 */
function updateStatusIndicator(elementId, status, info) {
    const statusEl = document.getElementById(elementId);
    const infoEl = document.getElementById(elementId.replace('Status', 'Info'));
    
    if (statusEl) {
        statusEl.className = `status-indicator ${status}`;
    }
    
    if (infoEl) {
        infoEl.textContent = info;
    }
}

// =============== 错误处理和重试机制 ===============

/**
 * API调用错误处理
 * @param {Error} error - 错误对象
 * @param {string} apiType - API类型
 * @returns {string} 用户友好的错误消息
 */
function handleApiError(error, apiType = 'API') {
    console.error(`❌ ${apiType} Error:`, error);
    
    if (error.message.includes('401')) {
        return `${apiType} 认证失败，请检查API密钥是否正确`;
    } else if (error.message.includes('403')) {
        return `${apiType} 权限不足，请检查API密钥权限`;
    } else if (error.message.includes('429')) {
        return `${apiType} 请求过于频繁，请稍后重试`;
    } else if (error.message.includes('500')) {
        return `${apiType} 服务器错误，请稍后重试`;
    } else if (error.message.includes('timeout')) {
        return `${apiType} 请求超时，请检查网络连接`;
    } else if (error.message.includes('network')) {
        return `网络连接错误，请检查网络设置`;
    } else {
        return `${apiType} 调用失败: ${error.message}`;
    }
}

/**
 * 带重试的API调用包装器
 * @param {Function} apiCall - API调用函数
 * @param {number} maxRetries - 最大重试次数
 * @param {number} delay - 重试延迟（毫秒）
 * @returns {Promise} API调用结果
 */
async function retryApiCall(apiCall, maxRetries = 3, delay = 1000) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🔄 API call attempt ${attempt}/${maxRetries}`);
            return await apiCall();
        } catch (error) {
            console.warn(`⚠️ Attempt ${attempt} failed:`, error.message);
            
            if (attempt === maxRetries) {
                throw error;
            }
            
            // 指数退避延迟
            const retryDelay = delay * Math.pow(2, attempt - 1);
            console.log(`⏳ Retrying in ${retryDelay}ms...`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }
}

// =============== 输入验证和清理 ===============

/**
 * 清理和验证用户输入
 * @param {string} input - 用户输入
 * @returns {string} 清理后的输入
 */
function sanitizeInput(input) {
    if (typeof input !== 'string') {
        return '';
    }
    
    // 移除危险字符，保留必要的标点和中文
    return input
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // 移除script标签
        .replace(/[<>]/g, '') // 移除尖括号
        .trim()
        .substring(0, 5000); // 限制长度
}

/**
 * 验证消息内容
 * @param {string} message - 消息内容
 * @returns {Object} 验证结果
 */
function validateMessage(message) {
    const cleaned = sanitizeInput(message);
    
    if (!cleaned) {
        return { valid: false, error: '消息内容不能为空' };
    }
    
    if (cleaned.length < 2) {
        return { valid: false, error: '消息内容过短，请输入至少2个字符' };
    }
    
    if (cleaned.length > 5000) {
        return { valid: false, error: '消息内容过长，请控制在5000字符以内' };
    }
    
    return { valid: true, message: cleaned };
}

// =============== 模块导出 ===============

// 确保全局可访问的函数
window.testOpenAIConnection = testOpenAIConnection;
window.testElevenLabsConnection = testElevenLabsConnection;
window.testAllApis = testAllApis;
window.validateOpenAIKey = validateOpenAIKey;
window.validateElevenLabsKey = validateElevenLabsKey;
window.handleApiError = handleApiError;
window.retryApiCall = retryApiCall;
window.sanitizeInput = sanitizeInput;
window.validateMessage = validateMessage;
window.updateStatusIndicator = updateStatusIndicator;

console.log('🔐 Security module loaded successfully');