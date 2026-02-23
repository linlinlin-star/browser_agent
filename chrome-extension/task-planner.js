/**
 * TaskPlanner - Analyzes tasks and decomposes them into manageable sub-goals
 * 
 * This component is responsible for:
 * - Detecting multi-step tasks
 * - Classifying tasks into categories
 * - Analyzing task complexity
 * 
 * Requirements: 1.1, 1.6, 1.7
 */

class TaskPlanner {
  /**
   * Analyzes a task and creates execution plan
   * @param {string} task - User task description
   * @returns {Object} Plan with subGoals, category, stepBudget, heuristic
   */
  static analyzeTask(task) {
    const category = this.classifyTask(task);
    const isMulti = this.isMultiStep(task);

    // Generate sub-goals for multi-step tasks
    const subGoals = isMulti ? this.generateSubGoals(task, category) : [];

    // Calculate step budget based on sub-goal count
    const stepBudget = this.calculateStepBudget(subGoals);

    // Identify task pattern and apply heuristic
    const pattern = this.identifyTaskPattern(task, category, subGoals);
    const heuristic = this.getHeuristicForPattern(pattern);

    return {
      category: category,
      subGoals: subGoals,
      stepBudget: stepBudget,
      pattern: pattern,
      heuristic: heuristic
    };
  }

  
  /**
   * Determines if task requires multiple steps
   * @param {string} task - Task description
   * @returns {boolean}
   */
  static isMultiStep(task) {
    if (!task || typeof task !== 'string') {
      return false;
    }
    
    const lowerTask = task.toLowerCase();
    
    // Check for sequence keywords
    const sequenceKeywords = ['and', 'then', 'after', 'next', 'followed by'];
    const hasSequenceKeyword = sequenceKeywords.some(keyword => lowerTask.includes(keyword));
    
    // Check for content extraction keywords
    const extractionKeywords = ['tell me', 'what is', 'find out', 'show me', 'extract', 'get the'];
    const hasExtractionKeyword = extractionKeywords.some(keyword => lowerTask.includes(keyword));
    
    // Check for multiple verbs (indicates multiple actions)
    const actionVerbs = ['search', 'find', 'open', 'click', 'navigate', 'go to', 'extract', 'get', 'tell', 'show'];
    const verbMatches = actionVerbs.filter(verb => lowerTask.includes(verb));
    const hasMultipleVerbs = verbMatches.length >= 2;
    
    // Multi-step if: has sequence keywords OR (has extraction + action verb) OR multiple verbs
    return hasSequenceKeyword || (hasExtractionKeyword && verbMatches.length >= 1) || hasMultipleVerbs;
  }
  
  /**
   * Classifies task into category
   * @param {string} task - Task description
   * @returns {string} Category name: navigation, search, content_extraction, interaction, composite
   */
  static classifyTask(task) {
    if (!task || typeof task !== 'string') {
      return 'composite';
    }
    
    const lowerTask = task.toLowerCase();
    
    // Navigation: open, go to, visit, navigate
    const navigationKeywords = ['open', 'go to', 'visit', 'navigate to', 'navigate'];
    const isNavigation = navigationKeywords.some(keyword => lowerTask.includes(keyword));
    
    // Search: search, find, look for
    const searchKeywords = ['search', 'find', 'look for', 'search for'];
    const isSearch = searchKeywords.some(keyword => lowerTask.includes(keyword));
    
    // Content extraction: tell me, what is, extract, get the, show me
    const extractionKeywords = ['tell me', 'what is', 'extract', 'get the', 'show me', 'find out'];
    const isExtraction = extractionKeywords.some(keyword => lowerTask.includes(keyword));
    
    // Interaction: click, fill, submit, select, type
    const interactionKeywords = ['click', 'fill', 'submit', 'select', 'type', 'enter'];
    const isInteraction = interactionKeywords.some(keyword => lowerTask.includes(keyword));
    
    // Determine category based on keyword matches
    const matchCount = [isNavigation, isSearch, isExtraction, isInteraction].filter(Boolean).length;
    
    // If multiple categories match, it's composite
    if (matchCount > 1) {
      return 'composite';
    }
    
    // Single category match
    if (isNavigation) return 'navigation';
    if (isSearch) return 'search';
    if (isExtraction) return 'content_extraction';
    if (isInteraction) return 'interaction';
    
    // Default to composite if no clear category
    return 'composite';
  }
  
