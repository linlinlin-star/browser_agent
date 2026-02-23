let agent = null;
let isRunning = false;
let currentStep = 0;
let maxSteps = 50; // 从 30 增加到 50，支持更复杂的任务

function safeAddEventListener(elementId, event, handler) {
  const element = document.getElementById(elementId);
  if (element) {
    element.addEventListener(event, handler);
  } else {
    console.warn(`[Browser Agent] Element not found: ${elementId}`);
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings();
  await showLastResult();
  setupEventListeners();
  autoResizeTextarea();
});

async function showLastResult() {
  const { lastMessage } = await chrome.storage.local.get(['lastMessage']);
  if (lastMessage) {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    addChatMessage('system', lastMessage, lastMessage.includes('✅') ? '✅' : '❌');
    addConsoleLog(`[RESULT] ${lastMessage}`, lastMessage.includes('✅') ? 'success' : 'error');
    
    await chrome.storage.local.remove(['lastMessage']);
  }
}

async function loadSettings() {
  const { apiConfig, provider } = await chrome.storage.local.get(['apiConfig', 'provider']);
  
  // Load from apiConfig object if it exists
  if (apiConfig) {
    if (apiConfig.apiKey) document.getElementById('api-key').value = apiConfig.apiKey;
    if (apiConfig.endpoint) document.getElementById('api-endpoint').value = apiConfig.endpoint;
    if (apiConfig.model) document.getElementById('model-name').value = apiConfig.model;
  }
  
  // Load provider for UI purposes
  if (provider) document.getElementById('api-provider').value = provider;
}

function setupEventListeners() {
  safeAddEventListener('send-btn', 'click', handleSendInput);
  safeAddEventListener('task-input', 'keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendInput();
    }
  });

  safeAddEventListener('settings-fab', 'click', () => toggleSettings());
  safeAddEventListener('settings-close', 'click', () => toggleSettings());
  safeAddEventListener('save-settings', 'click', saveSettings);
  safeAddEventListener('api-provider', 'change', updateProviderSettings);

  safeAddEventListener('console-clear', 'click', clearConsole);
  
  document.querySelectorAll('.console-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.console-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
    });
  });
}

function autoResizeTextarea() {
  const textarea = document.getElementById('task-input');
  if (textarea) {
    textarea.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });
  }
}

function toggleSettings() {
  const panel = document.getElementById('settings-panel');
  panel.classList.toggle('active');
}

function updateProviderSettings() {
  const provider = document.getElementById('api-provider').value;
  const endpointInput = document.getElementById('api-endpoint');
  const modelInput = document.getElementById('model-name');
  
  const defaults = {
    openai: {
      endpoint: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-4o'
    },
    anthropic: {
      endpoint: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-5-sonnet-20241022'
    },
    deepseek: {
      endpoint: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat'
    },
    custom: {
      endpoint: '',
      model: ''
    }
  };
  
  if (defaults[provider]) {
    endpointInput.placeholder = defaults[provider].endpoint || '输入 API 端点';
    modelInput.placeholder = defaults[provider].model || '输入模型名称';
  }
}

async function saveSettings() {
  const apiKey = document.getElementById('api-key').value.trim();
  const apiEndpoint = document.getElementById('api-endpoint').value.trim();
  const model = document.getElementById('model-name').value.trim();
  const provider = document.getElementById('api-provider').value;
  
  // Create apiConfig object in the format expected by LLMServiceClient
  const apiConfig = {
    endpoint: apiEndpoint,
    apiKey: apiKey,
    model: model,
    timeout: 30000
  };
  
  // Save apiConfig as a single object and provider separately
  await chrome.storage.local.set({ apiConfig, provider });
  
  const status = document.getElementById('settings-status');
  status.textContent = '设置已保存';
  status.className = 'settings-status success';
  
  setTimeout(() => {
    status.className = 'settings-status';
  }, 2000);
}

/**
 * Determine if user input is a chat question or a task
 * @param {string} input - User input text
 * @returns {boolean} - True if chat question, false if task
 */
function determineInputType(input) {
  // Simple heuristics to determine if input is a question or a task
  const taskPatterns = [
    /(打开|关闭|刷新|返回|前进|后退|滚动)/,
    /(帮我|请|麻烦|执行|操作)/,
    /(搜索|查找|点击|填写|提交)/,
    /(导航到|跳转|访问)/
  ];
  
  const questionPatterns = [
    /^(什么|为什么|怎么|如何|哪里|谁|when|what|why|how|where|who)/i,
    /\?|？$/,
    /(讲了|说了|介绍|总结|解释|是什么)/,
    /(这个页面|当前页面|这里|页面上)/
  ];
  
  // Check task patterns FIRST (tasks have priority)
  for (const pattern of taskPatterns) {
    if (pattern.test(input)) {
      return false; // It's a task
    }
  }
  
  // Then check if it matches question patterns
  for (const pattern of questionPatterns) {
    if (pattern.test(input)) {
      return true; // It's a chat question
    }
  }
  
  // Default: treat as task (most short commands are tasks)
  return false;
}

