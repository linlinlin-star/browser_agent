/**
 * ExecutionOptimizer - Prevents redundant actions and optimizes execution flow
 * 
 * This component tracks action history, caches snapshots, and validates actions
 * before execution to prevent redundant operations and improve efficiency.
 * 
 * Key optimizations:
 * - Prevents consecutive snapshot() calls (max 2 in a row)
 * - Limits getUrl() to 1 per sub-goal
 * - Caches snapshots within sub-goals
 * - Tracks retry attempts to prevent infinite loops
 * 
 * @class ExecutionOptimizer
 */
class ExecutionOptimizer {
  /**
   * Creates an ExecutionOptimizer instance
   * Initializes tracking state for action history, caching, and counters
   */
  constructor() {
    // Snapshot caching
    this.snapshotCache = null;
    this.cacheSubGoalId = null;
    
    // Action tracking
    this.consecutiveSnapshots = 0;
    this.getUrlCountPerSubGoal = 0;
    this.currentSubGoalId = null;
    
    // Retry tracking: Maps "action:args" to retry count
    this.failureRetries = new Map();
    
    // Action history for analysis
    this.actionHistory = [];
  }
  
  /**
   * Validates an action before execution
   * Applies optimization rules to prevent redundant or inefficient actions
   * 
   * @param {string} action - Action name (e.g., 'snapshot', 'getUrl', 'click')
   * @param {Object} args - Action arguments
   * @param {Object} currentSubGoal - Current sub-goal context
   * @returns {Object} Validation result with structure:
   *   - valid: boolean - Whether action should proceed
   *   - reason: string - Explanation if invalid
   *   - alternative: string - Suggested alternative action if invalid
   */
  validateAction(action, args, currentSubGoal) {
    // Rule 1: Prevent more than 2 consecutive snapshot() calls
    if (action === 'snapshot' && this.consecutiveSnapshots >= 2) {
      return {
        valid: false,
        reason: 'Too many consecutive snapshot() calls without taking action',
        alternative: 'Take an action based on the previous snapshot (click, fill, navigate, etc.) or call finished() if task is complete'
      };
    }
    
    // Rule 2: Limit getUrl() to once per sub-goal
    if (action === 'getUrl' && this.getUrlCountPerSubGoal >= 1) {
      return {
        valid: false,
        reason: 'getUrl() already called once in this sub-goal',
        alternative: 'Use cached URL information or proceed with other actions'
      };
    }
    
    // All validations passed
    return {
      valid: true,
      reason: '',
      alternative: ''
    };
  }
  
  /**
   * Records an action execution for tracking
   * Updates counters and history for optimization decisions
   * 
   * @param {string} action - Action name
   * @param {Object} args - Action arguments
   * @param {Object} result - Action execution result
   */
  recordAction(action, args, result) {
    // Update consecutive snapshot counter
    if (action === 'snapshot') {
      this.consecutiveSnapshots++;
    } else {
      this.consecutiveSnapshots = 0;
    }
    
    // Update getUrl counter
    if (action === 'getUrl') {
      this.getUrlCountPerSubGoal++;
    }
    
    // Add to action history
    this.actionHistory.push({
      action,
      args,
      result,
      timestamp: Date.now()
    });
    
    // Keep history bounded (last 20 actions)
    if (this.actionHistory.length > 20) {
      this.actionHistory.shift();
    }
  }
  
  /**
   * Checks if a snapshot can be served from cache
   * Returns cached snapshot if available for current sub-goal
   * 
   * @param {number} subGoalId - Current sub-goal ID
   * @returns {Object|null} Cached snapshot or null if not available
   */
  getCachedSnapshot(subGoalId) {
    if (this.cacheSubGoalId === subGoalId && this.snapshotCache) {
      return this.snapshotCache;
    }
    return null;
  }
  
  /**
   * Caches a snapshot for the current sub-goal
   * Enables snapshot reuse within the same sub-goal
   * 
   * @param {number} subGoalId - Current sub-goal ID
   * @param {Object} snapshot - Snapshot data to cache
   */
  cacheSnapshot(subGoalId, snapshot) {
    this.snapshotCache = snapshot;
    this.cacheSubGoalId = subGoalId;
  }
  
  /**
   * Clears the snapshot cache
   * Called when sub-goal changes or page state changes
   */
  clearCache() {
    this.snapshotCache = null;
    this.cacheSubGoalId = null;
  }
  
  /**
   * Checks if navigation is necessary
   * Compares target URL with current URL to avoid redundant navigation
   * 
   * @param {string} targetUrl - Target URL to navigate to
   * @param {string} currentUrl - Current page URL
   * @returns {boolean} True if navigation is needed, false if already at target
   */
  isNavigationNeeded(targetUrl, currentUrl) {
    if (!targetUrl || !currentUrl) {
      return true;
    }
    
    // Normalize URLs for comparison
    const normalizeUrl = (url) => {
      try {
        const parsed = new URL(url);
        // Remove trailing slash and hash
        return parsed.origin + parsed.pathname.replace(/\/$/, '') + parsed.search;
      } catch (e) {
        // If URL parsing fails, return as-is
        return url.replace(/\/$/, '').split('#')[0];
      }
    };
    
    const normalizedTarget = normalizeUrl(targetUrl);
    const normalizedCurrent = normalizeUrl(currentUrl);
    
    return normalizedTarget !== normalizedCurrent;
  }
  
  /**
   * Records an action failure and checks if retry is allowed
   * Enforces 2-attempt limit per unique action+args combination
   * 
   * @param {string} action - Action name
   * @param {Object} args - Action arguments
   * @returns {boolean} True if retry is allowed, false if limit reached
   */
  canRetry(action, args) {
    const key = `${action}:${JSON.stringify(args)}`;
    const retries = this.failureRetries.get(key) || 0;
    this.failureRetries.set(key, retries + 1);
    return retries < 2;
  }
  
  /**
   * Resets state for a new sub-goal
   * Clears counters and cache when transitioning between sub-goals
   * 
   * @param {number} subGoalId - New sub-goal ID
   */
  resetForSubGoal(subGoalId) {
    this.currentSubGoalId = subGoalId;
    this.getUrlCountPerSubGoal = 0;
    this.consecutiveSnapshots = 0;
    this.clearCache();
    // Note: We don't clear failureRetries as they should persist across sub-goals
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ExecutionOptimizer;
}
