// Import LLMServiceClient for chat mode functionality
// Note: In Manifest V3, we need to use importScripts for service workers
// or convert to ES modules. For now, we'll use a dynamic import approach.

let currentTabId = null;
let executionQueue = [];
let isExecuting = false;
let runningAgent = null;
let agentConfig = null;

/**
 * ConversationManager - Manages conversation history for Chat Mode
 * 
 * This class:
 * - Stores messages in memory (not persistent)
 * - Provides methods to add, retrieve, and clear messages
 * - Tracks the current tab ID to reset history when switching tabs
 * 
 * Data Structure:
 * - ConversationState: { tabId, messages, pageContext, isLoading, lastError }
 * - Message: { role, content, timestamp, id }
 * 
 * Requirements: 4.1, 4.4
 */
class ConversationManager {
  constructor() {
    // Initialize conversation state
    this.state = {
      tabId: null,
      messages: [],
      pageContext: null,
      isLoading: false,
      lastError: null
    };
  }

  /**
   * Add a message to the conversation history
   * @param {Object} message - Message object with role and content
   * @param {string} message.role - Message role: 'user', 'assistant', or 'system'
   * @param {string} message.content - Message content
   * @returns {Object} The added message with timestamp and id
   */
  addMessage(message) {
    if (!message || !message.role || !message.content) {
      throw new Error('Invalid message: role and content are required');
    }

    const fullMessage = {
      role: message.role,
      content: message.content,
      timestamp: Date.now(),
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    this.state.messages.push(fullMessage);
    return fullMessage;
  }

  /**
   * Get the conversation history
   * @returns {Array} Array of messages in chronological order
   */
  getHistory() {
    return [...this.state.messages];
  }

  /**
   * Clear the conversation history
   * Resets messages array and clears page context
   */
  clearHistory() {
    this.state.messages = [];
    this.state.pageContext = null;
    this.state.lastError = null;
  }

  /**
   * Get the current tab ID
   * @returns {number|null} Current tab ID or null if not set
   */
  getCurrentTabId() {
    return this.state.tabId;
  }

  /**
   * Set the current tab ID
   * If the tab ID changes, the conversation history is reset
   * @param {number} tabId - The new tab ID
   */
  setCurrentTabId(tabId) {
    if (this.state.tabId !== null && this.state.tabId !== tabId) {
      // Tab changed, reset history
      this.clearHistory();
    }
    this.state.tabId = tabId;
  }

  /**
   * Set the page context for the current conversation
   * @param {Object} pageContext - Page context object
   */
  setPageContext(pageContext) {
    this.state.pageContext = pageContext;
  }

  /**
   * Get the page context for the current conversation
   * @returns {Object|null} Page context or null if not set
   */
  getPageContext() {
    return this.state.pageContext;
  }

  /**
   * Set the loading state
   * @param {boolean} isLoading - Loading state
   */
  setLoading(isLoading) {
    this.state.isLoading = isLoading;
  }

  /**
   * Get the loading state
   * @returns {boolean} Loading state
   */
  isLoading() {
    return this.state.isLoading;
  }

  /**
   * Set the last error
   * @param {string|null} error - Error message or null to clear
   */
  setError(error) {
    this.state.lastError = error;
  }

  /**
   * Get the last error
   * @returns {string|null} Last error message or null
   */
  getError() {
    return this.state.lastError;
  }

  /**
   * Get the complete conversation state
   * @returns {Object} Complete state object
   */
  getState() {
    return { ...this.state };
  }
}

// Create a global instance of ConversationManager
const conversationManager = new ConversationManager();

// Create a global instance of LLMServiceClient
// Note: LLMServiceClient is defined in llm-client.js
// In Manifest V3 service workers, we use importScripts to load external scripts
let llmClient = null;

// Import LLMServiceClient if not already loaded
if (typeof LLMServiceClient === 'undefined') {
  try {
    importScripts('llm-client.js');
  } catch (error) {
    console.error('[Browser Agent] Failed to import llm-client.js:', error);
  }
}

/**
 * Initialize LLM client
 * Loads configuration from storage and creates client instance
 */
async function initializeLLMClient() {
  if (!llmClient) {
    // Create client instance (LLMServiceClient should be available after importScripts)
    if (typeof LLMServiceClient !== 'undefined') {
      llmClient = new LLMServiceClient();
      try {
        await llmClient.loadConfig();
        console.log('[Browser Agent] LLM client initialized successfully');
      } catch (error) {
        console.warn('[Browser Agent] Failed to load LLM config:', error.message);
        // Client is created but not configured - will show error when trying to send message
      }
    } else {
      console.error('[Browser Agent] LLMServiceClient not available');
    }
  }
  return llmClient;
}

function isRestrictedUrl(url) {
  if (!url) return true;
  const restrictedProtocols = ['chrome:', 'chrome-extension:', 'edge:', 'about:'];
  return restrictedProtocols.some(protocol => url.startsWith(protocol));
}

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Browser Agent] Extension installed');
  
  chrome.contextMenus.create({
    id: 'browser-agent-snapshot',
    title: 'Get Page Snapshot',
    contexts: ['all'],
  });
});