/**
 * Show or hide input loading indicator
 * @param {boolean} show - Whether to show loading
 */
function showInputLoading(show) {
  const sendBtn = document.getElementById('send-btn');
  if (sendBtn) {
    sendBtn.disabled = show;
    sendBtn.textContent = show ? '处理中...' : '发送';
  }
}

/**
 * Handle chat input - send to LLM with page context
 * @param {string} userInput - User's chat message
 */
async function handleChatInput(userInput) {
  addChatMessage('user', userInput, '💬');
  addConsoleLog(`[CHAT] ${userInput}`, 'info');
  
  try {
    // Extract page context and send chat message
    const response = await chrome.runtime.sendMessage({
      action: 'sendChatMessage',
      message: userInput
    });
    
    if (response && response.success) {
      addChatMessage('assistant', response.content, '🤖');
      addConsoleLog('[CHAT] 响应已生成', 'success');
    } else {
      addChatMessage('error', response?.error || '对话失败', '❌');
      addConsoleLog(`[ERROR] ${response?.error}`, 'error');
    }
  } catch (error) {
    addChatMessage('error', '对话出错: ' + error.message, '❌');
    addConsoleLog(`[ERROR] ${error.message}`, 'error');
  }
}

/**
 * Handle task input - execute with browser agent
 * @param {string} task - Task description
 */
async function handleTaskInput(task) {
  document.getElementById('task-name').textContent = task;
  
  addChatMessage('system', task, '🎯');
  addConsoleLog(`[TASK] ${task}`, 'info');

  isRunning = true;
  currentStep = 0;
  document.getElementById('send-btn').disabled = true;

  const { apiConfig } = await chrome.storage.local.get(['apiConfig']);

  agent = new BrowserAgent({
    apiKey: apiConfig.apiKey,
    apiEndpoint: apiConfig.endpoint || 'https://api.openai.com/v1/chat/completions',
    model: apiConfig.model || 'gpt-4o',
    maxSteps: 50, // 从 30 增加到 50，支持数据提取和文档生成任务
    onProgress: handleProgress,
    onError: handleError,
    onAskUser: askUser,
  });

  addConsoleLog('[AGENT] 开始执行任务...', 'info');

  try {
    const result = await agent.run(task);
    
    if (result.stopped) {
      addChatMessage('system', '任务已停止', '⏹️');
      addConsoleLog('[AGENT] 任务已停止', 'warning');
      updateProgress(maxSteps, maxSteps);
    } else if (result.success) {
      let resultText = '✅ 任务完成';
      if (result.result) {
        try {
          const parsed = typeof result.result === 'string' ? JSON.parse(result.result) : result.result;
          if (parsed && typeof parsed === 'object') {
            resultText = `✅ 任务完成\n${JSON.stringify(parsed, null, 2)}`;
          } else {
            resultText = `✅ 任务完成: ${result.result}`;
          }
        } catch {
          resultText = `✅ 任务完成: ${result.result}`;
        }
      }
      addChatMessage('system', resultText, '✅');
      addConsoleLog('[AGENT] 任务成功完成', 'success');
      updateProgress(maxSteps, maxSteps);
    } else {
      addChatMessage('error', '❌ 任务失败: ' + result.error, '❌');
      addConsoleLog(`[ERROR] ${result.error}`, 'error');
    }
  } catch (error) {
    addChatMessage('error', '❌ 错误: ' + error.message, '❌');
    addConsoleLog(`[ERROR] ${error.message}`, 'error');
    handleError(error);
  } finally {
    isRunning = false;
    document.getElementById('send-btn').disabled = false;
  }
}

/**
 * Unified input handler - intelligently routes to chat or task
 */
async function handleSendInput() {
  const input = document.getElementById('task-input');
  const userInput = input.value.trim();
  
  if (!userInput) return;

  const { apiConfig } = await chrome.storage.local.get(['apiConfig']);
  
  if (!apiConfig?.apiKey) {
    addChatMessage('error', '请先在设置中配置 API 密钥', '❌');
    addConsoleLog('[ERROR] API 密钥未配置', 'error');
    return;
  }

  input.value = '';
  input.style.height = 'auto';

  const welcome = document.querySelector('.welcome-message');
  if (welcome) welcome.remove();

  // Show loading
  showInputLoading(true);

  // Determine if this is a chat question or a task
  const isChat = determineInputType(userInput);
  
  addConsoleLog(`[ROUTING] 输入类型: ${isChat ? 'Chat' : 'Task'}`, 'info');
  
  if (isChat) {
    await handleChatInput(userInput);
  } else {
    await handleTaskInput(userInput);
  }
  
  showInputLoading(false);
}

