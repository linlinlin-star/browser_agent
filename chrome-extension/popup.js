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
  const consoleContent = document.getElementById('console-content');
  const empty = consoleContent.querySelector('.console-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = `console-entry ${type}`;
  
  const time = document.createElement('div');
  time.className = 'console-time';
  time.textContent = new Date().toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    fractionalSecondDigits: 3
  });
  
  const entryText = document.createElement('div');
  entryText.className = 'console-text';
  entryText.textContent = text;
  
  entry.appendChild(time);
  entry.appendChild(entryText);
  consoleContent.appendChild(entry);
  consoleContent.scrollTop = consoleContent.scrollHeight;
}

function clearConsole() {
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
