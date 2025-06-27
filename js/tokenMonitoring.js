// PersonaHire Ultimate - Token监控统计模块
// 负责Token使用统计、成本计算、优化建议

class TokenMonitor {
    constructor() {
        this.stats = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            conversationRounds: 0,
            sessionStartTime: Date.now(),
            requestTimes: [],
            modelUsage: {}
        };
        
        this.pricing = {
            'gpt-4.1': {
                input: 0.00003,  // $0.03 per 1K tokens
                output: 0.00006  // $0.06 per 1K tokens
            },
            'gpt-4o': {
                input: 0.005,    // $5 per 1M tokens
                output: 0.015    // $15 per 1M tokens
            },
            'gpt-4o-mini': {
                input: 0.00015,  // $0.15 per 1M tokens
                output: 0.0006   // $0.6 per 1M tokens
            },
            'gpt-3.5-turbo': {
                input: 0.0005,   // $0.5 per 1M tokens
                output: 0.0015   // $1.5 per 1M tokens
            }
        };

        this.thresholds = {
            costWarning: 1.0,      // $1.00
            costLimit: 5.0,        // $5.00
            tokenWarning: 10000,   // 10K tokens
            tokenLimit: 50000      // 50K tokens
        };

        this.optimizations = {
            contextWindow: 8000,    // 保持上下文在8K tokens内
            summaryThreshold: 6000, // 超过6K tokens时启用摘要
            compressionRatio: 0.3   // 摘要压缩比例
        };