  /**
   * Generates sub-goals for multi-step task
   * @param {string} task - Task description
   * @param {string} category - Task category
   * @returns {Array} Sub-goal objects (2-5 sub-goals)
   */
  static generateSubGoals(task, category) {
    if (!task || typeof task !== 'string') {
      return [];
    }
    
    const lowerTask = task.toLowerCase();
    const subGoals = [];
    let subGoalId = 1;
    
    // Pattern 1: Search and extract (e.g., "search X and tell me about Y")
    if (this._isSearchAndExtract(lowerTask)) {
      // Extract search query
      const searchQuery = this._extractSearchQuery(task);
      
      // Sub-goal 1: Perform search
      subGoals.push({
        id: subGoalId++,
        description: `Search for "${searchQuery}"`,
        type: 'search',
        completionCriteria: 'Search results page loaded',
        estimatedSteps: 3,
        completed: false
      });
      
      // Sub-goal 2: Extract content
      const extractionTarget = this._extractContentTarget(task);
      subGoals.push({
        id: subGoalId++,
        description: `Extract content from ${extractionTarget}`,
        type: 'content_extraction',
        completionCriteria: `Content from ${extractionTarget} extracted`,
        estimatedSteps: 5,
        completed: false
      });
      
      return subGoals;
    }
    
    // Pattern 2: Navigate and interact (e.g., "go to X and click Y")
    if (this._isNavigateAndInteract(lowerTask)) {
      // Sub-goal 1: Navigate
      const targetSite = this._extractNavigationTarget(task);
      subGoals.push({
        id: subGoalId++,
        description: `Navigate to ${targetSite}`,
        type: 'navigation',
        completionCriteria: 'Page loaded successfully',
        estimatedSteps: 2,
        completed: false
      });
      
      // Sub-goal 2: Interact
      const interactionTarget = this._extractInteractionTarget(task);
      subGoals.push({
        id: subGoalId++,
        description: `Interact with ${interactionTarget}`,
        type: 'interaction',
        completionCriteria: 'Interaction completed',
        estimatedSteps: 3,
        completed: false
      });
      
      return subGoals;
    }
    
    // Pattern 3: Multi-step sequence (e.g., "do X then Y then Z")
    if (this._hasSequenceKeywords(lowerTask)) {
      const steps = this._extractSequenceSteps(task);
      
      for (const step of steps) {
        if (subGoals.length >= 5) break; // Max 5 sub-goals
        
        subGoals.push({
          id: subGoalId++,
          description: step.description,
          type: step.type,
          completionCriteria: step.criteria,
          estimatedSteps: step.estimatedSteps,
          completed: false
        });
      }
      
      return subGoals;
    }
    
    // Pattern 4: Generic multi-step (fallback)
    // Split task into logical components based on conjunctions
    const components = this._splitTaskComponents(task);
    
    for (const component of components) {
      if (subGoals.length >= 5) break; // Max 5 sub-goals
      
      const componentType = this._inferComponentType(component);
      subGoals.push({
        id: subGoalId++,
        description: component.trim(),
        type: componentType,
        completionCriteria: 'Step completed',
        estimatedSteps: 3,
        completed: false
      });
    }
    
    // Ensure we have at least 2 sub-goals for multi-step tasks
    if (subGoals.length < 2) {
      // If we couldn't decompose properly, create 2 generic sub-goals
      return [
        {
          id: 1,
          description: 'Complete first part of task',
          type: category,
          completionCriteria: 'First part completed',
          estimatedSteps: 4,
          completed: false
        },
        {
          id: 2,
          description: 'Complete second part of task',
          type: category,
          completionCriteria: 'Second part completed',
          estimatedSteps: 4,
          completed: false
        }
      ];
    }
    
    return subGoals;
  }
  
