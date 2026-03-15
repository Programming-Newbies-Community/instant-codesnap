// 配置 - 已填入你的JSONBin信息
const CONFIG = {
    BIN_ID: '69b6240aaa77b81da9e669f0',
    API_KEY: '$2a$10$YDUYGDaM4hnGTTQZEBZmxedEsCn3Vpkk1g68vq.0wEYmfBDI/kPmW',
    BASE_URL: 'https://api.jsonbin.io/v3'
};

// 工具函数：生成短ID（6位随机）
function generateShortId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 工具函数：获取当前时间戳（秒）
function now() {
    return Math.floor(Date.now() / 1000);
}

// 存储类 - 处理所有数据操作
class CodeSnapStorage {
    constructor() {
        this.cache = new Map();
        this.init();
    }
    
    // 初始化：从JSONBin加载数据
    async init() {
        try {
            const response = await fetch(`${CONFIG.BASE_URL}/b/${CONFIG.BIN_ID}/latest`, {
                headers: {
                    'X-Master-Key': CONFIG.API_KEY
                }
            });
            const data = await response.json();
            this.cache = new Map(Object.entries(data.record || {}));
            console.log('✅ 数据加载成功，当前片段数:', this.cache.size);
        } catch (e) {
            console.log('ℹ️ 首次使用，创建新存储');
            this.cache = new Map();
        }
    }
    