        this.loadStats();
        this.initializeUI();
    }

    // 估算Token数量（简单估算）
    estimateTokens(text) {
        if (!text) return 0;
        // 简单估算：英文约4字符=1token，中文约1.5字符=1token
        const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
        const otherChars = text.length - chineseChars;
        return Math.ceil(chineseChars / 1.5 + otherChars / 4);
    }

    // 记录API请求
    recordRequest(model, inputText, outputText, actualTokens = null) {
        const startTime = Date.now();
        
        // 估算或使用实际token数
        const inputTokenCount = actualTokens?.prompt_tokens || this.estimateTokens(inputText);
        const outputTokenCount = actualTokens?.completion_tokens || this.estimateTokens(outputText);
        const totalTokenCount = inputTokenCount + outputTokenCount;

        // 更新统计
        this.stats.inputTokens += inputTokenCount;
        this.stats.outputTokens += outputTokenCount;
        this.stats.totalTokens += totalTokenCount;
        this.stats.conversationRounds++;

        // 计算成本
        const cost = this.calculateCost(model, inputTokenCount, outputTokenCount);
        this.stats.totalCost += cost;

        // 记录模型使用
        if (!this.stats.modelUsage[model]) {
            this.stats.modelUsage[model] = { tokens: 0, cost: 0, requests: 0 };
        }
        this.stats.modelUsage[model].tokens += totalTokenCount;
        this.stats.modelUsage[model].cost += cost;
        this.stats.modelUsage[model].requests++;

        // 记录响应时间
        const responseTime = Date.now() - startTime;
        this.stats.requestTimes.push(responseTime);
        if (this.stats.requestTimes.length > 50) {
            this.stats.requestTimes.shift(); // 只保留最近50次
        }

        // 更新UI
        this.updateStatsDisplay();
        
        // 检查阈值警告
        this.checkThresholds();

        // 保存统计数据
        this.saveStats();

        return {
            inputTokens: inputTokenCount,
            outputTokens: outputTokenCount,
            totalTokens: totalTokenCount,
            cost: cost,
            optimizationSuggestion: this.getOptimizationSuggestion()
        };
    }

    // 计算成本
    calculateCost(model, inputTokens, outputTokens) {
        const pricing = this.pricing[model] || this.pricing['gpt-4.1'];
        return (inputTokens * pricing.input + outputTokens * pricing.output);
    }

    // 更新统计显示
    updateStatsDisplay() {
        const elements = {
            'totalTokens': this.stats.totalTokens.toLocaleString(),
            'inputTokens': this.stats.inputTokens.toLocaleString(),
            'outputTokens': this.stats.outputTokens.toLocaleString(),
            'estimatedCost': `$${this.stats.totalCost.toFixed(4)}`,
            'conversationRounds': this.stats.conversationRounds,
            'avgResponseTime': this.getAverageResponseTime() + 'ms'
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
                
                // 添加警告样式
                if (id === 'estimatedCost' && this.stats.totalCost > this.thresholds.costWarning) {
                    element.style.color = this.stats.totalCost > this.thresholds.costLimit ? 'red' : 'orange';
                }
                if (id === 'totalTokens' && this.stats.totalTokens > this.thresholds.tokenWarning) {
                    element.style.color = this.stats.totalTokens > this.thresholds.tokenLimit ? 'red' : 'orange';
                }
            }
        });
    }

    // 获取平均响应时间
    getAverageResponseTime() {
        if (this.stats.requestTimes.length === 0) return 0;
        const sum = this.stats.requestTimes.reduce((a, b) => a + b, 0);
        return Math.round(sum / this.stats.requestTimes.length);
    }

    // 检查阈值警告
    checkThresholds() {
        if (this.stats.totalCost > this.thresholds.costLimit) {
            window.uiManager?.showMessage(
                `⚠️ 成本警告：当前费用 $${this.stats.totalCost.toFixed(4)} 已超过限制 $${this.thresholds.costLimit}`,
                'warning'
            );
        } else if (this.stats.totalCost > this.thresholds.costWarning) {
            window.uiManager?.showMessage(
                `💰 成本提醒：当前费用 $${this.stats.totalCost.toFixed(4)} 接近预警线`,
                'warning'
            );
        }

        if (this.stats.totalTokens > this.thresholds.tokenLimit) {
            window.uiManager?.showMessage(
                `⚠️ Token警告：使用量 ${this.stats.totalTokens} 已超过限制`,
                'warning'
            );
        }
    }

    // 获取优化建议
    getOptimizationSuggestion() {
        const suggestions = [];

        // 成本优化建议
        if (this.stats.totalCost > this.thresholds.costWarning) {
            suggestions.push('考虑使用 gpt-4o-mini 模型以降低成本');
            suggestions.push('启用Token优化功能');
        }

        // Token优化建议
        if (this.stats.totalTokens > this.thresholds.tokenWarning) {
            suggestions.push('建议启用智能摘要功能');
            suggestions.push('考虑减少对话上下文长度');
        }

        // 响应时间优化
        const avgTime = this.getAverageResponseTime();
        if (avgTime > 5000) {
            suggestions.push('响应时间较长，考虑使用更快的模型');
        }

        return suggestions;
    }

    // 智能上下文优化
    optimizeContext(conversationHistory) {
        if (!window.configManager?.settings.tokenOptimization) {
            return conversationHistory;
        }

        const totalTokens = conversationHistory.reduce((sum, msg) => 
            sum + this.estimateTokens(msg.content), 0
        );

        if (totalTokens <= this.optimizations.contextWindow) {
            return conversationHistory;
        }

        // 保留系统消息和最近的对话
        const systemMessages = conversationHistory.filter(msg => msg.role === 'system');
        const otherMessages = conversationHistory.filter(msg => msg.role !== 'system');
        
        // 从最新消息开始保留
        let optimizedMessages = [...systemMessages];
        let currentTokens = systemMessages.reduce((sum, msg) => 
            sum + this.estimateTokens(msg.content), 0
        );

        // 从后往前添加消息，直到达到token限制
        for (let i = otherMessages.length - 1; i >= 0; i--) {
            const messageTokens = this.estimateTokens(otherMessages[i].content);
            if (currentTokens + messageTokens <= this.optimizations.contextWindow) {
                optimizedMessages.splice(-1, 0, otherMessages[i]);
                currentTokens += messageTokens;
            } else {
                break;
            }
        }

        console.log(`上下文优化: ${conversationHistory.length} → ${optimizedMessages.length} 消息`);
        return optimizedMessages;
    }

    // 智能摘要生成
    async generateSmartSummary(conversationHistory) {
        if (!window.configManager?.settings.smartSummary) {
            return conversationHistory;
        }

        const totalTokens = conversationHistory.reduce((sum, msg) => 
            sum + this.estimateTokens(msg.content), 0
        );

        if (totalTokens <= this.optimizations.summaryThreshold) {
            return conversationHistory;
        }

        try {
            // 创建摘要请求
            const summaryPrompt = `请将以下对话内容简洁地总结为关键信息，保留重要的问答要点，控制在${Math.floor(totalTokens * this.optimizations.compressionRatio)}个token以内：

${conversationHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n\n')}`;

            const summaryResponse = await window.apiManager.callGPT({
                model: 'gpt-4o-mini', // 使用更便宜的模型生成摘要
                messages: [{ role: 'user', content: summaryPrompt }],
                max_tokens: Math.floor(totalTokens * this.optimizations.compressionRatio),
                temperature: 0.3
            });

            // 返回包含摘要的新对话历史
            const systemMsg = conversationHistory.find(msg => msg.role === 'system');
            const summaryMsg = {
                role: 'system',
                content: `以下是之前对话的摘要：\n${summaryResponse}`
            };

            return systemMsg ? [systemMsg, summaryMsg] : [summaryMsg];

        } catch (error) {
            console.error('智能摘要生成失败:', error);
            return this.optimizeContext(conversationHistory);
        }
    }

    // 导出统计数据
    exportStats() {
        const exportData = {
            ...this.stats,
            sessionDuration: Date.now() - this.stats.sessionStartTime,
            optimizationSettings: this.optimizations,
            thresholds: this.thresholds,
            exportTime: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `personahire-stats-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 重置统计
    resetStats() {
        this.stats = {
            totalTokens: 0,
            inputTokens: 0,
            outputTokens: 0,
            totalCost: 0,
            conversationRounds: 0,
            sessionStartTime: Date.now(),
            requestTimes: [],
            modelUsage: {}
        };
        this.saveStats();
        this.updateStatsDisplay();
    }

    // 保存统计数据
    saveStats() {
        try {
            localStorage.setItem('persona_hire_token_stats', JSON.stringify(this.stats));
        } catch (error) {
            console.error('保存统计数据失败:', error);
        }
    }

    // 加载统计数据
    loadStats() {
        try {
            const saved = localStorage.getItem('persona_hire_token_stats');
            if (saved) {
                const loadedStats = JSON.parse(saved);
                this.stats = { ...this.stats, ...loadedStats };
                // 重置会话开始时间
                this.stats.sessionStartTime = Date.now();
            }
        } catch (error) {
            console.error('加载统计数据失败:', error);
        }
    }

    // 初始化UI
    initializeUI() {
        // 绑定导出功能
        window.exportStats = () => this.exportStats();
        
        // 绑定面板切换
        window.toggleStatsPanel = () => {
            const panel = document.getElementById('statsPanel');
            if (panel) {
                const isVisible = panel.style.display !== 'none';
                panel.style.display = isVisible ? 'none' : 'block';
            }
        };

        // 定时更新显示
        setInterval(() => {
            this.updateStatsDisplay();
        }, 5000);
    }

    // 获取Token使用效率报告
    getEfficiencyReport() {
        const avgTokensPerRound = this.stats.conversationRounds > 0 
            ? this.stats.totalTokens / this.stats.conversationRounds 
            : 0;

        const avgCostPerRound = this.stats.conversationRounds > 0 
            ? this.stats.totalCost / this.stats.conversationRounds 
            : 0;

        return {
            averageTokensPerRound: Math.round(avgTokensPerRound),
            averageCostPerRound: avgCostPerRound.toFixed(4),
            totalEfficiency: avgTokensPerRound > 0 ? (this.stats.totalCost / this.stats.totalTokens * 1000).toFixed(4) : 0,
            recommendations: this.getOptimizationSuggestion()
        };
    }
}

// 初始化Token监控器
window.tokenMonitor = new TokenMonitor();