function handleProgress(data) {
  switch (data.type) {
    case 'start':
      addConsoleLog(`[START] 任务开始: ${data.task}`, 'info');
      updateProgress(0, maxSteps);
      break;
      
    case 'step':
      updateProgress(data.step, data.maxSteps);
      addConsoleLog(`[STEP ${data.step}/${data.maxSteps}] 执行中...`, 'info');
      break;
      
    case 'thought':
      const parsed = parseThought(data.content);
      if (parsed.thought) {
        addChatMessage('thought', parsed.thought, '💭');
        addConsoleLog(`[THOUGHT] ${parsed.thought.substring(0, 100)}...`, 'info');
      }
      if (parsed.action) {
        addChatMessage('action', parsed.action, '⚡');
        addConsoleLog(`[ACTION] ${parsed.action}`, 'success');
      }
      break;
      
    case 'action':
      const actionText = `${data.action}${data.args ? '(' + formatArgs(data.args) + ')' : ''}`;
      addChatMessage('action', actionText, '⚡');
      addConsoleLog(`[ACTION] ${actionText}`, 'success');
      break;
      
    case 'complete':
      addChatMessage('system', `完成: ${data.result}`, '✅');
      addConsoleLog(`[COMPLETE] ${data.result}`, 'success');
      break;
      
    case 'stopped':
      addChatMessage('system', '已停止', '⏹️');
      addConsoleLog('[STOPPED] 任务已停止', 'warning');
      break;
      
    case 'incomplete':
      addChatMessage('system', `未完成: ${data.reason}`, '⚠️');
      addConsoleLog(`[INCOMPLETE] ${data.reason}`, 'warning');
      break;
      
    case 'askUser':
      addChatMessage('system', `询问: ${data.question}`, '❓');
      addConsoleLog(`[ASK] ${data.question}`, 'info');
      break;
  }
}

function parseThought(content) {
  let thought = '';
  let action = '';
  
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      thought = parsed.thought || '';
      action = parsed.action || '';
    } else {
      thought = content.slice(0, 200);
    }
  } catch (e) {
    thought = content.slice(0, 200);
  }
  
  return { thought, action };
}

function formatArgs(args) {
  if (!args) return '';
  const keys = Object.keys(args);
  if (keys.length === 0) return '';
  if (keys.length === 1) {
    const val = args[keys[0]];
    if (typeof val === 'string' && val.length < 30) return val;
  }
  return JSON.stringify(args).slice(0, 50);
}

function handleError(error) {
  addChatMessage('error', `错误: ${error.message}`, '❌');
  addConsoleLog(`[ERROR] ${error.message}`, 'error');
}

function addChatMessage(type, text, icon) {
  const messagesContainer = document.getElementById('chat-messages');

  const message = document.createElement('div');
  message.className = `message ${type}`;

  // 移除图标显示
  // const messageIcon = document.createElement('div');
  // messageIcon.className = `message-icon ${type}`;
  // messageIcon.textContent = icon;

  const messageContent = document.createElement('div');
  messageContent.className = 'message-content';

  const messageHeader = document.createElement('div');
  messageHeader.className = 'message-header';

  const messageType = document.createElement('span');
  messageType.className = 'message-type';
  messageType.textContent = type.charAt(0).toUpperCase() + type.slice(1);

  const messageTime = document.createElement('span');
  messageTime.className = 'message-time';
  messageTime.textContent = new Date().toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  messageHeader.appendChild(messageType);
  messageHeader.appendChild(messageTime);

  const messageText = document.createElement('div');
  messageText.className = 'message-text';

  if (text.includes('\n')) {
    messageText.style.whiteSpace = 'pre-wrap';
    messageText.style.fontFamily = 'monospace';
    messageText.style.fontSize = '12px';
  }
  messageText.textContent = text;

  messageContent.appendChild(messageHeader);
  messageContent.appendChild(messageText);

  // 不再添加图标元素
  // message.appendChild(messageIcon);
  message.appendChild(messageContent);

  messagesContainer.appendChild(message);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function addConsoleLog(text, type = 'info') {
  // 初始化日志历史
  if (!window.sessionLogs) {
    window.sessionLogs = [];
  }
  
  // 保存日志到历史
  const logEntry = {
    time: new Date().toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit',
      fractionalSecondDigits: 3
    }),
    text: text,
    type: type
  };
  window.sessionLogs.push(logEntry);
  
  // 只在 Current Session 标签页激活时才显示日志
  const activeTab = document.querySelector('.console-tab.active');
  if (!activeTab || activeTab.dataset.tab !== 'session') {
    return; // 如果不在 session 标签页，不显示
  }
  
  const consoleContent = document.getElementById('console-content');
  const empty = consoleContent.querySelector('.console-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `console-entry ${type}`;
  
  const time = document.createElement('div');
  time.className = 'console-time';
  time.textContent = logEntry.time;
  
  const entryText = document.createElement('div');
  entryText.className = 'console-text';
  entryText.textContent = text;
  
  entry.appendChild(time);
  entry.appendChild(entryText);
  consoleContent.appendChild(entry);
  consoleContent.scrollTop = consoleContent.scrollHeight;
}