  /**
   * Calculates appropriate step budget based on sub-goal count
   * @param {Array} subGoals - Generated sub-goals
   * @returns {number} Step budget (30, 50, or 80)
   * 
   * Requirements: 3.2, 3.3, 3.4, 3.5
   * 
   * Budget mapping:
   * - 0-1 sub-goals: 30 steps (simple tasks) - 增加以支持数据提取和文档生成
   * - 2-3 sub-goals: 50 steps (moderate complexity)
   * - 4-5 sub-goals: 80 steps (complex tasks)
   * 
   * Also allocates steps proportionally across sub-goals based on their
   * estimated complexity, updating each sub-goal's estimatedSteps field.
   */
  static calculateStepBudget(subGoals) {
    // Handle empty or single sub-goal (simple tasks)
    if (!subGoals || subGoals.length <= 1) {
      return 30; // 从 15 增加到 30，支持数据提取和文档生成
    }

    const subGoalCount = subGoals.length;
    let totalBudget;

    // Map sub-goal count to step budget
    if (subGoalCount >= 2 && subGoalCount <= 3) {
      totalBudget = 50; // 从 30 增加到 50
    } else if (subGoalCount >= 4 && subGoalCount <= 5) {
      totalBudget = 80; // 从 50 增加到 80
    } else {
      // Fallback for edge cases (shouldn't happen as generateSubGoals caps at 5)
      totalBudget = 50;
    }

    // Calculate total estimated steps from all sub-goals
    const totalEstimatedSteps = subGoals.reduce((sum, sg) => sum + (sg.estimatedSteps || 3), 0);

    // Allocate steps proportionally across sub-goals
    if (totalEstimatedSteps > 0) {
      let allocatedSteps = 0;

      for (let i = 0; i < subGoals.length; i++) {
        const subGoal = subGoals[i];
        const proportion = (subGoal.estimatedSteps || 3) / totalEstimatedSteps;

        // Calculate proportional allocation
        if (i === subGoals.length - 1) {
          // Last sub-goal gets remaining steps to ensure total equals budget
          subGoal.estimatedSteps = totalBudget - allocatedSteps;
        } else {
          // Round down and track allocated steps
          subGoal.estimatedSteps = Math.floor(totalBudget * proportion);
          allocatedSteps += subGoal.estimatedSteps;
        }

        // Ensure at least 1 step per sub-goal
        if (subGoal.estimatedSteps < 1) {
          subGoal.estimatedSteps = 1;
        }
      }
    }

    return totalBudget;
  }

  /**
   * Identifies the task pattern for heuristic application
   * @param {string} task - Task description
   * @param {string} category - Task category
   * @param {Array} subGoals - Generated sub-goals
   * @returns {string} Pattern: simple_search, search_and_extract, navigation, multi_page_extraction, interaction, or null
   * 
   * Requirements: 8.1
   */
  static identifyTaskPattern(task, category, subGoals) {
    if (!task || typeof task !== 'string') {
      return null;
    }

    const lowerTask = task.toLowerCase();

    // Pattern 1: Simple search (just search, no extraction)
    if (category === 'search' && subGoals.length <= 1) {
      return 'simple_search';
    }

    // Pattern 2: Search and extract (search + content extraction)
    if (this._isSearchAndExtract(lowerTask)) {
      return 'search_and_extract';
    }

    // Pattern 3: Navigation (navigate to a site, possibly verify)
    if (category === 'navigation' || this._isNavigateAndInteract(lowerTask)) {
      return 'navigation';
    }

    // Pattern 4: Multi-page extraction (extract from multiple pages/items)
    const hasMultipleItems = /(?:first|top|all)\s+(?:\d+|two|three|four|five|several|multiple)/i.test(lowerTask);
    const hasExtraction = /tell me|show me|extract|get the|what is|about/i.test(lowerTask);
    if (hasMultipleItems && hasExtraction) {
      return 'multi_page_extraction';
    }

    // Pattern 5: Interaction (find and click/fill/interact)
    if (category === 'interaction' || /click|fill|submit|select|type/i.test(lowerTask)) {
      return 'interaction';
    }

    // No specific pattern identified
    return null;
  }

