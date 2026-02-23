const SYSTEM_PROMPT = `You are an intelligent browser automation agent. You execute complex tasks by breaking them into steps and operating the browser.

## 重要规则
- 你的所有回答和思考必须使用中文

## Available Actions
- snapshot(): Get page structure with element refs (e1, e2...) - Call this to understand the page
- click(ref): Click element by ref
- fill(ref, text): Fill text into input by ref
- search(text): Auto-find search input, fill and submit - USE THIS FOR SEARCH TASKS
- navigate(url): Go to URL
- scroll(direction): Scroll page (up/down)
- wait(ms?): Wait (default 1000ms)
- getText(ref): Get element text content
- getMarkdown(): Get page content as markdown
- getUrl(): Get current page URL
- getTitle(): Get page title
- generateDocument(data, type, filename): Generate Excel/Word from extracted data
  * data: Array of objects [{col1: val1, col2: val2}, ...]
  * type: 'excel' or 'word'
  * filename: e.g. 'export.csv' or 'document.html'
- askUser(question): Ask user for decision/input
- finished(result): Mark task complete - ALWAYS call when done!

## Response Format
Return JSON only:
{"thought": "reasoning", "action": "actionName", "args": {...}}

## Multi-Step Task Execution Strategy

### Task Decomposition
When you receive a complex task, it may be broken into sub-goals. Each sub-goal has:
- **Description**: What needs to be accomplished
- **Completion Criteria**: How to know it's done
- **Estimated Steps**: Rough guide for complexity

### Sub-Goal Focus Rules
1. **Focus ONLY on the current sub-goal** - Don't jump ahead
2. **Complete it fully** before considering the next
3. **Check completion criteria** before moving on
4. **Call finished() ONLY when ALL sub-goals are complete**

### Current Context
{DYNAMIC_CONTEXT}

### Progress Tracking
You will see progress updates like:
\`\`\`
Sub-Goal 2/3 (66%): Extract content from first two posts
Steps on current sub-goal: 4
Completion criteria: Content from 2 posts extracted
\`\`\`

Pay attention to:
- **Steps on current sub-goal**: If >8, you may be stuck - try a different approach
- **Completion criteria**: This tells you exactly what success looks like
- **Remaining steps**: Prioritize completion when budget is low

## Common Task Patterns

### Pattern 1: Search and Extract Content
**Example**: "Search Baidu for '莆田' and tell me about the first two posts"

**Efficient Approach**:
1. search("莆田") → wait(2000)
2. snapshot() → identify result elements [e1, e2, ...]
3. getText(e1) → get first result content
4. getText(e2) → get second result content
5. finished({ results: [result1, result2] })

**Key Points**:
- Take ONE snapshot after search completes
- Extract multiple items using specific refs
- Don't call getMarkdown() unless you need full article content
- Collect all requested items before calling finished()

### Pattern 2: Navigate and Verify
**Example**: "Open Bilibili homepage"

**Efficient Approach**:
1. navigate("https://bilibili.com") → wait(2000)
2. getTitle() → verify page loaded
3. finished({ success: true, title: "..." })

**Key Points**:
- Wait after navigation for page to load
- One verification action is enough
- Don't repeatedly check URL or take snapshots

### Pattern 3: Multi-Page Content Extraction
**Example**: "Find the top 3 videos and tell me their titles"

**Efficient Approach**:
1. snapshot() → identify video elements [e1, e2, e3]
2. getText(e1) → get first title
3. getText(e2) → get second title
4. getText(e3) → get third title
5. finished({ titles: [title1, title2, title3] })

**Key Points**:
- Extract multiple items from single snapshot when possible
- Use getText() for specific elements rather than full page getMarkdown()
- Batch similar operations together

### Pattern 4: Search with Fallback
**Example**: "Search for '测试' on current page"

**Efficient Approach**:
1. search("测试") → if success: wait(2000) → finished()
2. If search fails: snapshot() → find textbox ref
3. fill(ref, "测试") → find submit button
4. click(button_ref) → wait(2000) → finished()

**Key Points**:
- Always try search() action first
- Only fall back to manual fill+click if search() fails
- Don't verify search success with extra snapshots - trust the action result

## Content Extraction Strategies

### When to Use Each Action

**snapshot()**: 
- Understanding page structure and finding interactive elements
- Identifying what content is available
- Finding refs for click/fill/getText operations
- **Don't use repeatedly** - reuse information from previous snapshot

**getMarkdown()**:
- Extracting full article or blog post content (>500 words)
- Getting detailed text from content-heavy pages
- When you need formatted text with structure
- **Use sparingly** - it returns a lot of data

**getText(ref)**:
- Extracting specific element text (titles, snippets, labels)
- Getting short content from identified elements
- Extracting multiple specific items (e.g., "first 3 results")
- **Preferred for targeted extraction** - efficient and precise

### Content Extraction by Page Type

**Search Results Pages**:
- Take ONE snapshot to see structure
- Look for [SEARCH-RESULT] markers or repeated patterns
- Use getText(ref) on each result element
- Extract: title, snippet, link for each result
- Example: "First 2 results" → getText(e1), getText(e2)

**Article/Blog Pages**:
- Use getMarkdown() to get full content
- Content will be auto-summarized if >1000 chars
- Look for main content area, ignore navigation/ads
- Extract: title, author, date, body

**Video/Media Pages**:
- Use snapshot() to find video elements
- Look for [VIDEO] markers
- Video elements show: [播放=xxx] [点赞=xxx] [弹幕=xxx]
- Use getText() for titles and descriptions
- Click video ref to open/play

### B站视频信息提取
当任务要求"搜索并告诉我视频信息"时：
1. search(关键词) → wait(2000)
2. snapshot() → 找到 [VIDEO] 标记的元素
3. 从 snapshot 中直接读取视频标题、播放量、点赞数
4. finished({ videos: [{ title: "标题", playCount: "播放量", likeCount: "点赞数" }] })
5. 不需要点击视频，直接从搜索结果页面提取信息

**重要**: snapshot 输出已包含视频的播放量、点赞数信息，格式为：
- video-link "视频标题" [ref=e30] [VIDEO] [播放=3.9万] [点赞=290]

**List/Feed Pages**:
- Use snapshot() to identify list items
- Extract multiple items in sequence
- Use getText() for each item's key information
- Batch similar extractions together

## Decision Trees

### If search() Action Fails
1. Take snapshot() to find search input
2. Identify textbox ref (look for input, search, query in role)
3. fill(ref, query) to enter search term
4. Find submit button ref
5. click(button_ref) to submit
6. wait(2000) for results to load
7. Proceed with extraction

### If Stuck on Sub-Goal (>8 steps)
1. Review what you've tried in recent actions
2. Identify what's not working
3. Try ONE completely different approach:
   - Different element selection
   - Different action sequence
   - Scroll to find more elements
   - Use alternative extraction method
4. If still stuck after new approach:
   - Call askUser() to get guidance, OR
   - Skip to next sub-goal if possible

### If Action Fails Twice
1. **First failure**: Try alternative element or approach
   - Different ref
   - Scroll to make element visible
   - Wait longer for page to load
2. **Second failure**: Don't retry the same thing
   - Move to next sub-goal, OR
   - Call askUser() for help, OR
   - Call finished() with partial results

### If Multiple Elements Match
1. Prioritize elements in main content area
2. Avoid navigation, sidebar, footer elements
3. Look for semantic markers ([VIDEO], [USER], etc.)
4. Choose elements with meaningful text content
5. If unsure, extract from first few matches

## Optimization Rules

### Snapshot Management
- **Don't call snapshot() more than 2 times consecutively** without taking action
- Reuse snapshot data within same sub-goal
- After navigation/click, wait 1-2s before snapshot
- Cache snapshot information - don't re-snapshot unnecessarily

### URL Checking
- **Call getUrl() at most ONCE per sub-goal**
- Only when you need to verify navigation
- Don't repeatedly check URL - trust navigation results

### After Successful Actions
- **search() success** → wait(2000) → proceed (don't verify with snapshot)
- **click() success** → wait(1000) → proceed
- **navigate() success** → wait(2000) → proceed
- **fill() success** → immediately click submit button
- Trust action results - don't over-verify

### Step Budget Awareness
{STEP_BUDGET_WARNING}

When you see "Remaining steps: X (Y% of budget)":
- **>50% remaining**: Explore and be thorough
- **20-50% remaining**: Focus on current sub-goal completion
- **<20% remaining**: Prioritize finishing over perfection
  - Skip optional verifications
  - Use most direct approach
  - Consider calling finished() with partial results

## Critical Rules
1. For SEARCH tasks: ALWAYS use search(text) action first
2. If search() fails: snapshot() → find textbox with ref → fill(ref, text) → find button → click
3. Call finished() IMMEDIATELY when goal achieved
4. DO NOT repeat the same action - try alternatives
5. DO NOT call getUrl() more than once per sub-goal
6. DO NOT call snapshot() more than twice without taking action
7. Focus on CURRENT sub-goal only - don't jump ahead

## Task Completion Guide
- "Search X" task: search(X) → wait(2) → finished()
- "Open website X": navigate(X) → wait(2) → finished()
- "Find and play video": search(X) → find [VIDEO] element → click → finished()
- "Watch video": Click video link → video loads → finished()
- "Search and extract N items": search(X) → wait(2) → snapshot() → getText(e1)...getText(eN) → finished()

## Important
- After clicking a video link, check if the URL contains "video/BV" or "video/av" → Then call finished()
- DO NOT repeatedly call snapshot/getMarkdown without taking action
- If you see video playing, call finished() to complete the task
- When extracting multiple items, do it efficiently in sequence from one snapshot

## Element Markers
- [VIDEO] = video link
- [USER] = user profile link
- [FOLLOW] = follow/subscribe button
- [USER-CARD] = user card in results
- [SEARCH-RESULT] = search result item

## Common Patterns

### Search on any website:
1. search(keyword) → wait(2) → finished()
2. If search fails: snapshot() → fill(ref, keyword) → click button → finished()

### Navigate to website:
1. navigate(url) → wait(2) → finished()

### Follow user on Bilibili:
1. search(username) → wait(2) → snapshot()
2. Find [USER] or [FOLLOW] → click → finished()

### Extract search results:
1. search(keyword) → wait(2) → snapshot()
2. getText(e1) → getText(e2) → ... → getText(eN)
3. finished({ results: [...] })

## Anti-Loop Rules
- Max 2 getUrl() calls per task
- Max 5 snapshot() calls per task
- After 3 failed attempts, call finished() or askUser()
- Don't repeat the same action with same args more than twice`;

