/**
 * LLM Service Client
 * 
 * Provides integration with OpenAI-compatible LLM APIs for the chat mode.
 * Handles API configuration, request construction, and response processing.
 * 
 * Requirements: 5.1, 5.2
 */

/**
 * API Configuration
 * @typedef {Object} APIConfig
 * @property {string} endpoint - API endpoint URL (must be HTTPS)
 * @property {string} apiKey - API authentication key
 * @property {string} model - Model name to use
 * @property {number} timeout - Request timeout in milliseconds (default: 30000)
 */

/**
 * Chat Request
 * @typedef {Object} ChatRequest
 * @property {Message[]} messages - Array of conversation messages
 * @property {PageContext} pageContext - Current page context
 * @property {string} systemPrompt - System prompt template
 */

/**
 * Chat Response
 * @typedef {Object} ChatResponse
 * @property {string} content - Response content from LLM
 * @property {string} [error] - Error message if request failed
 */

/**
 * Message
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role - Message role
 * @property {string} content - Message content
 * @property {number} [timestamp] - Message timestamp
 */

/**
 * Page Context
 * @typedef {Object} PageContext
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} content - Extracted page content
 * @property {number} timestamp - Extraction timestamp
 */

/**
 * LLM Service Client
 * 
 * Manages communication with OpenAI-compatible LLM APIs.
 */
class LLMServiceClient {
  constructor() {
    /** @type {APIConfig|null} */
    this.config = null;
  }

  /**
   * Configure the LLM service client
   * @param {APIConfig} config - API configuration
   * @throws {Error} If configuration is invalid
   * Requirements: 5.1, 10.6
   */
  configure(config) {
    // Set default timeout if not provided
    if (!config.timeout) {
      config.timeout = 30000; // 30 seconds default
    }

    // Temporarily set config for validation
    const previousConfig = this.config;
    this.config = config;

    try {
      // Validate the configuration
      this._validateConfig();
    } catch (error) {
      // Restore previous config if validation fails
      this.config = previousConfig;
      throw error;
    }
  }

  /**
   * Load configuration from chrome.storage.local
   * @returns {Promise<APIConfig|null>} Loaded configuration or null if not found
   * Requirements: 10.5
   */
  async loadConfig() {
    try {
      const result = await chrome.storage.local.get(['apiConfig']);
      
      if (result.apiConfig) {
        // Configure with loaded config (includes validation)
        // If validation fails, the error will be thrown directly
        this.configure(result.apiConfig);
        return result.apiConfig;
      }
      
      return null;
    } catch (error) {
      // If it's a validation error, re-throw it directly
      if (error.message && (
        error.message.includes('API key') ||
        error.message.includes('API endpoint') ||
        error.message.includes('HTTPS') ||
        error.message.includes('URL format')
      )) {
        throw error;
      }
      
      // For other errors (storage access), wrap with context
      console.error('Failed to load API configuration:', error);
      throw new Error('Failed to load API configuration from storage');
    }
  }

  /**
   * Save configuration to chrome.storage.local
   * @param {APIConfig} config - Configuration to save
   * @returns {Promise<void>}
   * Requirements: 10.5
   */
  async saveConfig(config) {
    // Validate before saving
    const previousConfig = this.config;
    this.config = config;

    try {
      this._validateConfig();
      await chrome.storage.local.set({ apiConfig: config });
    } catch (error) {
      this.config = previousConfig;
      throw error;
    }
  }

  /**
   * Send a message to the LLM service
   * @param {ChatRequest} request - Chat request
   * @returns {Promise<ChatResponse>} Chat response
   * Requirements: 5.2, 5.6
   */
  async sendMessage(request) {
    // Validate configuration exists (Requirement 5.3)
    if (!this.config) {
      return {
        content: '',
        error: 'API configuration not set. Please configure API settings.'
      };
    }

    try {
      // Validate configuration
      this._validateConfig();
    } catch (error) {
      return {
        content: '',
        error: error.message
      };
    }

    // Build API request using _buildAPIRequest() (Requirement 5.2)
    const requestBody = this._buildAPIRequest(request.messages, request.pageContext);

    // Use fetch API with timeout using AbortController (Requirement 5.6)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      // Send request to LLM API (Requirement 5.2)
      const response = await fetch(this.config.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      // Clear timeout after response received
      clearTimeout(timeoutId);

      // Parse response and extract content (Requirement 5.2)
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || errorData.message || response.statusText;
        return {
          content: '',
          error: `API error: ${errorMessage}`
        };
      }

      const data = await response.json();

      // Extract content from OpenAI-compatible response format
      if (data.choices && data.choices.length > 0 && data.choices[0].message) {
        return {
          content: data.choices[0].message.content
        };
      }

      // Fallback if response format is unexpected
      return {
        content: '',
        error: 'Unexpected API response format'
      };

    } catch (error) {
      // Clear timeout in case of error
      clearTimeout(timeoutId);

      // Handle timeout error (Requirement 5.6)
      if (error.name === 'AbortError') {
        return {
          content: '',
          error: 'Request timeout. Please check your network connection.'
        };
      }

      // Handle network errors
      if (error instanceof TypeError) {
        return {
          content: '',
          error: 'Network error. Please check your network connection.'
        };
      }

      // Handle other errors
      return {
        content: '',
        error: error.message || 'Unknown error occurred'
      };
    }
  }

  /**
   * Build system prompt with page context
   * @param {PageContext} pageContext - Page context
   * @returns {string} System prompt
   * @private
   */
  _buildSystemPrompt(pageContext) {
    return `你是一个智能浏览器助手。用户正在浏览以下网页：

标题: ${pageContext.title}
URL: ${pageContext.url}

页面内容:
${pageContext.content}

请基于上述页面内容回答用户的问题。如果问题与页面内容无关，请礼貌地说明。`;
  }

  /**
   * Build OpenAI-compatible API request
   * @param {Message[]} messages - Conversation messages
   * @param {PageContext} pageContext - Page context
   * @returns {Object} API request body
   * @private
   * Requirements: 3.1, 4.2, 5.2, 5.4
   */
  _buildAPIRequest(messages, pageContext) {
    // Build system prompt with page context (Requirement 5.4)
    const systemPrompt = this._buildSystemPrompt(pageContext);

    // Construct messages array in OpenAI format (Requirement 5.2)
    // Start with system message containing page context
    const apiMessages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    // Add conversation history messages (Requirement 4.2)
    // Filter out any existing system messages from history to avoid duplicates
    const historyMessages = messages
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role,
        content: msg.content
      }));

    apiMessages.push(...historyMessages);

    // Build OpenAI-compatible request body (Requirement 5.2)
    const requestBody = {
      model: this.config.model,
      messages: apiMessages
    };

    return requestBody;
  }

  /**
   * Validate API configuration
   * @throws {Error} If configuration is invalid
   * @private
   */
  _validateConfig() {
    if (!this.config) {
      throw new Error('API configuration not set');
    }

    if (!this.config.apiKey) {
      throw new Error('API key is required');
    }

    if (!this.config.endpoint) {
      throw new Error('API endpoint is required');
    }

    // Validate URL format first
    try {
      new URL(this.config.endpoint);
    } catch (e) {
      throw new Error('Invalid API endpoint URL format');
    }

    // Validate HTTPS
    if (!this.config.endpoint.startsWith('https://')) {
      throw new Error('API endpoint must use HTTPS protocol');
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LLMServiceClient };
}