  /**
   * Gets heuristic guidance for a task pattern
   * @param {string} pattern - Task pattern
   * @returns {Object|null} Heuristic object with guidance, or null if no heuristic
   * 
   * Requirements: 8.2, 8.4, 8.6
   * 
   * Heuristics are advisory and provide best-practice guidance to the LLM.
   * They are not enforced but included in the system prompt to improve efficiency.
   */
  static getHeuristicForPattern(pattern) {
    if (!pattern) {
      return null;
    }

    const heuristics = {
      simple_search: {
        name: 'Simple Search',
        description: 'Execute a search query and verify results appear',
        steps: [
          'Execute search() action with the query',
          'Wait 2 seconds for results to load',
          'Take snapshot to verify results appeared',
          'Call finished() with success'
        ],
        guidance: 'For simple searches, avoid over-verification. Execute search, wait briefly, verify results loaded, and finish.',
        estimatedSteps: 3
      },

      search_and_extract: {
        name: 'Search and Extract',
        description: 'Search for content and extract information from results',
        steps: [
          'Execute search() action with the query',
          'Wait 2 seconds for results to load',
          'Take ONE snapshot to see result structure',
          'Extract content using getText() or getMarkdown() on specific elements',
          'Call finished() with extracted content'
        ],
        guidance: 'After search succeeds, take a single snapshot to identify result elements. Then extract content from specific refs. Avoid multiple snapshots - extract all needed content in one pass.',
        estimatedSteps: 5,
        tips: [
          'Use getText(ref) for titles and snippets',
          'Use getMarkdown() for full article content',
          'Extract multiple items from one snapshot when possible',
          'Don\'t call snapshot() multiple times - reuse the first one'
        ]
      },

      navigation: {
        name: 'Navigation',
        description: 'Navigate to a website and verify page loaded',
        steps: [
          'Execute navigate() action with target URL',
          'Wait 2 seconds for page to load',
          'Optionally verify page title or key element',
          'Call finished() with success'
        ],
        guidance: 'Navigation tasks are straightforward. Navigate to URL, wait for load, optionally verify you\'re on the right page, then finish. Don\'t over-verify.',
        estimatedSteps: 3,
        tips: [
          'Use navigate() for direct URL navigation',
          'Wait 2 seconds after navigation before verification',
          'Verify using page title or key element presence',
          'Don\'t take multiple snapshots unless verification fails'
        ]
      },

      multi_page_extraction: {
        name: 'Multi-Page Extraction',
        description: 'Extract content from multiple pages or items',
        steps: [
          'Navigate to first page or search results',
          'Take snapshot to identify items',
          'Extract content from first N items using getText() or getMarkdown()',
          'If items span multiple pages, navigate to next page and repeat',
          'Call finished() with all extracted content'
        ],
        guidance: 'For multi-item extraction, identify all items in one snapshot when possible. Extract content efficiently using targeted getText() calls. Only navigate to additional pages if items aren\'t all visible.',
        estimatedSteps: 7,
        tips: [
          'Try to extract all items from one page/snapshot',
          'Use getText() for structured data (titles, snippets)',
          'Use getMarkdown() for full content',
          'Track which items you\'ve extracted to avoid duplicates',
          'Summarize long content to stay within token limits'
        ]
      },

      interaction: {
        name: 'Interaction',
        description: 'Find and interact with page elements',
        steps: [
          'Take snapshot to identify target element',
          'Identify element ref from snapshot',
          'Execute click() or fill() action on element',
          'Wait 1 second for action to complete',
          'Optionally verify action succeeded',
          'Call finished() with result'
        ],
        guidance: 'For interaction tasks, take one snapshot to find the element, execute the action, wait briefly, and finish. Avoid excessive verification unless the action is critical.',
        estimatedSteps: 4,
        tips: [
          'Use snapshot() to find interactive elements',
          'Look for buttons, links, inputs with clear labels',
          'Use click(ref) for buttons and links',
          'Use fill(ref, text) for input fields',
          'Wait 1-2 seconds after interaction before verification'
        ]
      }
    };

    return heuristics[pattern] || null;
  }
  
  // Helper methods for pattern recognition
  
  static _isSearchAndExtract(lowerTask) {
    const searchKeywords = ['search', 'find', 'look for'];
    const extractKeywords = ['tell me', 'show me', 'show', 'extract', 'get the', 'what is', 'about'];
    
    const hasSearch = searchKeywords.some(kw => lowerTask.includes(kw));
    const hasExtract = extractKeywords.some(kw => lowerTask.includes(kw));
    
    return hasSearch && hasExtract;
  }
  