chrome.action.onClicked.addListener((tab) => {
  currentTabId = tab.id;
});

async function sendMessageToContent(action, data = {}) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) {
    return { success: false, error: 'No active tab found' };
  }

  if (isRestrictedUrl(tab.url)) {
    console.warn('[Browser Agent] Cannot inject content script into restricted URL:', tab.url);
    return { success: false, error: `Cannot access restricted protocol URL: ${tab.url}` };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
    return response;
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function showNotification(title, message, type = 'info') {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/favicon.ico',
    title: title,
    message: message,
    priority: type === 'error' ? 2 : 1
  });
}

async function startBackgroundTask(task, config) {
  agentConfig = config;
  
  showNotification('Browser Agent', `开始执行: ${task.substring(0, 50)}...`);
  
  try {
    const response = await fetch(config.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: task }],
        temperature: 0.1,
        max_tokens: 100,
      }),
    });

    if (response.ok) {
      showNotification('Browser Agent', '任务执行完成');
      chrome.storage.local.set({ 
        lastTaskStatus: 'completed',
        lastTaskTime: Date.now()
      });
    } else {
      const error = await response.text();
      showNotification('Browser Agent', `任务失败: ${error.substring(0, 100)}`);
      chrome.storage.local.set({ 
        lastTaskStatus: 'failed',
        lastTaskError: error
      });
    }
  } catch (error) {
    showNotification('Browser Agent', `错误: ${error.message}`);
    chrome.storage.local.set({ 
      lastTaskStatus: 'error',
      lastTaskError: error.message
    });
  }
}

function stopBackgroundTask() {
  if (runningAgent) {
    runningAgent.stop();
    runningAgent = null;
  }
  showNotification('Browser Agent', '任务已停止');
}

/**
 * Extract page context from the active tab
 * Coordinates with content script to extract page content for Chat Mode
 * 
 * This function:
 * 1. Gets the active tab
 * 2. Checks if the tab URL is accessible (not restricted)
 * 3. Sends extractPageContext message to content script
 * 4. Handles errors (tab not found, restricted URL, content script not responding)
 * 5. Returns the page context or error
 * 
 * @returns {Promise<Object>} Result object with success status and page context or error
 */