function clearConsole() {
  // 清除日志历史
  window.sessionLogs = [];
  
  const consoleContent = document.getElementById('console-content');
  consoleContent.innerHTML = `
    <div class="console-empty">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M9 9h6M9 13h6M9 17h4"/>
      </svg>
      <span>控制台输出将显示在这里</span>
    </div>
  `;
}

function updateProgress(step, total) {
  currentStep = step;
  maxSteps = total;
  const percent = Math.min(100, Math.round((step / total) * 100));
  
  const progressFill = document.getElementById('progress-fill');
  const progressPercent = document.getElementById('progress-percent');
  
  if (progressFill) {
    progressFill.style.width = `${percent}%`;
  }
  if (progressPercent) {
    progressPercent.textContent = `${percent}%`;
  }
}

function askUser(question) {
  return new Promise((resolve) => {
    addChatMessage('system', `❓ ${question}`, '❓');
    addConsoleLog(`[ASK] ${question}`, 'info');
    
    const modal = document.createElement('div');
    modal.className = 'ask-modal';
    modal.innerHTML = `
      <div class="ask-modal-content">
        <div class="ask-modal-title">🤖 Agent 需要您的决策</div>
        <div class="ask-modal-question">${question}</div>
        <textarea class="ask-modal-input" placeholder="请输入您的回答..."></textarea>
        <div class="ask-modal-buttons">
          <button class="ask-modal-btn ask-modal-submit">提交回答</button>
          <button class="ask-modal-btn ask-modal-skip">跳过</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const input = modal.querySelector('.ask-modal-input');
    const submitBtn = modal.querySelector('.ask-modal-submit');
    const skipBtn = modal.querySelector('.ask-modal-skip');
    
    input.focus();
    
    const closeModal = (answer) => {
      modal.remove();
      addChatMessage('system', `💬 用户回答: ${answer}`, '💬');
      addConsoleLog(`[ANSWER] ${answer}`, 'info');
      resolve(answer);
    };
    
    submitBtn.addEventListener('click', () => {
      const answer = input.value.trim() || '继续';
      closeModal(answer);
    });
    
    skipBtn.addEventListener('click', () => {
      closeModal('跳过');
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.ctrlKey) {
        submitBtn.click();
      }
    });
  });
}

// Add modal styles dynamically
const modalStyles = `
.ask-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  backdrop-filter: blur(4px);
}

.ask-modal-content {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 24px;
  max-width: 400px;
  width: 90%;
  box-shadow: var(--shadow);
}

.ask-modal-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 16px;
  text-align: center;
}

.ask-modal-question {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 16px;
  padding: 12px;
  background: var(--bg-tertiary);
  border-radius: var(--radius-sm);
  line-height: 1.5;
}

.ask-modal-input {
  width: 100%;
  min-height: 80px;
  padding: 12px;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text);
  font-size: 14px;
  resize: vertical;
  margin-bottom: 16px;
  font-family: inherit;
}

.ask-modal-input:focus {
  outline: none;
  border-color: var(--primary);
}

.ask-modal-buttons {
  display: flex;
  gap: 12px;
}