  static _isNavigateAndInteract(lowerTask) {
    const navKeywords = ['open', 'go to', 'visit', 'navigate'];
    const interactKeywords = ['click', 'fill', 'submit', 'select', 'type'];
    
    const hasNav = navKeywords.some(kw => lowerTask.includes(kw));
    const hasInteract = interactKeywords.some(kw => lowerTask.includes(kw));
    
    return hasNav && hasInteract;
  }
  
  static _hasSequenceKeywords(lowerTask) {
    const sequenceKeywords = ['then', 'after', 'next', 'followed by'];
    return sequenceKeywords.some(kw => lowerTask.includes(kw));
  }
  
  static _extractSearchQuery(task) {
    // Try to extract quoted text first
    const quotedMatch = task.match(/["'](.*?)["']/);
    if (quotedMatch) {
      return quotedMatch[1];
    }
    
    // Try to extract text after "search for" or "find"
    const searchMatch = task.match(/(?:search|find|look)\s+(?:for\s+)?(.+?)(?:\s+and\s+|$)/i);
    if (searchMatch) {
      // Remove site names like "Baidu", "Google", etc.
      let query = searchMatch[1].trim();
      query = query.replace(/^(?:baidu|google|bing|yahoo)\s+(?:for\s+)?/i, '');
      return query;
    }
    
    return 'specified query';
  }
  
  static _extractContentTarget(task) {
    // Look for "first N", "top N", "all"
    const countMatch = task.match(/(?:first|top)\s+(\w+)/i);
    if (countMatch) {
      return `first ${countMatch[1]} results`;
    }
    
    // Look for "posts", "results", "articles", etc.
    const typeMatch = task.match(/(posts?|results?|articles?|items?)/i);
    if (typeMatch) {
      return typeMatch[1];
    }
    
    return 'content';
  }
  
  static _extractNavigationTarget(task) {
    // Extract site name after navigation keywords
    const navMatch = task.match(/(?:open|go to|visit|navigate to)\s+([^and]+)/i);
    if (navMatch) {
      return navMatch[1].trim();
    }
    
    return 'target site';
  }
  
  static _extractInteractionTarget(task) {
    // Extract target after interaction keywords, being careful with "and" word boundary
    const interactMatch = task.match(/(?:click|fill|submit|select|type)\s+(?:the\s+)?(.+?)(?:\s+and\s+|$)/i);
    if (interactMatch) {
      return interactMatch[1].trim();
    }
    
    return 'target element';
  }
  
  static _extractSequenceSteps(task) {
    // Split by sequence keywords
    const parts = task.split(/\s+(?:then|after|next|followed by)\s+/i);
    
    return parts.map((part, index) => {
      const type = this._inferComponentType(part);
      return {
        description: part.trim(),
        type: type,
        criteria: `Step ${index + 1} completed`,
        estimatedSteps: 3
      };
    });
  }
  
  static _splitTaskComponents(task) {
    // Split by "and" but be careful not to split within quotes
    const parts = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < task.length; i++) {
      const char = task[i];
      
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
        current += char;
      } else if (!inQuotes && task.substr(i, 4).toLowerCase() === ' and ') {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = '';
        i += 3; // Skip " and"
      } else {
        current += char;
      }
    }
    
    if (current.trim()) {
      parts.push(current.trim());
    }
    
    // If we only got 1 part, try splitting by commas
    if (parts.length === 1) {
      return task.split(',').map(p => p.trim()).filter(p => p.length > 0);
    }
    
    return parts;
  }
  
  static _inferComponentType(component) {
    const lowerComp = component.toLowerCase();
    
    if (/search|find|look for/.test(lowerComp)) return 'search';
    if (/open|go to|visit|navigate/.test(lowerComp)) return 'navigation';
    if (/tell me|show me|extract|get the/.test(lowerComp)) return 'content_extraction';
    if (/click|fill|submit|select|type/.test(lowerComp)) return 'interaction';
    
    return 'composite';
  }
}

// Export for Node.js (testing) and browser
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TaskPlanner;
}