async function extractPageContextFromTab() {
  try {
    // Step 1: Get the active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error('[Browser Agent] No active tab found');
      return { 
        success: false, 
        error: 'No active tab found',
        errorType: 'NO_TAB'
      };
    }

    // Step 2: Check if the URL is restricted
    if (isRestrictedUrl(tab.url)) {
      console.warn('[Browser Agent] Cannot extract content from restricted URL:', tab.url);
      return { 
        success: false, 
        error: '无法访问页面内容',
        errorType: 'RESTRICTED_URL',
        details: `Cannot access restricted protocol URL: ${tab.url}`
      };
    }

    // Step 3: Send message to content script to extract page context
    try {
      const response = await chrome.tabs.sendMessage(tab.id, { 
        action: 'extractPageContext' 
      });

      // Step 4: Handle the response
      if (response && response.title !== undefined && response.url !== undefined) {
        console.log('[Browser Agent] Page context extracted successfully');
        return {
          success: true,
          pageContext: response
        };
      } else {
        console.error('[Browser Agent] Invalid response from content script:', response);
        return {
          success: false,
          error: '无法访问页面内容',
          errorType: 'INVALID_RESPONSE',
          details: 'Content script returned invalid response'
        };
      }
    } catch (error) {
      // Step 5: Handle content script errors
      console.error('[Browser Agent] Error communicating with content script:', error);
      
      // Check if it's a connection error (content script not loaded)
      if (error.message && error.message.includes('Receiving end does not exist')) {
        return {
          success: false,
          error: '无法访问页面内容',
          errorType: 'CONTENT_SCRIPT_NOT_LOADED',
          details: 'Content script is not loaded on this page. Try refreshing the page.'
        };
      }
      
      return {
        success: false,
        error: '无法访问页面内容',
        errorType: 'EXTRACTION_ERROR',
        details: error.message
      };
    }
  } catch (error) {
    console.error('[Browser Agent] Unexpected error in extractPageContextFromTab:', error);
    return {
      success: false,
      error: '无法访问页面内容',
      errorType: 'UNEXPECTED_ERROR',
      details: error.message
    };
  }
}

/**
 * Handle send chat message request from popup
 * 
 * This function implements the complete message processing flow:
 * 1. Receives user message from popup
 * 2. Extracts page context if not already available
 * 3. Adds user message to conversation history
 * 4. Calls LLM API with message, page context, and conversation history
 * 5. Adds assistant response to conversation history
 * 6. Returns response to popup
 * 
 * @param {Object} request - Request object
 * @param {string} request.message - User message
 * @param {number} [request.tabId] - Tab ID (optional, uses active tab if not provided)
 * @returns {Promise<Object>} Response object with success status and content or error
 * 
 * Requirements: 3.1, 3.2, 4.1, 4.2
 */
async function handleSendChatMessage(request) {
  try {
    // Validate input
    if (!request.message || typeof request.message !== 'string') {
      return {
        success: false,
        error: 'Invalid message: message is required'
      };
    }

    const userMessage = request.message.trim();
    if (!userMessage) {
      return {
        success: false,
        error: 'Message cannot be empty'
      };
    }

    // Step 1: Get or set current tab ID
    let tabId = request.tabId;
    if (!tabId) {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        return {
          success: false,
          error: 'No active tab found'
        };
      }
      tabId = tab.id;
    }

    // Update conversation manager with current tab ID
    // This will reset history if tab changed (Requirement 4.5)
    conversationManager.setCurrentTabId(tabId);

    // Step 2: Extract page context if not already available
    let pageContext = conversationManager.getPageContext();
    
    if (!pageContext) {
      console.log('[Browser Agent] Extracting page context...');
      const extractResult = await extractPageContextFromTab();
      
      if (!extractResult.success) {
        return {
          success: false,
          error: extractResult.error || '无法访问页面内容',
          errorType: extractResult.errorType
        };
      }
      
      pageContext = extractResult.pageContext;
      conversationManager.setPageContext(pageContext);
      console.log('[Browser Agent] Page context extracted successfully');
    }

    // Step 3: Add user message to conversation history (Requirement 4.1)
    const userMessageObj = conversationManager.addMessage({
      role: 'user',
      content: userMessage
    });
    console.log('[Browser Agent] User message added to history');

    // Step 4: Initialize and call LLM API (Requirements 3.1, 3.2, 4.2)
    await initializeLLMClient();
    
    if (!llmClient) {
      return {
        success: false,
        error: 'LLM client not available',
        errorType: 'CLIENT_NOT_AVAILABLE'
      };
    }

    // Get conversation history for API request (Requirement 4.2)
    const conversationHistory = conversationManager.getHistory();
    
    // Call LLM API with message, page context, and history
    console.log('[Browser Agent] Calling LLM API...');
    const llmResponse = await llmClient.sendMessage({
      messages: conversationHistory,
      pageContext: pageContext
    });

    // Step 5: Handle LLM response
    if (llmResponse.error) {
      // LLM API returned an error
      console.error('[Browser Agent] LLM API error:', llmResponse.error);
      conversationManager.setError(llmResponse.error);
      
      return {
        success: false,
        error: llmResponse.error,
        errorType: 'LLM_API_ERROR'
      };
    }

    // Step 6: Add assistant response to conversation history (Requirement 4.1)
    const assistantMessageObj = conversationManager.addMessage({
      role: 'assistant',
      content: llmResponse.content
    });
    console.log('[Browser Agent] Assistant response added to history');

    // Clear any previous errors
    conversationManager.setError(null);

    // Step 7: Return response to popup
    return {
      success: true,
      userMessage: userMessageObj,
      assistantMessage: assistantMessageObj,
      content: llmResponse.content
    };

  } catch (error) {
    console.error('[Browser Agent] Error in handleSendChatMessage:', error);
    conversationManager.setError(error.message);
    
    return {
      success: false,
      error: error.message || 'An unexpected error occurred',
      errorType: 'UNEXPECTED_ERROR'
    };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request).then(sendResponse);
  return true;
});