.ask-modal-btn {
  flex: 1;
  padding: 12px 16px;
  border: none;
  border-radius: var(--radius-sm);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.ask-modal-submit {
  background: var(--primary-gradient);
  color: white;
}

.ask-modal-submit:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.ask-modal-skip {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.ask-modal-skip:hover {
  background: var(--bg-hover);
}
`;

const styleSheet = document.createElement('style');
styleSheet.textContent = modalStyles;
document.head.appendChild(styleSheet);


// ==================== File Manager ====================

const fileManager = new FileManager();

// 初始化文件管理器
function initFileManager() {
  fileManager.loadFromStorage();
  
  // 标签页切换
  document.querySelectorAll('.console-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      switchConsoleTab(tabName);
    });
  });
  
  // 不要在初始化时渲染文件列表，保持 Current Session 的日志显示
}

// 切换控制台标签页
function switchConsoleTab(tabName) {
  const consoleContent = document.getElementById('console-content');
  
  // 更新标签页激活状态
  document.querySelectorAll('.console-tab').forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  if (tabName === 'files') {
    // 切换到 Files 标签页时，显示文件列表
    renderFileList();
  } else if (tabName === 'session') {
    // 切换到 Current Session 标签页时，恢复日志显示
    restoreSessionLogs();
  }
}

// 恢复会话日志显示
function restoreSessionLogs() {
  const consoleContent = document.getElementById('console-content');
  
  // 如果有保存的日志，恢复显示
  if (window.sessionLogs && window.sessionLogs.length > 0) {
    consoleContent.innerHTML = '';
    window.sessionLogs.forEach(log => {
      const entry = document.createElement('div');
      entry.className = `console-entry ${log.type}`;
      
      const time = document.createElement('div');
      time.className = 'console-time';
      time.textContent = log.time;
      
      const text = document.createElement('div');
      text.className = 'console-text';
      text.textContent = log.text;
      
      entry.appendChild(time);
      entry.appendChild(text);
      consoleContent.appendChild(entry);
    });
  } else {
    // 如果没有日志，显示空状态
    consoleContent.innerHTML = `
      <div class="console-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <path d="M9 9h6M9 13h6M9 17h4"/>
        </svg>
        <span>控制台输出将显示在这里</span>
      </div>
    `;
  }
}
// 渲染文件列表
function renderFileList() {
  const consoleContent = document.getElementById('console-content');
  const files = fileManager.getFiles();
  
  if (files.length === 0) {
    consoleContent.innerHTML = `
      <div class="console-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span>暂无生成的文件</span>
      </div>
    `;
    return;
  }
  
  // 获取统计信息
  const stats = fileManager.getStats();
  const totalSizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
  
  let html = `
    <div class="file-manager-container">
      <div class="file-manager-header">
        <div class="file-search-bar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
          <input type="text" 
                 id="file-search-input" 
                 placeholder="搜索文件...">
        </div>
        <div class="file-stats-bar">
          <span>${stats.totalFiles} 个文件</span>
          <span>·</span>
          <span>${totalSizeMB} MB</span>
        </div>
        <div class="file-filter-bar">
          <button class="filter-btn active" data-filter="all">全部</button>
          <button class="filter-btn" data-filter="csv">📊 CSV</button>
          <button class="filter-btn" data-filter="html">📄 HTML</button>
        </div>
      </div>
      <div class="file-list" id="file-list-content">
  `;
  
  files.forEach(file => {
    const date = new Date(file.createdAt).toLocaleString('zh-CN');
    const typeIcon = file.type === 'csv' ? '📊' : '📄';
    const sizeKB = (file.size / 1024).toFixed(2);
    
    html += `
      <div class="file-item" data-file-id="${file.id}" data-file-type="${file.type}">
        <div class="file-icon">${typeIcon}</div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">${date} · ${sizeKB} KB</div>
        </div>
        <div class="file-actions">
          <button class="file-action-btn" data-action="preview" data-file-id="${file.id}" title="预览">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="file-action-btn" data-action="duplicate" data-file-id="${file.id}" title="复制">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button class="file-action-btn" data-action="download" data-file-id="${file.id}" title="下载">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
          <button class="file-action-btn file-delete-btn" data-action="delete" data-file-id="${file.id}" title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  });
  
  html += `
      </div>
    </div>
  `;
  consoleContent.innerHTML = html;
  
  // 设置事件监听器
  setupFileListEventListeners();
}

// 文件操作事件处理函数
function handleFileAction(e) {
  const button = e.target.closest('.file-action-btn');
  if (!button) return;
  
  const action = button.dataset.action;
  const fileId = button.dataset.fileId;
  
  console.log('[DEBUG] Button clicked:', action, fileId);
  
  switch (action) {
    case 'preview':
      window.previewFile(fileId);
      break;
    case 'duplicate':
      window.duplicateFileById(fileId);
      break;
    case 'download':
      window.downloadFileById(fileId);
      break;
    case 'delete':
      window.deleteFileById(fileId);
      break;
  }
}

// 设置文件列表事件监听器
function setupFileListEventListeners() {
  // 搜索框
  const searchInput = document.getElementById('file-search-input');
  if (searchInput) {
    // 移除旧的事件监听器（如果存在）
    searchInput.removeEventListener('input', handleSearchInput);
    searchInput.addEventListener('input', handleSearchInput);
  }
  
  // 过滤按钮
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.removeEventListener('click', handleFilterClick);
    btn.addEventListener('click', handleFilterClick);
  });
  
  // 文件操作按钮 - 使用事件委托
  const fileListContent = document.getElementById('file-list-content');
  if (fileListContent) {
    fileListContent.removeEventListener('click', handleFileAction);
    fileListContent.addEventListener('click', handleFileAction);
  }
}

// 搜索输入处理
function handleSearchInput(e) {
  window.searchFiles(e.target.value);
}