class BrowserAgent {
  constructor(config = {}) {
      this.apiKey = config.apiKey || '';
      this.apiEndpoint = config.apiEndpoint || 'https://api.openai.com/v1/chat/completions';
      this.model = config.model || 'gpt-4o';
      this.maxSteps = config.maxSteps || 50; // 从 30 增加到 50，支持更复杂的任务
      this.stepCount = 0;
      this.history = [];
      this.stopped = false;
      this.waitingForUser = false;
      this.userAnswer = null;
      this.lastActions = [];
      this.lastUrls = [];
      this.currentRefs = {};
      this.currentTask = '';
      this.lastObservation = null; // For redundancy detection
      this.focusedSnapshotRegion = null; // For focused snapshot requests
      this.taskState = {
        subGoals: [],
        currentSubGoal: 0,
        completedActions: [],
        failedActions: [],
        pageHistory: [],
      };
      this.onProgress = config.onProgress || (() => {});
      this.onError = config.onError || (() => {});
      this.onAskUser = config.onAskUser || (() => Promise.resolve(''));

      // Initialize ExecutionOptimizer
      if (typeof ExecutionOptimizer !== 'undefined') {
        this.executionOptimizer = new ExecutionOptimizer();
      } else {
        this.executionOptimizer = null;
      }

      // Initialize execution trace system
      this.traceHistory = [];
      this.onTrace = config.onTrace || null;
    }

  /**
   * Logs execution trace event for debugging and analysis
   * @param {string} eventType - Type of event (subGoalStart, subGoalComplete, loopDetected, stuck, optimization, actionStart, actionComplete, llmCallStart, llmCallComplete, taskComplete)
   * @param {Object} data - Event-specific data
   */
  logTrace(eventType, data = {}) {
    const timestamp = new Date().toISOString();
    const traceEvent = {
      timestamp,
      eventType,
      step: this.stepCount,
      ...data
    };

    // Log to console with structured format
    console.log(`[Trace:${eventType}]`, JSON.stringify(traceEvent, null, 2));

    // Store in trace history for later analysis
    if (!this.traceHistory) {
      this.traceHistory = [];
    }
    this.traceHistory.push(traceEvent);

    // Emit trace event for external logging systems
    if (this.onTrace) {
      this.onTrace(traceEvent);
    }
  }

  /**
   * Gets execution trace history
   * @returns {Array} Array of trace events
   */
  getTraceHistory() {
    return this.traceHistory || [];
  }

  /**
   * Exports trace history as JSON string
   * @returns {string} JSON string of trace history
   */
  exportTraceHistory() {
    return JSON.stringify(this.traceHistory || [], null, 2);
  }

  /**
   * Clears trace history
   */
  clearTraceHistory() {
    this.traceHistory = [];
  }


  stop() {
    this.stopped = true;
  }

  answerUser(answer) {
    this.userAnswer = answer;
    this.waitingForUser = false;
  }

  getRefData(ref) {
    return this.currentRefs[ref] || null;
  }

  /**
   * Checks if current sub-goal completion criteria are met
   * @param {Object} subGoal - Current sub-goal
   * @param {string} action - Last action executed
   * @param {Object} result - Action execution result
   * @param {string} observation - Last observation
   * @returns {boolean} True if sub-goal is complete
   */
  isSubGoalComplete(subGoal, action, result, observation) {
    if (!subGoal || !subGoal.completionCriteria) {
      return false;
    }
    
    const criteria = subGoal.completionCriteria.toLowerCase();
    const obsLower = (observation || '').toLowerCase();
    
    // Check for common completion patterns
    if (criteria.includes('search') && criteria.includes('loaded')) {
      // Search results page loaded
      return action === 'search' && result?.success;
    }
    
    if (criteria.includes('content') && criteria.includes('extracted')) {
      // Content extracted
      return (action === 'getMarkdown' || action === 'getText') && result?.success;
    }
    
    if (criteria.includes('navigated') || criteria.includes('page loaded')) {
      // Navigation complete
      return action === 'navigate' && result?.success;
    }
    
    if (criteria.includes('clicked') || criteria.includes('button')) {
      // Click action complete
      return action === 'click' && result?.success;
    }
    
    // Check if observation indicates completion
    if (obsLower.includes('complete') || obsLower.includes('success')) {
      return true;
    }
    
    return false;
  }

  detectLoop(action, args, observation = '') {
    try {
      const actionKey = `${action}:${JSON.stringify(args || {})}`;
      this.lastActions.push(actionKey);
      if (this.lastActions.length > 15) {
        this.lastActions.shift();
      }
      
      // Track navigation history for page navigation loop detection
      if (action === 'navigate' && args?.url) {
        if (!this.navigationHistory) {
          this.navigationHistory = [];
        }
        this.navigationHistory.push(args.url);
        if (this.navigationHistory.length > 10) {
          this.navigationHistory.shift();
        }
      }
      
      // Initialize loop detection counters if not exists
      if (!this.loopDetectionState) {
        this.loopDetectionState = {
          sameActionDifferentArgs: { count: 0, detected: false },
          pageNavigation: { count: 0, detected: false },
          consecutiveSnapshots: { count: 0, detected: false },
          snapshotWaitPattern: { count: 0, detected: false }
        };
      }
      
      const recentActions = this.lastActions.slice(-10);
      
      // Check for productive iteration indicators
      const isProductiveIteration = this.isProductiveIteration(action, args, observation, recentActions);
      
      // Pattern 1: Same action with different arguments (threshold: 3)
      const actionOnlyCounts = {};
      for (const a of recentActions) {
        const actionName = a.split(':')[0];
        actionOnlyCounts[actionName] = (actionOnlyCounts[actionName] || 0) + 1;
      }
      
      for (const [actionName, count] of Object.entries(actionOnlyCounts)) {
        if (count > 3 && actionName !== 'wait') {
          // Check if these are different arguments
          const sameActionEntries = recentActions.filter(a => a.split(':')[0] === actionName);
          const uniqueArgs = new Set(sameActionEntries);
          if (uniqueArgs.size > 1) {
            this.loopDetectionState.sameActionDifferentArgs.count++;
            this.loopDetectionState.sameActionDifferentArgs.detected = true;
            
            // Calculate confidence based on productivity
            let confidence = 0.9;
            if (isProductiveIteration) {
              confidence = 0.5; // Lower confidence if it seems productive
            }
            
            const loopResult = { 
              detected: true, 
              reason: 'same_action_different_args',
              pattern: 'sameActionDifferentArgs',
              confidence: confidence,
              actionName: actionName,
              count: count,
              productive: isProductiveIteration
            };
            
            // Log loop detection trace
            this.logTrace('loopDetected', {
              loopType: loopResult.pattern,
              confidence: loopResult.confidence,
              recentActions: this.lastActions.slice(-5),
              actionName: actionName,
              count: count,
              productive: isProductiveIteration
            });
            
            return loopResult;
          }
        }
      }
      
      // Pattern 2: Page navigation loop (threshold: 2 - navigating between same 2 pages)
      if (this.navigationHistory && this.navigationHistory.length >= 4) {
        const recent4 = this.navigationHistory.slice(-4);
        // Check if navigating between 2 URLs repeatedly
        const uniqueUrls = new Set(recent4);
        if (uniqueUrls.size === 2) {
          // Check if it's alternating pattern
          const url1 = recent4[0];
          const url2 = recent4[1];
          if (recent4[2] === url1 && recent4[3] === url2) {
            this.loopDetectionState.pageNavigation.count++;
            this.loopDetectionState.pageNavigation.detected = true;
            
            // Navigation loops are rarely productive
            return { 
              detected: true, 
              reason: 'page_navigation_loop',
              pattern: 'pageNavigation',
              confidence: 0.95,
              urls: [url1, url2],
              productive: false
            };
          }
        }
      }
      
      // Pattern 3: Consecutive snapshots (threshold: 3)
      let consecutiveSnapshots = 0;
      for (let i = recentActions.length - 1; i >= 0; i--) {
        const actionName = recentActions[i].split(':')[0];
        if (actionName === 'snapshot') {
          consecutiveSnapshots++;
        } else if (actionName !== 'wait') {
          // Allow wait between snapshots, but other actions break the chain
          break;
        }
      }
      
      if (consecutiveSnapshots >= 3) {
        this.loopDetectionState.consecutiveSnapshots.count++;
        this.loopDetectionState.consecutiveSnapshots.detected = true;
        
        // Multiple snapshots might be productive if page is changing
        let confidence = 0.85;
        if (isProductiveIteration) {
          confidence = 0.6;
        }
        
        return { 
          detected: true, 
          reason: 'consecutive_snapshots',
          pattern: 'consecutiveSnapshots',
          confidence: confidence,
          count: consecutiveSnapshots,
          productive: isProductiveIteration
        };
      }
      
      // Pattern 4: Snapshot-wait-snapshot pattern
      const last6Actions = recentActions.slice(-6).map(a => a.split(':')[0]);
      let snapshotWaitCount = 0;
      for (let i = 0; i < last6Actions.length - 2; i++) {
        if (last6Actions[i] === 'snapshot' && 
            last6Actions[i + 1] === 'wait' && 
            last6Actions[i + 2] === 'snapshot') {
          snapshotWaitCount++;
        }
      }
      
      if (snapshotWaitCount >= 2) {
        this.loopDetectionState.snapshotWaitPattern.count++;
        this.loopDetectionState.snapshotWaitPattern.detected = true;
        
        // Waiting for page changes can be productive
        let confidence = 0.8;
        if (isProductiveIteration) {
          confidence = 0.5;
        }
        
        return { 
          detected: true, 
          reason: 'snapshot_wait_pattern',
          pattern: 'snapshotWaitPattern',
          confidence: confidence,
          count: snapshotWaitCount,
          productive: isProductiveIteration
        };
      }
      
      // Legacy detection: Exact same action repeated
      const actionCounts = {};
      for (const a of recentActions) {
        actionCounts[a] = (actionCounts[a] || 0) + 1;
      }
      
      for (const [key, count] of Object.entries(actionCounts)) {
        if (count >= 3) {
          return { 
            detected: true, 
            reason: 'same_action_repeated',
            pattern: 'legacy',
            confidence: 1.0,
            productive: false
          };
        }
      }
      
      // Legacy detection: Too many of specific actions
      if (actionOnlyCounts['getUrl'] >= 2) {
        return { 
          detected: true, 
          reason: 'too_many_getUrl',
          pattern: 'legacy',
          confidence: 0.9,
          productive: false
        };
      }
      if (actionOnlyCounts['snapshot'] >= 5) {
        return { 
          detected: true, 
          reason: 'too_many_snapshots',
          pattern: 'legacy',
          confidence: 0.85,
          productive: isProductiveIteration
        };
      }
      if (actionOnlyCounts['wait'] >= 4) {
        return { 
          detected: true, 
          reason: 'too_many_waits',
          pattern: 'legacy',
          confidence: 0.7,
          productive: isProductiveIteration
        };
      }
      
      // Special case: Video playing is productive, not a loop
      if (observation.includes('videoOpened') || observation.includes('Video opened')) {
        return { detected: false, canFinish: true, reason: 'video_playing' };
      }
      
      return { detected: false };
    } catch (error) {
      console.error('[Agent] Loop detection failed:', error);
      this.logTrace('error', {
        component: 'LoopDetector',
        error: error.message,
        fallback: 'assume no loop detected'
      });
      return { detected: false }; // Safe default
    }
  }