async function handleMessage(request) {
  switch (request.action) {
    case 'startTask':
      await startBackgroundTask(request.task, request.config);
      return { success: true, message: 'Task started in background' };
      
    case 'stopTask':
      stopBackgroundTask();
      return { success: true, message: 'Task stopped' };
      
    case 'getSnapshot':
      return await sendMessageToContent('snapshot', { options: request.options });

    case 'clickRef':
      return await sendMessageToContent('click', { ref: request.ref });

    case 'fillRef':
      return await sendMessageToContent('fill', { ref: request.ref, text: request.text });

    case 'getTextRef':
      return await sendMessageToContent('getText', { ref: request.ref });

    case 'getMarkdown':
      return await sendMessageToContent('getMarkdown');

    case 'getUrl':
      return await sendMessageToContent('getUrl');

    case 'getTitle':
      return await sendMessageToContent('getTitle');

    case 'highlightRef':
      return await sendMessageToContent('highlight', { ref: request.ref });

    case 'scrollRef':
      return await sendMessageToContent('scroll', { ref: request.ref });
      
    case 'search':
      return await sendMessageToContent('search', { text: request.text, submit: request.submit });

    case 'navigate':
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        await chrome.tabs.update(tab.id, { url: request.url });
        return { success: true, message: `Navigated to ${request.url}` };
      }
      return { success: false, error: 'No active tab' };

    case 'goBack':
      await chrome.tabs.goBack();
      return { success: true, message: 'Navigated back' };

    case 'goForward':
      await chrome.tabs.goForward();
      return { success: true, message: 'Navigated forward' };

    case 'refresh':
      await chrome.tabs.reload();
      return { success: true, message: 'Page refreshed' };

    case 'executeActions':
      return await executeActions(request.actions);

    case 'extractPageContext':
      return await extractPageContextFromTab();

    case 'sendChatMessage':
      return await handleSendChatMessage(request);

    case 'clearChatHistory':
      conversationManager.clearHistory();
      return { success: true, message: 'Chat history cleared' };

    default:
      return { success: false, error: `Unknown action: ${request.action}` };
  }
}

async function executeActions(actions) {
  const results = [];

  for (const action of actions) {
    const result = await handleMessage(action);
    results.push({
      action: action.action,
      result,
    });

    if (!result.success) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, action.delay || 500));
  }

  return { success: true, results };
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'browser-agent-snapshot') {
    const result = await sendMessageToContent('snapshot', { options: { interactiveOnly: true } });
    console.log('Snapshot result:', result);
  }
});