// 过滤按钮点击处理
function handleFilterClick(e) {
  const filter = e.currentTarget.dataset.filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  e.currentTarget.classList.add('active');
  window.filterFiles(filter);
}

// 搜索文件
window.searchFiles = function(query) {
  const files = fileManager.searchFiles(query);
  updateFileListDisplay(files);
}

// 过滤文件
window.filterFiles = function(type) {
  // 更新按钮状态
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // 过滤文件
  const files = type === 'all' ? fileManager.getFiles() : fileManager.filterByType(type);
  updateFileListDisplay(files);
}

// 更新文件列表显示
function updateFileListDisplay(files) {
  const listContent = document.getElementById('file-list-content');
  if (!listContent) return;
  
  if (files.length === 0) {
    listContent.innerHTML = `
      <div class="console-empty" style="margin: 40px 0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
        </svg>
        <span>未找到匹配的文件</span>
      </div>
    `;
    return;
  }
  
  let html = '';
  files.forEach(file => {
    const date = new Date(file.createdAt).toLocaleString('zh-CN');
    const typeIcon = file.type === 'csv' ? '📊' : '📄';
    const sizeKB = (file.size / 1024).toFixed(2);
    
    html += `
      <div class="file-item" data-file-id="${file.id}" data-file-type="${file.type}">
        <div class="file-icon">${typeIcon}</div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-meta">${date} · ${sizeKB} KB</div>
        </div>
        <div class="file-actions">
          <button class="file-action-btn" data-action="preview" data-file-id="${file.id}" title="预览">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
              <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            </svg>
          </button>
          <button class="file-action-btn" data-action="duplicate" data-file-id="${file.id}" title="复制">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
          </button>
          <button class="file-action-btn" data-action="download" data-file-id="${file.id}" title="下载">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
          <button class="file-action-btn file-delete-btn" data-action="delete" data-file-id="${file.id}" title="删除">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
            </svg>
          </button>
        </div>
      </div>
    `;
  });
  
  listContent.innerHTML = html;
  
  // 重新设置事件监听器
  setupFileListEventListeners();
}

// 复制文件
window.duplicateFileById = function(fileId) {
  console.log('[DEBUG] duplicateFileById called with:', fileId);
  const newFileId = fileManager.duplicateFile(fileId);
  if (newFileId) {
    const file = fileManager.getFile(newFileId);
    addConsoleLog(`[FILE] 文件已复制: ${file.name}`, 'success');
    showToast('文件已复制', 'success');
    renderFileList();
  }
}

// 预览文件
window.previewFile = function(fileId) {
  console.log('[DEBUG] previewFile called with:', fileId);
  const file = fileManager.getFile(fileId);
  if (!file) {
    console.error('[DEBUG] File not found:', fileId);
    return;
  }
  
  const consoleContent = document.getElementById('console-content');
  
  if (file.type === 'csv') {
    renderCSVPreview(file);
  } else {
    renderHTMLPreview(file);
  }
}

// 渲染 CSV 预览
function renderCSVPreview(file) {
  const consoleContent = document.getElementById('console-content');
  
  let html = `
    <div class="file-preview" data-file-id="${file.id}">
      <div class="file-preview-header">
        <button class="back-btn" data-action="back">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M15 19l-7-7 7-7"/>
          </svg>
          返回
        </button>
        <div class="file-preview-title-group">
          <span class="file-preview-title" id="file-title-${file.id}">${file.name}</span>
          <button class="file-action-btn" data-action="rename" data-file-id="${file.id}" title="重命名">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
            </svg>
          </button>
        </div>
        <div class="file-preview-actions">
          <button class="file-action-btn" data-action="add-row" data-file-id="${file.id}" title="添加行">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 4v16m8-8H4"/>
            </svg>
          </button>
          <button class="file-action-btn" data-action="download" data-file-id="${file.id}" title="下载">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="csv-table-container">
        <table class="csv-table" id="csv-table-${file.id}" data-file-id="${file.id}">
          <thead>
            <tr>
  `;
  
  // 表头
  if (file.data.length > 0) {
    file.data[0].forEach((header, colIndex) => {
      html += `<th contenteditable="true" 
                   data-row="0" 
                   data-col="${colIndex}">${header}</th>`;
    });
    html += `<th class="row-actions-header">操作</th>`;
  }
  
  html += `
            </tr>
          </thead>
          <tbody>
  `;
  
  // 数据行
  for (let i = 1; i < file.data.length; i++) {
    html += '<tr>';
    file.data[i].forEach((cell, colIndex) => {
      html += `
        <td contenteditable="true" 
            data-row="${i}" 
            data-col="${colIndex}">
          ${cell}
        </td>
      `;
    });
    html += `
      <td class="row-actions">
        <button class="row-action-btn" data-action="delete-row" data-row="${i}" title="删除行">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </td>
    `;
    html += '</tr>';
  }
  
  html += `
          </tbody>
        </table>
      </div>
      <div class="file-preview-footer">
        <span class="file-stats">${file.data.length - 1} 行 × ${file.data[0]?.length || 0} 列</span>
        <div class="file-footer-actions">
          <button class="btn-secondary" data-action="cancel">取消</button>
          <button class="btn-save" data-action="save" data-file-id="${file.id}">保存更改</button>
        </div>
      </div>
    </div>
  `;
  
  consoleContent.innerHTML = html;
  
  // 设置事件监听器
  setupCSVPreviewEventListeners(file.id);
}