  isProductiveIteration(action, args, observation, recentActions) {
    // Indicators of productive iteration:
    
    // 1. Different results/observations each time
    if (this.lastObservations && this.lastObservations.length >= 2) {
      const lastTwo = this.lastObservations.slice(-2);
      if (lastTwo[0] !== lastTwo[1]) {
        // Observations are changing - likely productive
        return true;
      }
    }
    
    // 2. Extracting content from multiple items (getText on different refs)
    if (action === 'getText' || action === 'getMarkdown') {
      const recentGetTexts = recentActions.filter(a => a.startsWith('getText:') || a.startsWith('getMarkdown:'));
      if (recentGetTexts.length >= 2) {
        // Check if refs are different
        const refs = recentGetTexts.map(a => {
          try {
            const parsed = JSON.parse(a.split(':')[1]);
            return parsed.ref || parsed.selector;
          } catch {
            return null;
          }
        });
        const uniqueRefs = new Set(refs.filter(r => r !== null));
        if (uniqueRefs.size >= 2) {
          // Extracting from different elements - productive
          return true;
        }
      }
    }
    
    // 3. Navigating to different pages (not back and forth)
    if (action === 'navigate' && this.navigationHistory) {
      const recent3 = this.navigationHistory.slice(-3);
      const uniqueUrls = new Set(recent3);
      if (uniqueUrls.size === recent3.length) {
        // All different URLs - productive exploration
        return true;
      }
    }
    
    // 4. Clicking different elements
    if (action === 'click') {
      const recentClicks = recentActions.filter(a => a.startsWith('click:'));
      if (recentClicks.length >= 2) {
        const refs = recentClicks.map(a => {
          try {
            const parsed = JSON.parse(a.split(':')[1]);
            return parsed.ref;
          } catch {
            return null;
          }
        });
        const uniqueRefs = new Set(refs.filter(r => r !== null));
        if (uniqueRefs.size >= 2) {
          // Clicking different elements - productive
          return true;
        }
      }
    }
    
    // 5. Progress indicators in observation
    if (observation) {
      const progressIndicators = [
        'success',
        'completed',
        'extracted',
        'found',
        'loaded',
        'opened',
        'clicked',
        'filled',
        'navigated'
      ];
      
      for (const indicator of progressIndicators) {
        if (observation.toLowerCase().includes(indicator)) {
          return true;
        }
      }
    }
    
    // 6. Working with sub-goals (making progress through sub-goals is productive)
    if (this.progressTracker && this.progressTracker.subGoals) {
      const completedCount = this.progressTracker.subGoals.filter(sg => sg.completed).length;
      if (completedCount > 0) {
        // Making progress through sub-goals
        return true;
      }
    }
    
    // Default: not productive
    return false;
  }

  getAlternatives(loopResult, currentSubGoal = null) {
    if (!loopResult.detected) {
      return [];
    }
    
    const alternatives = [];
    
    switch (loopResult.pattern) {
      case 'sameActionDifferentArgs':
        alternatives.push({
          action: 'Try a completely different action type',
          suggestion: `You've tried ${loopResult.actionName} multiple times with different arguments. Consider using a different approach entirely.`
        });
        
        if (loopResult.actionName === 'click') {
          alternatives.push({
            action: 'Use getText or getMarkdown',
            suggestion: 'Instead of clicking, try extracting content directly with getText() or getMarkdown().'
          });
        } else if (loopResult.actionName === 'getText') {
          alternatives.push({
            action: 'Take a snapshot to reassess',
            suggestion: 'Take a fresh snapshot() to see the current page state and identify better elements.'
          });
        } else if (loopResult.actionName === 'fill') {
          alternatives.push({
            action: 'Look for alternative input methods',
            suggestion: 'Try finding a different search box or input field, or use the search() action if available.'
          });
        }
        
        if (currentSubGoal) {
          alternatives.push({
            action: 'Skip to next sub-goal',
            suggestion: `Current sub-goal may not be achievable. Consider moving to the next sub-goal.`
          });
        }
        break;
        
      case 'pageNavigation':
        alternatives.push({
          action: 'Stop navigating back and forth',
          suggestion: `You're navigating between ${loopResult.urls[0]} and ${loopResult.urls[1]} repeatedly. Stay on one page and complete the task there.`
        });
        alternatives.push({
          action: 'Extract content from current page',
          suggestion: 'Use getMarkdown() or getText() to extract what you need from the current page instead of navigating.'
        });
        alternatives.push({
          action: 'Call finished() if task is complete',
          suggestion: 'If you already have the information needed, call finished() with the results.'
        });
        break;
        
      case 'consecutiveSnapshots':
        alternatives.push({
          action: 'Take action instead of observing',
          suggestion: `You've taken ${loopResult.count} snapshots without acting. Use the information from your last snapshot to take action.`
        });
        alternatives.push({
          action: 'Use getText() for specific content',
          suggestion: 'If you need specific content, use getText(ref) instead of taking more snapshots.'
        });
        alternatives.push({
          action: 'Use getMarkdown() for full content',
          suggestion: 'If you need full page content, use getMarkdown() instead of repeated snapshots.'
        });
        break;
        
      case 'snapshotWaitPattern':
        alternatives.push({
          action: 'Stop waiting for changes',
          suggestion: 'The page is not changing. Take action based on what you see instead of waiting.'
        });
        alternatives.push({
          action: 'Interact with the page',
          suggestion: 'Click, fill, or navigate to make progress instead of passively observing.'
        });
        alternatives.push({
          action: 'Extract content and finish',
          suggestion: 'If the page has the information you need, extract it with getText() or getMarkdown() and call finished().'
        });
        break;
        
      case 'legacy':
        if (loopResult.reason === 'too_many_getUrl') {
          alternatives.push({
            action: 'Stop checking URL',
            suggestion: 'You already know the current URL. Focus on taking action instead of checking it again.'
          });
        } else if (loopResult.reason === 'too_many_snapshots') {
          alternatives.push({
            action: 'Act on your observations',
            suggestion: 'You have enough information from previous snapshots. Take action now.'
          });
        } else if (loopResult.reason === 'too_many_waits') {
          alternatives.push({
            action: 'Stop waiting',
            suggestion: 'Waiting is not helping. Take action or try a different approach.'
          });
        } else {
          alternatives.push({
            action: 'Try a different approach',
            suggestion: 'You are repeating the same action. Try something completely different.'
          });
        }
        break;
    }
    
    // Always add the option to finish if we have results
    alternatives.push({
      action: 'Call finished() if done',
      suggestion: 'If you have gathered the information needed to complete the task, call finished() with your results.'
    });
    
    return alternatives;
  }

  updateTaskState(action, args, result) {
    if (result?.success) {
      this.taskState.completedActions.push({
        action,
        args,
        timestamp: Date.now()
      });
    } else if (result?.success === false) {
      this.taskState.failedActions.push({
        action,
        args,
        error: result?.error,
        timestamp: Date.now()
      });
    }
    
    if (action === 'navigate' || (action === 'click' && result?.navigate)) {
      this.taskState.pageHistory.push({
        url: result?.navigate || args?.url,
        timestamp: Date.now()
      });
    }
  }

  getTaskContext() {
    const completedCount = this.taskState.completedActions.length;
    const failedCount = this.taskState.failedActions.length;
    const pageCount = this.taskState.pageHistory.length;
    
    return {
      step: this.stepCount,
      maxSteps: this.maxSteps,
      completedActions: completedCount,
      failedActions: failedCount,
      pagesVisited: pageCount,
      lastPage: this.taskState.pageHistory[this.taskState.pageHistory.length - 1]?.url || 'unknown'
    };
  }

  async callLLM(messages) {
    if (this.stopped) {
      throw new Error('Agent stopped by user');
    }
    if (!this.apiKey) {
      throw new Error('API key not configured');
    }

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: messages,
        temperature: 0.1,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid API response format');
    }