    // 保存到JSONBin
    async sync() {
        const records = Object.fromEntries(this.cache);
        try {
            await fetch(`${CONFIG.BASE_URL}/b/${CONFIG.BIN_ID}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Master-Key': CONFIG.API_KEY
                },
                body: JSON.stringify(records)
            });
            console.log('✅ 同步成功');
        } catch (e) {
            console.error('❌ 同步失败:', e);
        }
    }
    
    // 保存代码片段
    async save(code, language, expiry) {
        const id = generateShortId();
        const data = {
            code: code,
            lang: language,
            created: now(),
            expiry: expiry === '0' ? 0 : parseInt(expiry)
        };
        
        this.cache.set(id, data);
        await this.sync();
        
        // 清理过期片段（不等待）
        this.cleanup();
        
        return id;
    }
    
    // 获取代码片段
    get(id) {
        const data = this.cache.get(id);
        if (!data) return null;
        
        // 检查是否过期
        if (data.expiry > 0) {
            const age = now() - data.created;
            if (age > data.expiry) {
                this.cache.delete(id);
                this.sync(); // 异步删除
                return null;
            }
        }
        
        return data;
    }
    
    // 清理过期片段
    cleanup() {
        const nowSec = now();
        let changed = false;
        
        for (const [id, data] of this.cache.entries()) {
            if (data.expiry > 0) {
                const age = nowSec - data.created;
                if (age > data.expiry) {
                    this.cache.delete(id);
                    changed = true;
                }
            }
        }
        
        if (changed) {
            this.sync();
        }
    }
}

// 主应用
class InstantCodeSnap {
    constructor() {
        this.storage = new CodeSnapStorage();
        this.initUI();
        this.checkViewMode();
    }
    
    initUI() {
        // 获取DOM元素
        this.createBtn = document.getElementById('createBtn');
        this.clearBtn = document.getElementById('clearBtn');
        this.codeInput = document.getElementById('codeInput');
        this.languageSelect = document.getElementById('language');
        this.expirySelect = document.getElementById('expiry');
        this.resultSection = document.getElementById('resultSection');
        this.shareLink = document.getElementById('shareLink');
        this.copyBtn = document.getElementById('copyBtn');
        this.previewCode = document.getElementById('previewCode');
        this.expiryNote = document.getElementById('expiryNote');
        this.newBtn = document.getElementById('newBtn');
        
        // 绑定事件
        this.createBtn.addEventListener('click', () => this.createSnap());
        this.clearBtn.addEventListener('click', () => this.clearInput());
        this.copyBtn.addEventListener('click', () => this.copyLink());
        this.newBtn.addEventListener('click', () => this.resetToCreate());
    }
    
    async createSnap() {
        const code = this.codeInput.value.trim();
        if (!code) {
            alert('请输入代码片段');
            return;
        }
        
        const language = this.languageSelect.value;
        const expiry = this.expirySelect.value;
        
        try {
            // 显示加载状态
            this.createBtn.textContent = '⏳ 生成中...';
            this.createBtn.disabled = true;
            
            // 保存
            const id = await this.storage.save(code, language, expiry);
            
            // 生成链接（这里用当前域名，实际部署后替换）
            const url = `${window.location.origin}${window.location.pathname}?id=${id}`;
            
            // 显示结果
            this.shareLink.value = url;
            this.previewCode.innerHTML = `<code class="language-${language}">${this.escapeHtml(code)}</code>`;
            
            // 过期说明
            const expiryText = {
                '3600': '1小时后自动销毁',
                '86400': '24小时后自动销毁',
                '604800': '7天后自动销毁',
                '0': '永久保存（但建议重要内容自行备份）'
            }[expiry];
            this.expiryNote.textContent = `⏰ ${expiryText}`;
            
            // 切换界面
            document.querySelector('.editor-section').classList.add('hidden');
            this.resultSection.classList.remove('hidden');
            
        } catch (e) {
            alert('生成失败，请重试');
            console.error(e);
        } finally {
            this.createBtn.textContent = '✨ 生成分享链接';
            this.createBtn.disabled = false;
        }
    }
    
    async checkViewMode() {
        const urlParams = new URLSearchParams(window.location.search);
        const id = urlParams.get('id');
        
        if (id) {
            // 隐藏编辑区
            document.querySelector('.editor-section').classList.add('hidden');
            
            // 等待存储初始化
            setTimeout(async () => {
                const data = await this.storage.get(id);
                if (data) {
                    this.showViewMode(data);
                } else {
                    this.showNotFound();
                }
            }, 500);
        }
    }
    
    showViewMode(data) {
        // 创建查看器
        const viewSection = document.getElementById('viewSection');
        if (!viewSection) {
            // 如果不存在就创建一个
            const section = document.createElement('div');
            section.id = 'viewSection';
            section.className = 'view-section';
            document.querySelector('main').appendChild(section);
        }
        
        const vs = document.getElementById('viewSection');
        vs.classList.remove('hidden');
        vs.innerHTML = `
            <div class="code-viewer">
                <div class="view-header">
                    <span class="view-language">${data.lang}</span>
                    <button id="copyViewBtn" class="copy-btn">📋 复制</button>
                </div>
                <pre class="view-code"><code>${this.escapeHtml(data.code)}</code></pre>
                <div style="margin-top: 16px; color: #8b95a9; font-size: 12px;">
                    ⏰ ${data.expiry === 0 ? '永久保存' : '将在 ' + this.formatTimeLeft(data) + ' 后销毁'}
                </div>
                <button id="backBtn" class="secondary-btn" style="width:100%; margin-top:20px;">← 我也要分享代码</button>
            </div>
        `;
        
        document.getElementById('copyViewBtn').addEventListener('click', () => {
            navigator.clipboard.writeText(data.code);
            alert('✅ 代码已复制');
        });
        
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = window.location.pathname;
        });
    }
    
    showNotFound() {
        const viewSection = document.getElementById('viewSection');
        if (!viewSection) {
            const section = document.createElement('div');
            section.id = 'viewSection';
            section.className = 'view-section';
            document.querySelector('main').appendChild(section);
        }
        
        const vs = document.getElementById('viewSection');
        vs.classList.remove('hidden');
        vs.innerHTML = `
            <div style="background:#0f1217; border-radius:20px; padding:40px 20px; text-align:center;">
                <div style="font-size:60px; margin-bottom:20px;">😢</div>
                <h3>片段不存在或已销毁</h3>
                <p style="color:#8b95a9; margin:20px 0;">可能是过期了，或者ID不对</p>
                <button id="backBtn" class="primary-btn" style="width:100%;">重新分享</button>
            </div>
        `;
        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = window.location.pathname;
        });
    }
    
    copyLink() {
        this.shareLink.select();
        navigator.clipboard.writeText(this.shareLink.value);
        
        // 反馈
        this.copyBtn.textContent = '✅';
        setTimeout(() => {
            this.copyBtn.textContent = '📋';
        }, 1500);
    }
    
    clearInput() {
        this.codeInput.value = '';
        this.codeInput.focus();
    }
    
    resetToCreate() {
        document.querySelector('.editor-section').classList.remove('hidden');
        this.resultSection.classList.add('hidden');
        this.codeInput.value = '';
    }
    
    // 工具：转义HTML防止XSS
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // 工具：格式化剩余时间
    formatTimeLeft(data) {
        if (data.expiry === 0) return '永久';
        const age = now() - data.created;
        const left = data.expiry - age;
        
        if (left < 60) return left + '秒';
        if (left < 3600) return Math.floor(left / 60) + '分钟';
        if (left < 86400) return Math.floor(left / 3600) + '小时';
        return Math.floor(left / 86400) + '天';
    }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
    window.app = new InstantCodeSnap();
});