// 设置 CSV 预览事件监听器
function setupCSVPreviewEventListeners(fileId) {
  const preview = document.querySelector('.file-preview');
  if (!preview) return;
  
  // 按钮点击事件
  preview.addEventListener('click', (e) => {
    const button = e.target.closest('button[data-action]');
    if (!button) return;
    
    const action = button.dataset.action;
    const targetFileId = button.dataset.fileId || fileId;
    const row = button.dataset.row;
    
    console.log('[DEBUG] CSV Preview button clicked:', action, targetFileId, row);
    
    switch (action) {
      case 'back':
      case 'cancel':
        renderFileList();
        break;
      case 'rename':
        window.renameFile(targetFileId);
        break;
      case 'add-row':
        window.addRowToCSV(targetFileId);
        break;
      case 'download':
        window.downloadFileById(targetFileId);
        break;
      case 'delete-row':
        window.deleteRowFromCSV(targetFileId, parseInt(row));
        break;
      case 'save':
        window.saveFileChanges(targetFileId);
        break;
    }
  });
  
  // 单元格编辑事件
  const table = document.getElementById(`csv-table-${fileId}`);
  if (table) {
    table.addEventListener('blur', (e) => {
      const cell = e.target;
      if (cell.hasAttribute('contenteditable') && cell.hasAttribute('data-row')) {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const value = cell.textContent;
        window.updateCell(fileId, row, col, value);
      }
    }, true);
  }
}

// 渲染 HTML 预览
function renderHTMLPreview(file) {
  const consoleContent = document.getElementById('console-content');
  
  // 生成 HTML 内容
  let htmlContent = '';
  const blob = fileManager.exportFile(file.id);
  
  if (blob) {
    const reader = new FileReader();
    reader.onload = function(e) {
      const htmlText = e.target.result;
      
      let html = `
        <div class="file-preview">
          <div class="file-preview-header">
            <button class="back-btn" onclick="renderFileList()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M15 19l-7-7 7-7"/>
              </svg>
              返回
            </button>
            <div class="file-preview-title-group">
              <span class="file-preview-title" id="file-title-${file.id}">${file.name}</span>
              <button class="file-action-btn" onclick="renameFile('${file.id}')" title="重命名">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                </svg>
              </button>
            </div>
            <div class="file-preview-actions">
              <button class="file-action-btn" onclick="toggleHTMLViewMode('${file.id}')" title="切换视图">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
              </button>
              <button class="file-action-btn" onclick="downloadFileById('${file.id}')" title="下载">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/>
                </svg>
              </button>
            </div>
          </div>
          <div class="html-preview-tabs">
            <button class="html-tab active" data-mode="preview" onclick="switchHTMLTab('${file.id}', 'preview')">预览</button>
            <button class="html-tab" data-mode="source" onclick="switchHTMLTab('${file.id}', 'source')">源代码</button>
          </div>
          <div class="html-preview-container">
            <div class="html-preview-content" id="html-preview-${file.id}" data-mode="preview">
              <iframe id="html-iframe-${file.id}" style="width: 100%; height: 100%; border: none;"></iframe>
            </div>
            <div class="html-source-content" id="html-source-${file.id}" style="display: none;">
              <pre><code>${escapeHtml(htmlText)}</code></pre>
            </div>
          </div>
        </div>
      `;
      
      consoleContent.innerHTML = html;
      
      // 加载 HTML 到 iframe
      const iframe = document.getElementById(`html-iframe-${file.id}`);
      iframe.srcdoc = htmlText;
    };
    reader.readAsText(blob);
  }
}

// 切换 HTML 标签页
window.switchHTMLTab = function(fileId, mode) {
  const previewContent = document.getElementById(`html-preview-${fileId}`);
  const sourceContent = document.getElementById(`html-source-${fileId}`);
  const tabs = document.querySelectorAll('.html-tab');
  
  tabs.forEach(tab => {
    if (tab.dataset.mode === mode) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });
  
  if (mode === 'preview') {
    previewContent.style.display = 'block';
    sourceContent.style.display = 'none';
  } else {
    previewContent.style.display = 'none';
    sourceContent.style.display = 'block';
  }
}