    return data.choices[0].message.content;
  }

  parseResponse(response) {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          thought: parsed.thought || '',
          action: parsed.action || 'unknown',
          args: parsed.args || {}
        };
      }
    } catch (e) {
      console.error('[Agent] Failed to parse response:', e);
    }
    return { thought: response, action: 'unknown', args: {} };
  }

  truncateContent(content, maxLength = 2500) {
    if (!content) return '';
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '\n...[content truncated to save tokens]';
  }

  summarizeHistory() {
      if (this.history.length <= 10) return null;

      // Split history into older actions and recent actions
      const olderActions = this.history.slice(0, -5);
      const recentActions = this.history.slice(-5);

      // Group older actions by type and count
      const actionCounts = {};
      olderActions.forEach(h => {
        const actionType = h.action;
        actionCounts[actionType] = (actionCounts[actionType] || 0) + 1;
      });

      // Build older actions summary
      const olderSummary = Object.entries(actionCounts)
        .map(([action, count]) => `${count}× ${action}`)
        .join(', ');

      // Build recent actions summary
      const recentSummary = recentActions.map(h => 
        `${h.action}(${JSON.stringify(h.args)})`
      ).join(' → ');

      return `Earlier actions (${olderActions.length} total): ${olderSummary}\nRecent actions: ${recentSummary}`;
    }

  removeRedundantInfo(currentObservation, previousObservation) {
    if (!currentObservation || !previousObservation) return currentObservation;

    // Normalize observations for comparison (remove special characters and extra whitespace)
    const normalize = (str) => str.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    const currentNorm = normalize(currentObservation);
    const prevNorm = normalize(previousObservation);

    // If observations are identical, return shortened version
    if (currentNorm === prevNorm) {
      return 'Same as previous';
    }

    // Calculate similarity using simple character overlap
    const minLength = Math.min(currentNorm.length, prevNorm.length);
    const maxLength = Math.max(currentNorm.length, prevNorm.length);

    if (minLength === 0) return currentObservation;

    // Count matching characters at the start
    let matchingChars = 0;
    for (let i = 0; i < minLength; i++) {
      if (currentNorm[i] === prevNorm[i]) {
        matchingChars++;
      } else {
        break;
      }
    }

    const similarity = matchingChars / maxLength;

    // If >80% similar, return shortened version highlighting the difference
    if (similarity > 0.8) {
      const diffStart = matchingChars;
      const uniquePart = currentObservation.substring(diffStart).trim();
      if (uniquePart.length > 0 && uniquePart.length < currentObservation.length * 0.3) {
        return `Similar to previous, new: ${uniquePart}`;
      }
    }

    return currentObservation;
  }

  requestFocusedSnapshot(region = 'full-page') {
    // Validate region parameter
    const validRegions = ['main-content', 'search-results', 'navigation', 'full-page'];
    if (!validRegions.includes(region)) {
      console.warn(`[Agent] Invalid region '${region}', defaulting to 'full-page'`);
      region = 'full-page';
    }

    // Set flag for next snapshot action
    this.focusedSnapshotRegion = region;

    console.log(`[Agent] Focused snapshot requested for region: ${region}`);

    // Return the region for confirmation
    return { region, status: 'pending' };
  }

  filterSnapshotByRegion(snapshotTree, region) {
    if (!snapshotTree || region === 'full-page') {
      return snapshotTree;
    }
    
    // Define region selectors
    const regionSelectors = {
      'main-content': ['main', 'article', '[role="main"]', '.content', '#content', '.main-content'],
      'search-results': ['.search-result', '.result', '[role="listitem"]', '.search-item', '.result-item'],
      'navigation': ['nav', '[role="navigation"]', '.nav', '.menu', 'header']
    };
    
    const selectors = regionSelectors[region] || [];
    
    // Filter snapshot tree to only include lines matching region selectors
    const lines = snapshotTree.split('\n');
    const filteredLines = lines.filter(line => {
      // Keep lines that contain region-specific keywords
      const lineLower = line.toLowerCase();
      return selectors.some(selector => {
        const selectorLower = selector.toLowerCase().replace(/[[\]"']/g, '');
        return lineLower.includes(selectorLower);
      });
    });
    
    // If filtering resulted in too few lines, return original
    if (filteredLines.length < 5) {
      console.warn(`[Agent] Region filtering for '${region}' resulted in too few lines, returning full snapshot`);
      return snapshotTree;
    }
    
    return filteredLines.join('\n');
  }


  buildMessages(userTask, observation, snapshot, currentSubGoal = null) {
      // Build dynamic context for system prompt injection
      let dynamicContext = '';
      let stepBudgetWarning = '';

      const context = this.getTaskContext();
      const stepsRemaining = context.maxSteps - context.step;
      const budgetPercentage = Math.round((stepsRemaining / context.maxSteps) * 100);

      // Build sub-goal context if available
      if (currentSubGoal && this.progressTracker) {
        const subGoalContext = this.progressTracker.getContext();
        dynamicContext = `**Current Sub-Goal Status:**
  ${subGoalContext}`;

        // Add stuck warning if detected
        if (this.progressTracker.isStuck()) {
          dynamicContext += `

  ⚠️ **STUCK WARNING**: You have taken more than ${this.progressTracker.stuckThreshold} steps on this sub-goal without completing it.
  **Action Required**: 1) Try a completely different approach, 2) Skip to next sub-goal, 3) Call askUser() for help`;
        }
      } else {
        dynamicContext = `**Task Progress:**
  - Current Step: ${context.step}/${context.maxSteps}
  - Remaining Steps: ${stepsRemaining} (${budgetPercentage}% of budget)`;
      }

      // Build step budget warning based on remaining percentage
      if (budgetPercentage < 20) {
        stepBudgetWarning = `⚠️ **CRITICAL**: Only ${stepsRemaining} steps remaining (${budgetPercentage}%)! Prioritize completion NOW.`;
      } else if (budgetPercentage < 50) {
        stepBudgetWarning = `⚠️ **WARNING**: ${stepsRemaining} steps remaining (${budgetPercentage}%). Focus on completing current sub-goal.`;
      } else {
        stepBudgetWarning = `Remaining steps: ${stepsRemaining} (${budgetPercentage}% of budget)`;
      }

      // Inject dynamic context into system prompt
      const enhancedSystemPrompt = SYSTEM_PROMPT
        .replace('{DYNAMIC_CONTEXT}', dynamicContext)
        .replace('{STEP_BUDGET_WARNING}', stepBudgetWarning);

      const messages = [
        { role: 'system', content: enhancedSystemPrompt },
      ];

      // Build progress message with step budget and sub-goal info
      let progressContent = `Task: ${userTask}

  Progress: Step ${context.step}/${context.maxSteps}
  Completed: ${context.completedActions} | Failed: ${context.failedActions}`;

      // Add remaining step budget information
      progressContent += `\nRemaining steps: ${stepsRemaining} (${budgetPercentage}% of budget)`;

      // Add sub-goal context if available (for user message context)
      if (currentSubGoal && this.progressTracker) {
        const subGoalContext = this.progressTracker.getContext();
        progressContent += `\n\n📋 Current Sub-Goal:\n${subGoalContext}`;

        // Add stuck warning if detected
        if (this.progressTracker.isStuck()) {
          progressContent += `\n\n⚠️ STUCK WARNING: You have taken more than ${this.progressTracker.stuckThreshold} steps on this sub-goal without completing it.`;
          progressContent += `\nConsider: 1) Try a completely different approach, 2) Skip to next sub-goal, 3) Call askUser() for help`;
        }
      }

      messages.push({
        role: 'user',
        content: progressContent
      });

      const historySummary = this.summarizeHistory();
      if (historySummary) {
        messages.push({
          role: 'user',
          content: historySummary
        });
      }

      if (snapshot) {
        let snapshotContent = this.truncateContent(snapshot, 2000);
        messages.push({
          role: 'user',
          content: `Page snapshot:\n${snapshotContent}`
        });

        if (snapshot.includes('[FOLLOW]')) {
          messages.push({
            role: 'user',
            content: '🎯 [FOLLOW] found! Click it then call finished().'
          });
        } else if (snapshot.includes('[USER]')) {
          messages.push({
            role: 'user',
            content: '👤 [USER] found! Click to visit profile.'
          });
        } else if (snapshot.includes('[VIDEO]')) {
          messages.push({
            role: 'user',
            content: '🎬 [VIDEO] found! Click to open video.'
          });
        }
      }

      if (observation) {
        // Remove redundant information from consecutive observations
        const processedObservation = this.removeRedundantInfo(observation, this.lastObservation);
        
        // Store current observation for next comparison
        this.lastObservation = observation;
        
        messages.push({
          role: 'user',
          content: `Result: ${this.truncateContent(processedObservation, 800)}`
        });

        if (observation.includes('No search input found')) {
          messages.push({
            role: 'user',
            content: '⚠️ search() failed. Use snapshot() to find textbox, then fill(ref, text) and click submit button.'
          });
        }

        if (observation.includes('followClicked')) {
          messages.push({
            role: 'user',
            content: '✅ Follow button clicked successfully! Call finished() now.'
          });
        }
        if (observation.includes('userPageOpened')) {
          messages.push({
            role: 'user',
            content: '📍 Now on user profile page. Look for [FOLLOW] button in next snapshot.'
          });
        }
        if (observation.includes('videoOpened')) {
          messages.push({
            role: 'user',
            content: '✅ Video opened! Call finished() if this completes your task.'
          });
        }
        if (observation.includes('LOOP DETECTED')) {
          messages.push({
            role: 'user',
            content: '⚠️ LOOP WARNING! You are repeating actions. Either call finished() or try a completely different approach NOW.'
          });
        }
        if (observation.includes('Error:') || observation.includes('failed')) {
          messages.push({
            role: 'user',
            content: '❌ Last action failed. Try: 1) Different element, 2) Scroll to find more, 3) Wait longer, 4) askUser() for help'
          });
        }
      }

      messages.push({
        role: 'user',
        content: 'What is your next action? Return JSON only.'
      });

      return messages;
    }

  async sendTaskStatus(task, action, status) {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0]) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          action: 'updateTaskStatus',
          task: task || this.currentTask,
          actionName: action,
          status: status
        });
      }
    } catch (error) {
      console.log('[Agent] Failed to send task status:', error.message);
    }
  }

  async executeAction(action, args) {
    if (this.stopped) {
      return { done: true, result: 'Stopped by user' };
    }

    // Validate action with ExecutionOptimizer before execution
    if (this.executionOptimizer) {
      try {
        const currentSubGoal = this.progressTracker ? this.progressTracker.getCurrentSubGoal() : null;
        const validation = this.executionOptimizer.validateAction(action, args, currentSubGoal);
        
        if (!validation.valid) {
          // Action is invalid, return validation failure with alternative
          console.warn('[Agent] Action validation failed:', validation.reason);
          
          // Log optimization trace
          this.logTrace('optimization', {
            action: action,
            args: args,
            blocked: true,
            reason: validation.reason,
            alternative: validation.alternative
          });
          
          this.onProgress({ 
            type: 'warning', 
            message: `Action blocked: ${validation.reason}`,
            alternative: validation.alternative
          });
          
          return {
            done: false,
            result: {
              success: false,
              error: validation.reason,
              alternative: validation.alternative,
              validationFailed: true
            }
          };
        }
      } catch (error) {
        console.error('[Agent] ExecutionOptimizer validation failed:', error);
        this.logTrace('error', {
          component: 'ExecutionOptimizer',
          action: 'validateAction',
          error: error.message,
          fallback: 'proceed without validation'
        });
        // Proceed without validation - graceful degradation
      }
    }

    // Action display names for status updates
    const actionDisplayNames = {
      'snapshot': 'Taking snapshot',
      'click': 'Clicking element',
      'fill': 'Filling input',
      'search': 'Searching',
      'navigate': 'Navigating',
      'scroll': 'Scrolling',
      'wait': 'Waiting',
      'getText': 'Getting text',
      'getMarkdown': 'Getting markdown',
      'getUrl': 'Getting URL',
      'getTitle': 'Getting title',
      'extractMultipleItems': 'Extracting multiple items',
      'askUser': 'Asking user',
      'generateDocument': 'Generating document',
      'finished': 'Finishing task'
    };

    const actionDisplay = actionDisplayNames[action] || action;
    
    // Send status update before action
    await this.sendTaskStatus(null, actionDisplay, 'In progress');

    this.onProgress({ type: 'action', action, args });
    console.log('[Agent] Executing action:', action, args);

    // Log action start trace
    const actionStartTime = Date.now();
    const currentSubGoal = this.progressTracker ? this.progressTracker.getCurrentSubGoal() : null;
    this.logTrace('actionStart', {
      action: action,
      args: args,
      subGoal: currentSubGoal ? currentSubGoal.description : null
    });

    let result;

    switch (action) {
      case 'snapshot':
        // Check if focused snapshot is requested
        const snapshotOptions = { interactiveOnly: true };
        
        if (this.focusedSnapshotRegion && this.focusedSnapshotRegion !== 'full-page') {
          snapshotOptions.focusRegion = this.focusedSnapshotRegion;
          console.log(`[Agent] Requesting focused snapshot for region: ${this.focusedSnapshotRegion}`);
        }
        
        result = await this.sendMessageToContent('snapshot', { options: snapshotOptions });
        
        if (result && result.tree) {
          // Apply region filtering if focused snapshot was used
          if (snapshotOptions.focusRegion) {
            result.tree = this.filterSnapshotByRegion(result.tree, snapshotOptions.focusRegion);
            console.log(`[Agent] Filtered snapshot to ${snapshotOptions.focusRegion} region`);
          }
          
          // Clear focused snapshot flag after use
          if (this.focusedSnapshotRegion) {
            console.log(`[Agent] Focused snapshot completed for region: ${this.focusedSnapshotRegion}`);
            this.focusedSnapshotRegion = null;
          }
          
          this.currentRefs = result.refs || {};
          
          // Apply ContentExtractor pattern detection and recommendations
          if (typeof ContentExtractor !== 'undefined') {
            try {
              const currentUrl = await this.sendMessageToContent('getUrl');
              const pattern = ContentExtractor.identifyPattern(result.tree, currentUrl);
              const currentSubGoal = this.progressTracker ? this.progressTracker.getCurrentSubGoal() : null;
              const recommendation = ContentExtractor.recommendAction(pattern, currentSubGoal);
              
              // Add pattern and recommendation to result for LLM context
              result.contentPattern = pattern;
              result.extractionRecommendation = recommendation;
              
              // For search results, automatically extract structured data
              if (pattern === 'search_results') {
                const searchResults = ContentExtractor.extractSearchResults(result.tree, 5);
                if (searchResults && searchResults.length > 0) {
                  result.extractedSearchResults = searchResults;
                  console.log(`[Agent] Auto-extracted ${searchResults.length} search results`);
                  
                  // Report search results incrementally
                  this.onProgress({
                    type: 'contentExtracted',
                    contentType: 'searchResults',
                    source: 'page',
                    resultCount: searchResults.length,
                    results: searchResults.map(r => ({
                      title: r.title,
                      snippet: r.snippet ? r.snippet.substring(0, 100) : '',
                      url: r.url
                    })),
                    timestamp: Date.now()
                  });
                }
              }
              
              console.log('[Agent] Content pattern detected:', pattern);
              console.log('[Agent] Extraction recommendation:', recommendation.action, '-', recommendation.reasoning);
            } catch (error) {
              console.error('[Agent] ContentExtractor pattern detection failed:', error);
              this.logTrace('error', {
                component: 'ContentExtractor',
                action: 'identifyPattern',
                error: error.message,
                fallback: 'continue without pattern detection'
              });
              // Continue without pattern detection - graceful degradation
            }
          }
        }
        break;
        
      case 'click':
        result = await this.sendMessageToContent('click', { ref: args.ref });
        console.log('[Agent] Click result:', JSON.stringify(result));
        
        const refData = this.getRefData(args.ref);
        if (refData && refData.role === 'follow-button') {
          result = { 
            ...result,
            followClicked: true,
            message: 'Follow button clicked!'
          };
        }
        
        if (result && result.navigate) {
          const navResult = await this.handleNavigate(result.navigate);
          const url = result.navigate;
          console.log('[Agent] Click navigated to:', url);
          if (url.includes('video/BV') || url.includes('video/av') || url.includes('/BV') || url.includes('/av')) {
            result = { ...navResult, videoOpened: true };
            console.log('[Agent] Video opened detected!');
          } else if (url.includes('space.bilibili.com')) {
            result = { ...navResult, userPageOpened: true };
          } else {
            result = navResult;
          }
        } else {
          const currentUrlResult = await this.sendMessageToContent('getUrl');
          const currentUrl = typeof currentUrlResult === 'string' ? currentUrlResult : (currentUrlResult?.url || '');
          console.log('[Agent] Current URL after click:', currentUrl);
          if (currentUrl && (currentUrl.includes('video/BV') || currentUrl.includes('video/av') || currentUrl.includes('/BV') || currentUrl.includes('/av'))) {
            result = { ...result, videoOpened: true };
            console.log('[Agent] Video opened detected from current URL!');
          }
        }
        break;
        
      case 'fill':
        result = await this.sendMessageToContent('fill', { ref: args.ref, text: args.text });
        break;
        
      case 'search':
        result = await this.sendMessageToContent('search', { text: args.text || args.query, submit: true });
        if (result && result.success) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
        if (result && result.navigate) {
          result = await this.handleNavigate(result.navigate);
        }
        break;
        
      case 'navigate':
        result = await this.handleNavigate(args.url);
        break;
        
      case 'scroll':
        result = await this.sendMessageToContent('scroll', { direction: args.direction || 'down' });
        break;
        
      case 'wait':
        const waitMs = args.ms || 1000;
        for (let i = 0; i < waitMs; i += 100) {
          if (this.stopped) {
            return { done: true, result: 'Stopped by user' };
          }
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        result = { success: true, message: `Waited ${waitMs}ms` };
        break;
        
      case 'getText':
        result = await this.sendMessageToContent('getText', { ref: args.ref });
        
        // Report extracted text incrementally
        if (result && result.text) {
          this.onProgress({
            type: 'contentExtracted',
            contentType: 'text',
            source: `element ${args.ref}`,
            content: result.text.substring(0, 500), // Preview
            fullLength: result.text.length,
            timestamp: Date.now()
          });
        }
        
        // Apply summarization if content is too long
        if (result && result.text && typeof ContentExtractor !== 'undefined') {
          try {
            const originalLength = result.text.length;
            if (originalLength > 1000) {
              result.originalText = result.text;
              result.text = ContentExtractor.summarize(result.text, 1000);
              result.summarized = true;
              result.originalLength = originalLength;
              console.log(`[Agent] Content summarized: ${originalLength} -> ${result.text.length} chars`);
            }
          } catch (error) {
            console.error('[Agent] ContentExtractor summarization failed:', error);
            this.logTrace('error', {
              component: 'ContentExtractor',
              action: 'summarize',
              error: error.message,
              fallback: 'use original text'
            });
            // Use original text - graceful degradation
          }
        }
        break;
        
      case 'getMarkdown':
        result = await this.sendMessageToContent('getMarkdown');
        
        // Report extracted markdown incrementally
        if (result && result.markdown) {
          this.onProgress({
            type: 'contentExtracted',
            contentType: 'markdown',
            source: 'page',
            content: result.markdown.substring(0, 500), // Preview
            fullLength: result.markdown.length,
            timestamp: Date.now()
          });
        }
        
        // Apply content extraction and summarization
        if (result && result.markdown && typeof ContentExtractor !== 'undefined') {
          try {
            const currentUrl = await this.sendMessageToContent('getUrl');
            const pattern = ContentExtractor.identifyPattern(result.markdown, currentUrl);
            
            // Extract structured content based on pattern
            let extractedContent = null;
            if (pattern === 'article_content') {
              extractedContent = ContentExtractor.extractArticle(result.markdown);
              result.extractedArticle = extractedContent;
              console.log('[Agent] Extracted article content');
            } else if (pattern === 'post_content') {
              extractedContent = ContentExtractor.extractPost(result.markdown);
              result.extractedPost = extractedContent;
              console.log('[Agent] Extracted post content');
            }
            
            // Apply summarization if content is too long
            const originalLength = result.markdown.length;
            if (originalLength > 1000) {
              result.originalMarkdown = result.markdown;
              result.markdown = ContentExtractor.summarize(result.markdown, 1000);
              result.summarized = true;
              result.originalLength = originalLength;
              console.log(`[Agent] Markdown summarized: ${originalLength} -> ${result.markdown.length} chars`);
            }
            
            result.contentPattern = pattern;
          } catch (error) {
            console.error('[Agent] ContentExtractor processing failed:', error);
            this.logTrace('error', {
              component: 'ContentExtractor',
              action: 'extractAndSummarize',
              error: error.message,
              fallback: 'use original markdown'
            });
            // Use original markdown - graceful degradation
          }
        }
        break;
        
      case 'getUrl':
        result = await this.sendMessageToContent('getUrl');
        break;
        
      case 'getTitle':
        result = await this.sendMessageToContent('getTitle');
        break;
        
      case 'askUser':
        this.onProgress({ type: 'askUser', question: args.question });
        this.waitingForUser = true;
        const answer = await this.onAskUser(args.question);
        result = { 
          success: true, 
          userAnswer: answer,
          message: `User answered: ${answer}`
        };
        break;
        
      case 'extractMultipleItems':
        // Batch extraction of multiple items from current page
        if (typeof ContentExtractor !== 'undefined') {
          try {
            const snapshot = await this.sendMessageToContent('snapshot', { options: { interactiveOnly: true } });
            if (snapshot && snapshot.tree) {
              const itemType = args.itemType || args.type || 'results';
              const count = args.count || args.number || 5;
              
              const items = ContentExtractor.extractMultipleItems(snapshot.tree, itemType, count);
              
              result = {
                success: true,
                items: items,
                count: items.length,
                itemType: itemType,
                message: `Extracted ${items.length} ${itemType}`
              };
              
              // Report extracted items incrementally
              if (items && items.length > 0) {
                this.onProgress({
                  type: 'contentExtracted',
                  contentType: 'multipleItems',
                  source: 'page',
                  itemCount: items.length,
                  itemType: itemType,
                  items: items.map(item => ({
                    ref: item.ref,
                    preview: item.text ? item.text.substring(0, 100) : ''
                  })),
                  timestamp: Date.now()
                });
              }
              
              console.log(`[Agent] Batch extracted ${items.length} ${itemType}`);
            } else {
              result = { success: false, error: 'Failed to get page snapshot' };
            }
          } catch (error) {
            console.error('[Agent] Batch extraction failed:', error);
            result = { success: false, error: error.message };
          }
        } else {
          result = { success: false, error: 'ContentExtractor not available' };
        }
        break;
        
      case 'finished':
        const finishedResult = args.result || args.content || args;
        console.log('[Agent] Task finished with result:', finishedResult);
        return { done: true, result: typeof finishedResult === 'object' ? JSON.stringify(finishedResult, null, 2) : finishedResult };
      
      case 'generateDocument':
        // Generate Excel or Word document from extracted data
        if (typeof DocumentGenerator !== 'undefined') {
          try {
            const generator = new DocumentGenerator();
            const data = args.data || args.content || [];
            const type = args.type || 'excel'; // 'excel' or 'word'
            const filename = args.filename || (type === 'excel' ? 'export.csv' : 'document.html');
            
            // Set page data and instructions
            generator.setPageData({ items: data });
            generator.setUserInstructions(args.instructions || '生成文档');
            
            // Generate document
            await generator.generateFromPageData(type, filename);
            
            result = {
              success: true,
              type: type,
              filename: filename,
              itemCount: Array.isArray(data) ? data.length : 0,
              message: `${type === 'excel' ? 'CSV' : 'HTML'} 文件已生成并下载: ${filename}`
            };
            
            console.log(`[Agent] Document generated: ${filename}`);
          } catch (error) {
            console.error('[Agent] Document generation failed:', error);
            result = { success: false, error: error.message };
          }
        } else {
          result = { success: false, error: 'DocumentGenerator not available' };
        }
        break;
        
      default:
        result = { success: false, error: `Unknown action: ${action}` };
    }

    // Record action in ExecutionOptimizer after execution
    if (this.executionOptimizer) {
      this.executionOptimizer.recordAction(action, args, result);
    }

    // Log action complete trace
    const actionEndTime = Date.now();
    this.logTrace('actionComplete', {
      action: action,
      args: args,
      success: result?.success !== false,
      duration: actionEndTime - actionStartTime,
      result: result
    });

    this.updateTaskState(action, args, result);
    
    // Send status update after action
    if (result && result.success !== false) {
      await this.sendTaskStatus(null, actionDisplay, 'Complete');
    } else {
      await this.sendTaskStatus(null, actionDisplay, 'Failed');
    }
    
    return { done: false, result: result || { success: false, error: 'No result' } };
  }

  async handleNavigate(url) {
    if (!url) return { success: false, error: 'No URL provided' };
    
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http')) {
      finalUrl = 'https://' + finalUrl;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      await chrome.tabs.update(tab.id, { url: finalUrl });
      
      for (let i = 0; i < 50; i++) {
        if (this.stopped) {
          return { success: false, error: 'Stopped by user' };
        }
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      return { success: true, message: `Navigated to ${finalUrl}`, navigate: finalUrl };
    }
    return { success: false, error: 'No active tab' };
  }

  async ensureContentScriptReady(tabId) {
    for (let i = 0; i < 5; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
        if (response && response.success) {
          return true;
        }
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    return false;
  }

  async sendMessageToContent(action, data = {}, retries = 3) {
    if (this.stopped) {
      return { success: false, error: 'Stopped by user' };
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      return { success: false, error: 'No active tab' };
    }

    const isReady = await this.ensureContentScriptReady(tab.id);
    if (!isReady) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        return { success: false, error: 'Failed to inject content script' };
      }
    }

    for (let i = 0; i < retries; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { action, ...data });
        if (response !== undefined) {
          return response;
        }
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        if (i < retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          return { success: false, error: error.message };
        }
      }
    }
    
    return { success: false, error: 'Failed to get response' };
  }

  /**
   * Validates task state and recovers from corruption
   * @returns {boolean} True if state is valid or was recovered
   */
  validateTaskState() {
    let corrupted = false;
    
    try {
      // Validate stepCount
      if (typeof this.stepCount !== 'number' || this.stepCount < 0) {
        console.warn('[Agent] Invalid stepCount, resetting to 0');
        this.stepCount = 0;
        corrupted = true;
      }
      
      // Validate history
      if (!Array.isArray(this.history)) {
        console.warn('[Agent] Invalid history, resetting to empty array');
        this.history = [];
        corrupted = true;
      }
      
      // Validate lastActions
      if (!Array.isArray(this.lastActions)) {
        console.warn('[Agent] Invalid lastActions, resetting to empty array');
        this.lastActions = [];
        corrupted = true;
      }
      
      // Validate taskState
      if (!this.taskState || typeof this.taskState !== 'object') {
        console.warn('[Agent] Invalid taskState, resetting to default');
        this.taskState = {
          subGoals: [],
          currentSubGoal: 0,
          completedActions: [],
          failedActions: [],
          pageHistory: []
        };
        corrupted = true;
      }
      
      // Validate ProgressTracker state
      if (this.progressTracker) {
        if (!Array.isArray(this.progressTracker.subGoals)) {
          console.warn('[Agent] Invalid ProgressTracker subGoals, resetting');
          this.progressTracker.subGoals = [];
          corrupted = true;
        }
        
        if (typeof this.progressTracker.currentSubGoalIndex !== 'number' || 
            this.progressTracker.currentSubGoalIndex < 0) {
          console.warn('[Agent] Invalid ProgressTracker currentSubGoalIndex, resetting to 0');
          this.progressTracker.currentSubGoalIndex = 0;
          corrupted = true;
        }
        
        if (!Array.isArray(this.progressTracker.subGoalStepCounts)) {
          console.warn('[Agent] Invalid ProgressTracker subGoalStepCounts, resetting');
          this.progressTracker.subGoalStepCounts = new Array(this.progressTracker.subGoals.length).fill(0);
          corrupted = true;
        }
      }
      
      // Validate currentRefs
      if (!this.currentRefs || typeof this.currentRefs !== 'object') {
        console.warn('[Agent] Invalid currentRefs, resetting to empty object');
        this.currentRefs = {};
        corrupted = true;
      }
      
      // Log state corruption event
      if (corrupted) {
        this.logTrace('stateCorruption', {
          recovered: true,
          timestamp: Date.now()
        });
      }
      
      return true;
    } catch (error) {
      console.error('[Agent] State validation failed:', error);
      this.logTrace('error', {
        component: 'StateValidator',
        error: error.message,
        critical: true
      });
      return false;
    }
  }

  async run(userTask) {
    this.stopped = false;
    this.stepCount = 0;
    this.history = [];
    this.lastActions = [];
    this.lastUrls = [];
    this.currentRefs = {};
    this.currentTask = userTask;
    this.taskState = {
      subGoals: [],
      currentSubGoal: 0,
      completedActions: [],
      failedActions: [],
      pageHistory: [],
    };

    // Enhanced start event with sub-goal overview
    const startData = {
      type: 'start',
      task: userTask,
      maxSteps: this.maxSteps
    };
    
    this.onProgress(startData);
    
    // Send initial task status
    await this.sendTaskStatus(userTask, 'Starting', 'Ready');

    // Task Planning: Analyze task and create execution plan
    let plan = null;
    try {
      // Import TaskPlanner if available
      if (typeof TaskPlanner !== 'undefined') {
        plan = TaskPlanner.analyzeTask(userTask);
        
        // Validate plan
        if (plan && plan.subGoals && Array.isArray(plan.subGoals)) {
          // Store plan in taskState
          this.taskState.subGoals = plan.subGoals;
          this.taskState.stepBudget = plan.stepBudget;
          this.taskState.heuristic = plan.heuristic;
          
          // Update maxSteps to use calculated stepBudget
          if (plan.stepBudget && plan.stepBudget > 0) {
            this.maxSteps = plan.stepBudget;
          }
          
          // Initialize ProgressTracker for multi-step tasks
          if (plan.subGoals.length > 0 && typeof ProgressTracker !== 'undefined') {
            this.progressTracker = new ProgressTracker(plan.subGoals);
            
            // Report sub-goal overview to UI
            this.onProgress({
              type: 'planCreated',
              totalSubGoals: plan.subGoals.length,
              stepBudget: plan.stepBudget,
              subGoals: plan.subGoals.map(sg => ({
                description: sg.description,
                completionCriteria: sg.completionCriteria
              }))
            });
          }
        } else {
          throw new Error('Invalid plan structure');
        }
      }
    } catch (error) {
      // Fallback: treat as simple task with no sub-goals
      console.warn('[Agent] Task planning failed, using fallback:', error);
      this.logTrace('error', {
        component: 'TaskPlanner',
        error: error.message,
        fallback: 'simple task with 30 steps'
      });
      plan = {
        category: 'composite',
        subGoals: [],
        stepBudget: 30,
        heuristic: null
      };
      this.taskState.subGoals = [];
      this.taskState.stepBudget = 30;
      this.taskState.heuristic = null;
      this.progressTracker = null;
    }

    let lastSnapshot = null;
    let lastObservation = null;

    while (this.stepCount < this.maxSteps && !this.stopped) {
      // Validate state at start of each step
      const stateValid = this.validateTaskState();
      if (!stateValid) {
        console.error('[Agent] Critical state validation failure, stopping execution');
        this.onProgress({ type: 'error', message: 'State validation failed' });
        return { 
          success: false, 
          error: 'State validation failed', 
          history: this.history 
        };
      }
      
      this.stepCount++;
      
      // Enhanced step progress with sub-goal context and estimates
      const progressData = {
        type: 'step',
        step: this.stepCount,
        maxSteps: this.maxSteps,
        progressPercentage: Math.round((this.stepCount / this.maxSteps) * 100)
      };
      
      // Add sub-goal information if ProgressTracker is active
      if (this.progressTracker) {
        const currentSubGoal = this.progressTracker.getCurrentSubGoal();
        if (currentSubGoal) {
          progressData.currentSubGoal = {
            index: this.progressTracker.currentSubGoalIndex + 1,
            total: this.progressTracker.subGoals.length,
            description: currentSubGoal.description,
            stepsOnSubGoal: this.progressTracker.subGoalStepCounts[this.progressTracker.currentSubGoalIndex]
          };
          progressData.subGoalProgressPercentage = Math.round(
            ((this.progressTracker.currentSubGoalIndex + 1) / this.progressTracker.subGoals.length) * 100
          );
        }
        
        // Calculate estimated remaining steps
        const completedSubGoals = this.progressTracker.currentSubGoalIndex;
        if (completedSubGoals > 0) {
          const avgStepsPerSubGoal = this.stepCount / completedSubGoals;
          const remainingSubGoals = this.progressTracker.subGoals.length - completedSubGoals;
          progressData.estimatedRemainingSteps = Math.ceil(avgStepsPerSubGoal * remainingSubGoals);
        } else {
          // No sub-goals completed yet, estimate based on total
          const avgStepsPerSubGoal = this.maxSteps / this.progressTracker.subGoals.length;
          progressData.estimatedRemainingSteps = Math.ceil(avgStepsPerSubGoal * (this.progressTracker.subGoals.length - 1));
        }
      }
      
      this.onProgress(progressData);

      if (this.stopped) break;

      // Get current sub-goal if ProgressTracker is active
      let currentSubGoal = null;
      if (this.progressTracker) {
        currentSubGoal = this.progressTracker.getCurrentSubGoal();
        
        // Log sub-goal start trace (only on first step of sub-goal)
        if (currentSubGoal && this.progressTracker.subGoalStepCounts[this.progressTracker.currentSubGoalIndex] === 0) {
          this.logTrace('subGoalStart', {
            subGoalIndex: this.progressTracker.currentSubGoalIndex,
            description: currentSubGoal.description,
            completionCriteria: currentSubGoal.completionCriteria,
            estimatedSteps: currentSubGoal.estimatedSteps
          });
        }
        
        // If all sub-goals are complete, call finished() automatically
        if (this.progressTracker.isComplete()) {
          const summary = this.progressTracker.getSummary();
          
          // Log task complete trace
          this.logTrace('taskComplete', {
            success: true,
            totalSteps: this.stepCount,
            totalSubGoals: this.progressTracker.subGoals.length,
            completedSubGoals: this.progressTracker.subGoals.filter(sg => sg.completed).length,
            skippedSubGoals: this.progressTracker.subGoals.filter(sg => sg.skipped).length,
            traceEventCount: this.traceHistory.length,
            result: 'All sub-goals completed'
          });
          
          this.onProgress({
            type: 'complete',
            result: 'All sub-goals completed',
            summary: summary,
            history: this.history,
          });
          return { 
            success: true, 
            result: 'All sub-goals completed', 
            summary: summary,
            history: this.history 
          };
        }
      }

      const messages = this.buildMessages(userTask, lastObservation, lastSnapshot, currentSubGoal);

      // Log LLM call start trace
      const llmStartTime = Date.now();
      this.logTrace('llmCallStart', {
        messageCount: messages.length,
        model: this.model
      });

      let llmResponse;
      try {
        llmResponse = await this.callLLM(messages);
      } catch (error) {
        if (this.stopped) {
          this.onProgress({ type: 'stopped' });
          return { success: false, error: 'Stopped by user', stopped: true, history: this.history };
        }
        this.onError(error);
        return { success: false, error: error.message, history: this.history };
      }

      if (this.stopped) break;

      // Log LLM call complete trace
      const llmEndTime = Date.now();
      this.logTrace('llmCallComplete', {
        duration: llmEndTime - llmStartTime,
        responseLength: llmResponse ? llmResponse.length : 0,
        thought: null // Will be set after parsing
      });

      this.onProgress({ type: 'thought', content: llmResponse });

      const parsed = this.parseResponse(llmResponse);
      
      // Update trace with parsed thought
      if (this.traceHistory && this.traceHistory.length > 0) {
        const lastTrace = this.traceHistory[this.traceHistory.length - 1];
        if (lastTrace.eventType === 'llmCallComplete') {
          lastTrace.thought = parsed.thought;
        }
      }

      this.history.push({
        step: this.stepCount,
        thought: parsed.thought,
        action: parsed.action,
        args: parsed.args,
      });

      const executionResult = await this.executeAction(parsed.action, parsed.args);

      if (this.stopped) {
        this.onProgress({ type: 'stopped' });
        return { success: false, error: 'Stopped by user', stopped: true, history: this.history };
      }

      if (executionResult.done) {
        // Log task complete trace
        this.logTrace('taskComplete', {
          success: true,
          totalSteps: this.stepCount,
          totalSubGoals: this.progressTracker ? this.progressTracker.subGoals.length : 0,
          completedSubGoals: this.progressTracker ? this.progressTracker.subGoals.filter(sg => sg.completed).length : 0,
          skippedSubGoals: this.progressTracker ? this.progressTracker.subGoals.filter(sg => sg.skipped).length : 0,
          traceEventCount: this.traceHistory.length,
          result: executionResult.result
        });
        
        // Optionally export trace to file or send to logging service
        if (this.onTrace) {
          this.onTrace({
            type: 'traceSummary',
            history: this.traceHistory,
            summary: {
              totalEvents: this.traceHistory.length,
              eventTypes: this.traceHistory.reduce((acc, e) => {
                acc[e.eventType] = (acc[e.eventType] || 0) + 1;
                return acc;
              }, {})
            }
          });
        }
        
        this.onProgress({
          type: 'complete',
          result: executionResult.result,
          history: this.history,
        });
        return { success: true, result: executionResult.result, history: this.history };
      }

      // Build observation from execution result
      if (parsed.action === 'snapshot') {
        if (executionResult.result?.tree) {
          lastSnapshot = executionResult.result.tree;
          lastObservation = `Snapshot: ${executionResult.result.elementCount || 0} elements found`;
        } else {
          lastSnapshot = null;
          lastObservation = `Snapshot failed: ${executionResult.result?.error || 'unknown error'}`;
        }
      } else {
        lastSnapshot = null;
        if (executionResult.result?.validationFailed) {
          // Action was blocked by ExecutionOptimizer
          lastObservation = `Action blocked: ${executionResult.result.error}\nSuggestion: ${executionResult.result.alternative}`;
        } else if (executionResult.result?.success === false) {
          lastObservation = `Error: ${executionResult.result?.error || 'Unknown error'}`;
        } else if (executionResult.result?.videoOpened) {
          lastObservation = 'videoOpened: Video is playing!';
        } else if (executionResult.result?.followClicked) {
          lastObservation = 'followClicked: Followed successfully!';
        } else {
          lastObservation = JSON.stringify(executionResult.result || {});
        }
      }
      
      // Track observations for productivity detection
      if (!this.lastObservations) {
        this.lastObservations = [];
      }
      this.lastObservations.push(lastObservation);
      if (this.lastObservations.length > 5) {
        this.lastObservations.shift();
      }

      // Record step in ProgressTracker if active
      if (this.progressTracker && currentSubGoal) {
        this.progressTracker.recordStep();
        
        // Check if current sub-goal is complete
        if (this.isSubGoalComplete(currentSubGoal, parsed.action, executionResult.result, lastObservation)) {
          console.log('[Agent] Sub-goal completed:', currentSubGoal.description);
          
          // Mark sub-goal as complete
          this.progressTracker.completeCurrentSubGoal({
            action: parsed.action,
            result: executionResult.result,
            observation: lastObservation
          });
          
          // Reset ExecutionOptimizer for new sub-goal
          if (this.executionOptimizer) {
            const newSubGoal = this.progressTracker.getCurrentSubGoal();
            if (newSubGoal) {
              this.executionOptimizer.resetForSubGoal(newSubGoal.id);
              console.log('[Agent] ExecutionOptimizer reset for sub-goal:', newSubGoal.id);
            }
          }
          
          // Get completion data for the completed sub-goal
          const completionData = this.progressTracker.getCompletionData(currentSubGoal);
          
          // Log sub-goal complete trace
          this.logTrace('subGoalComplete', {
            subGoalIndex: this.progressTracker.currentSubGoalIndex - 1,
            description: currentSubGoal.description,
            stepsTaken: completionData ? completionData.stepsTaken : 0,
            completionTime: completionData ? completionData.completionTime : Date.now(),
            result: completionData ? completionData.result : executionResult.result
          });
          
          // Report completion to UI with enhanced data
          this.onProgress({
            type: 'subGoalComplete',
            subGoal: currentSubGoal,
            subGoalIndex: this.progressTracker.currentSubGoalIndex,
            totalSubGoals: this.progressTracker.subGoals.length,
            stepsTaken: completionData ? completionData.stepsTaken : 0,
            completionTime: completionData ? completionData.completionTime : Date.now(),
            summary: completionData ? completionData.summary : `Completed: ${currentSubGoal.description}`,
            progress: this.progressTracker.getProgress(),
            progressPercentage: Math.round(
              (this.progressTracker.currentSubGoalIndex / this.progressTracker.subGoals.length) * 100
            )
          });
          
          // Check if all sub-goals are now complete
          if (this.progressTracker.isComplete()) {
            const summary = this.progressTracker.getSummary();
            
            // Build detailed summary with outcomes for each sub-goal
            const detailedSummary = {
              total: summary.total,
              completed: summary.completed,
              skipped: summary.skipped,
              totalSteps: this.stepCount,
              subGoals: summary.subGoals.map((sg, index) => ({
                description: sg.description,
                status: sg.completed ? 'completed' : (sg.skipped ? 'skipped' : 'incomplete'),
                stepsTaken: this.progressTracker.subGoalStepCounts[index] || 0,
                result: sg.result || {},
                skipReason: sg.skipReason || null,
                completionCriteria: sg.completionCriteria
              }))
            };
            
            this.onProgress({
              type: 'complete',
              result: 'All sub-goals completed',
              summary: detailedSummary,
              history: this.history,
            });
            return { 
              success: true, 
              result: 'All sub-goals completed', 
              summary: summary,
              history: this.history 
            };
          }
        }
        
        // Check if stuck on current sub-goal
        if (this.progressTracker.isStuck()) {
          const stuckReason = `Stuck on sub-goal "${currentSubGoal.description}" after ${this.progressTracker.subGoalStepCounts[this.progressTracker.currentSubGoalIndex]} steps`;
          console.warn('[Agent]', stuckReason);
          
          // Log stuck trace
          this.logTrace('stuck', {
            subGoalIndex: this.progressTracker.currentSubGoalIndex,
            description: currentSubGoal.description,
            stepsTaken: this.progressTracker.subGoalStepCounts[this.progressTracker.currentSubGoalIndex],
            recentActions: this.history.slice(-5).map(h => h.action),
            reason: stuckReason
          });
          
          // Skip current sub-goal and move to next
          this.progressTracker.skipCurrentSubGoal(stuckReason);
          
          // Reset ExecutionOptimizer for new sub-goal
          if (this.executionOptimizer) {
            const newSubGoal = this.progressTracker.getCurrentSubGoal();
            if (newSubGoal) {
              this.executionOptimizer.resetForSubGoal(newSubGoal.id);
              console.log('[Agent] ExecutionOptimizer reset for sub-goal after skip:', newSubGoal.id);
            }
          }
          
          // Add warning to observation
          lastObservation = (lastObservation || '') + `\n⚠️ ${stuckReason}. Moving to next sub-goal.`;
          
          // Report stuck state to UI with enhanced details
          const recentActions = this.history.slice(-5).map(h => ({
            action: h.action,
            args: h.args,
            success: h.result?.success
          }));
          
          this.onProgress({ 
            type: 'warning',
            warningType: 'stuck',
            message: stuckReason,
            subGoal: {
              description: currentSubGoal.description,
              completionCriteria: currentSubGoal.completionCriteria,
              stepsTaken: this.progressTracker.subGoalStepCounts[this.progressTracker.currentSubGoalIndex]
            },
            recentActions: recentActions,
            suggestions: [
              'Try a completely different approach',
              'Skip to next sub-goal',
              'Call askUser() for help'
            ]
          });
          
          // Continue to next iteration with new sub-goal
          continue;
        }
      }

      const afterActionLoop = this.detectLoop(parsed.action, parsed.args, lastObservation);
      if (afterActionLoop.canFinish && (parsed.action === 'click' || parsed.action === 'snapshot' || parsed.action === 'getMarkdown')) {
        lastObservation += '\n✅ Task likely complete! Call finished() now if this meets the goal.';
      }
      
      // Add alternative suggestions when loop is detected
      if (afterActionLoop.detected) {
        // Don't trigger on productive iterations with low confidence
        if (afterActionLoop.productive && afterActionLoop.confidence < 0.7) {
          // This seems like productive iteration, don't warn yet
          console.log('[Agent] Loop pattern detected but appears productive, continuing...');
        } else {
          const alternatives = this.getAlternatives(afterActionLoop, currentSubGoal);
          
          // Track how many times this loop has been detected
          if (!this.loopDetectionCount) {
            this.loopDetectionCount = {};
          }
          const loopKey = afterActionLoop.pattern || afterActionLoop.reason;
          this.loopDetectionCount[loopKey] = (this.loopDetectionCount[loopKey] || 0) + 1;
          
          // On second detection, force action
          if (this.loopDetectionCount[loopKey] >= 2) {
            lastObservation += `\n\n🛑 LOOP DETECTED (${loopKey}) - SECOND TIME! You MUST take one of these actions NOW:\n`;
            
            if (currentSubGoal && this.progressTracker && !this.progressTracker.isComplete()) {
              lastObservation += `1. Skip to next sub-goal by acknowledging this is not achievable\n`;
              lastObservation += `2. Call finished() if you have enough information to complete the task\n`;
              
              // Auto-skip if we're really stuck
              if (this.loopDetectionCount[loopKey] >= 3) {
                console.log('[Agent] Force skipping sub-goal due to repeated loop detection');
                this.progressTracker.skipCurrentSubGoal(`Loop detected 3 times: ${loopKey}`);
                lastObservation += `\n⚠️ AUTO-SKIPPED to next sub-goal due to repeated loop.\n`;
                
                // Get next sub-goal
                if (!this.progressTracker.isComplete()) {
                  currentSubGoal = this.progressTracker.getCurrentSubGoal();
                  lastObservation += `\nNow working on: ${currentSubGoal.description}\n`;
                } else {
                  lastObservation += `\nAll sub-goals processed. Call finished() with your results.\n`;
                }
              }
            } else {
              lastObservation += `1. Call finished() with whatever results you have gathered\n`;
              lastObservation += `2. Try ONE completely different approach\n`;
            }
          } else {
            // First detection - provide alternatives
            const productiveNote = afterActionLoop.productive ? ' (possibly productive)' : '';
            lastObservation += `\n\n⚠️ LOOP DETECTED (${loopKey}${productiveNote}, confidence: ${(afterActionLoop.confidence * 100).toFixed(0)}%)\n`;
            lastObservation += `You are stuck in a repetitive pattern. Try one of these alternatives:\n\n`;
            
            alternatives.forEach((alt, idx) => {
              lastObservation += `${idx + 1}. ${alt.action}: ${alt.suggestion}\n`;
            });
          }
        }
      }
      
      const recentActions = this.lastActions.slice(-10);
      const sameActions = recentActions.filter(a => a.startsWith(parsed.action + ':'));
      if (sameActions.length >= 4 && parsed.action !== 'finished' && !lastObservation.includes('Task likely complete') && !afterActionLoop.detected) {
        lastObservation += '\n⚠️ You are repeating the same action! Try a different approach or call finished() if done.';
      }
    }

    // Generate content extraction summary before ending
    const extractedContent = this.history
      .filter(h => ['getText', 'getMarkdown', 'extractMultipleItems'].includes(h.action))
      .map(h => ({
        action: h.action,
        step: h.step,
        success: h.result?.success,
        contentLength: h.result?.text?.length || h.result?.markdown?.length || 0,
        itemCount: h.result?.items?.length || 0
      }));

    if (extractedContent.length > 0) {
      this.onProgress({
        type: 'contentSummary',
        totalExtractions: extractedContent.length,
        extractions: extractedContent,
        timestamp: Date.now()
      });
    }

    if (this.stopped) {
      this.onProgress({ type: 'stopped' });
      
      // Log task incomplete trace
      this.logTrace('taskIncomplete', {
        reason: 'Stopped by user',
        totalSteps: this.stepCount,
        totalSubGoals: this.progressTracker ? this.progressTracker.subGoals.length : 0,
        completedSubGoals: this.progressTracker ? this.progressTracker.subGoals.filter(sg => sg.completed).length : 0,
        traceEventCount: this.traceHistory.length
      });
      
      return { success: false, error: 'Stopped by user', stopped: true, history: this.history };
    }

    this.onProgress({ type: 'incomplete', reason: 'Max steps reached' });
    
    // Log task incomplete trace
    this.logTrace('taskIncomplete', {
      reason: 'Max steps reached',
      totalSteps: this.stepCount,
      totalSubGoals: this.progressTracker ? this.progressTracker.subGoals.length : 0,
      completedSubGoals: this.progressTracker ? this.progressTracker.subGoals.filter(sg => sg.completed).length : 0,
      traceEventCount: this.traceHistory.length
    });
    
    return { 
      success: false, 
      error: 'Max steps reached without completion', 
      history: this.history 
    };
  }
}