// HTML 转义
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 添加行到 CSV
window.addRowToCSV = function(fileId) {
  const file = fileManager.getFile(fileId);
  if (!file || !file.data || file.data.length === 0) return;
  
  const colCount = file.data[0].length;
  const newRow = new Array(colCount).fill('');
  file.data.push(newRow);
  
  renderCSVPreview(file);
  addConsoleLog(`[FILE] 已添加新行`, 'info');
}

// 从 CSV 删除行
window.deleteRowFromCSV = function(fileId, rowIndex) {
  const file = fileManager.getFile(fileId);
  if (!file || !file.data || rowIndex < 1) return;
  
  if (confirm('确定要删除这一行吗？')) {
    file.data.splice(rowIndex, 1);
    renderCSVPreview(file);
    addConsoleLog(`[FILE] 已删除第 ${rowIndex} 行`, 'warning');
  }
}

// 重命名文件
window.renameFile = function(fileId) {
  const file = fileManager.getFile(fileId);
  if (!file) return;
  
  const newName = prompt('请输入新的文件名:', file.name);
  if (newName && newName.trim() && newName !== file.name) {
    file.name = newName.trim();
    fileManager.saveToStorage();
    
    const titleElement = document.getElementById(`file-title-${fileId}`);
    if (titleElement) {
      titleElement.textContent = file.name;
    }
    
    addConsoleLog(`[FILE] 文件已重命名为: ${file.name}`, 'success');
  }
}

// 更新单元格
window.updateCell = function(fileId, row, col, value) {
  const file = fileManager.getFile(fileId);
  if (file && file.data[row]) {
    file.data[row][col] = value;
    // 不立即保存，等用户点击"保存更改"
  }
}

// 保存文件更改
window.saveFileChanges = function(fileId) {
  const file = fileManager.getFile(fileId);
  if (file) {
    fileManager.updateFile(fileId, file.data);
    addConsoleLog(`[FILE] 文件已保存: ${file.name}`, 'success');
    
    // 显示保存成功提示
    showToast('保存成功', 'success');
  }
}

// 下载文件
window.downloadFileById = function(fileId) {
  console.log('[DEBUG] downloadFileById called with:', fileId);
  fileManager.downloadFile(fileId);
  const file = fileManager.getFile(fileId);
  addConsoleLog(`[FILE] 文件已下载: ${file?.name || ''}`, 'success');
  showToast('文件已下载', 'success');
}

// 删除文件（增强版）
window.deleteFileById = function(fileId) {
  console.log('[DEBUG] deleteFileById called with:', fileId);
  const file = fileManager.getFile(fileId);
  if (!file) return;
  
  // 创建自定义确认对话框
  const confirmed = confirm(
    `确定要删除文件 "${file.name}" 吗？\n\n` +
    `文件信息：\n` +
    `类型: ${file.type.toUpperCase()}\n` +
    `大小: ${(file.size / 1024).toFixed(2)} KB\n` +
    `创建时间: ${new Date(file.createdAt).toLocaleString('zh-CN')}\n\n` +
    `此操作无法撤销！`
  );
  
  if (confirmed) {
    fileManager.deleteFile(fileId);
    renderFileList();
    addConsoleLog(`[FILE] 文件已删除: ${file.name}`, 'warning');
    showToast('文件已删除', 'warning');
  }
}

// 显示提示消息
function showToast(message, type = 'info') {
  // 移除已存在的 toast
  const existingToast = document.querySelector('.toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  // 显示动画
  setTimeout(() => toast.classList.add('show'), 10);
  
  // 3秒后自动隐藏
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 在文档生成后添加文件
function onDocumentGenerated(filename, type, data, blob) {
  const fileId = fileManager.addFile({
    name: filename,
    type: type === 'excel' ? 'csv' : 'html',
    data: data,
    blob: blob,
    size: blob.size
  });
  
  addConsoleLog(`[FILE] 文件已生成: ${filename}`, 'success');
  
  // 如果当前在 Files 标签页，刷新列表
  const activeTab = document.querySelector('.console-tab.active');
  if (activeTab && activeTab.dataset.tab === 'files') {
    renderFileList();
  }
  
  return fileId;
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 初始化日志历史
  window.sessionLogs = [];
  
  // 初始化文件管理器（但不显示文件列表）
  initFileManager();
  
  // 确保默认显示 Current Session 标签页
  const sessionTab = document.querySelector('.console-tab[data-tab="session"]');
  if (sessionTab) {
    sessionTab.classList.add('active');
  }
  
  // 确保 Files 标签页不是激活状态
  const filesTab = document.querySelector('.console-tab[data-tab="files"]');
  if (filesTab) {
    filesTab.classList.remove('active');
  }
});
