// Import page extractor functions for Chat Mode
// Since we're in a browser extension content script, we need to load the script
// The page-extractor.js will be loaded via manifest.json

let refCounter = 0;
const refMap = new Map();

const interactiveRoles = [
  'button',
  'link',
  'textbox',
  'checkbox',
  'radio',
  'combobox',
  'searchbox',
  'slider',
  'spinbutton',
  'switch',
  'tab',
  'menuitem',
  'menuitemcheckbox',
  'menuitemradio',
  'option',
  'follow-button',
  'user-link',
  'user-card',
  'video-link',
];

// Known search engines with their URL constructors
const KNOWN_SEARCH_ENGINES = {
  'baidu.com': (query) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
  'bilibili.com': (query) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
  'google.com': (query) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  'bing.com': (query) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  'duckduckgo.com': (query) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  'yahoo.com': (query) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
};

/**
 * Detects if the current page is a known search engine and returns its URL constructor
 * @param {string} url - The current page URL
 * @returns {Function|null} URL constructor function if known search engine, null otherwise
 */
function getSearchEngineUrlConstructor(url) {
  for (const [domain, constructor] of Object.entries(KNOWN_SEARCH_ENGINES)) {
    if (url.includes(domain)) {
      return constructor;
    }
  }
  return null;
}

// Task Status Display Window
let taskStatusWindow = null;

function createTaskStatusWindow() {
  if (taskStatusWindow) {
    return taskStatusWindow;
  }

  const container = document.createElement('div');
  container.id = 'browser-agent-task-status';
  container.style.cssText = `
    position: fixed;
    top: 10px;
    left: 10px;
    width: 320px;
    max-height: 200px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    padding: 16px;
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: white;
    font-size: 13px;
    line-height: 1.5;
    backdrop-filter: blur(10px);
    border: 1px solid rgba(255, 255, 255, 0.2);
    transition: all 0.3s ease;
  `;

  const header = document.createElement('div');
  header.style.cssText = `
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.3);
  `;

  const title = document.createElement('div');
  title.textContent = '🤖 Browser Agent';
  title.style.cssText = `
    font-weight: 600;
    font-size: 14px;
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '×';
  closeBtn.style.cssText = `
    background: rgba(255, 255, 255, 0.2);
    border: none;
    color: white;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    line-height: 1;
    transition: background 0.2s;
  `;
  closeBtn.onmouseover = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.3)';
  closeBtn.onmouseout = () => closeBtn.style.background = 'rgba(255, 255, 255, 0.2)';
  closeBtn.onclick = () => {
    container.style.display = 'none';
  };

  header.appendChild(title);
  header.appendChild(closeBtn);

  const taskInfo = document.createElement('div');
  taskInfo.id = 'task-info';
  taskInfo.style.cssText = `
    margin-bottom: 8px;
  `;

  const taskName = document.createElement('div');
  taskName.id = 'task-name';
  taskName.textContent = 'Waiting for task...';
  taskName.style.cssText = `
    font-weight: 500;
    margin-bottom: 6px;
    font-size: 14px;
  `;

  const taskAction = document.createElement('div');
  taskAction.id = 'task-action';
  taskAction.textContent = '';
  taskAction.style.cssText = `
    font-size: 12px;
    opacity: 0.9;
    font-style: italic;
  `;

  const statusIndicator = document.createElement('div');
  statusIndicator.id = 'status-indicator';
  statusIndicator.style.cssText = `
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255, 255, 255, 0.2);
  `;

  const statusDot = document.createElement('div');
  statusDot.id = 'status-dot';
  statusDot.style.cssText = `
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #4ade80;
    animation: pulse 2s infinite;
  `;

  const statusText = document.createElement('div');
  statusText.id = 'status-text';
  statusText.textContent = 'Ready';
  statusText.style.cssText = `
    font-size: 11px;
    opacity: 0.8;
  `;

  statusIndicator.appendChild(statusDot);
  statusIndicator.appendChild(statusText);

  taskInfo.appendChild(taskName);
  taskInfo.appendChild(taskAction);

  container.appendChild(header);
  container.appendChild(taskInfo);
  container.appendChild(statusIndicator);

  // Add CSS animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(container);
  taskStatusWindow = container;

  console.log('[Browser Agent] Task status window created');
  return container;
}

function updateTaskStatus(task, action, status) {
  const window = createTaskStatusWindow();
  
  const taskName = window.querySelector('#task-name');
  const taskAction = window.querySelector('#task-action');
  const statusText = window.querySelector('#status-text');
  const statusDot = window.querySelector('#status-dot');

  if (task) {
    taskName.textContent = `📋 ${task}`;
  }

  if (action) {
    taskAction.textContent = `⚡ ${action}`;
  }

  if (status) {
    statusText.textContent = status;
    
    // Update status dot color based on status
    if (status.toLowerCase().includes('complete') || status.toLowerCase().includes('success')) {
      statusDot.style.background = '#4ade80'; // green
    } else if (status.toLowerCase().includes('running') || status.toLowerCase().includes('progress')) {
      statusDot.style.background = '#fbbf24'; // yellow
    } else if (status.toLowerCase().includes('error') || status.toLowerCase().includes('fail')) {
      statusDot.style.background = '#ef4444'; // red
    } else {
      statusDot.style.background = '#60a5fa'; // blue
    }
  }

  // Show the window if it was hidden
  window.style.display = 'block';
}

function hideTaskStatus() {
  if (taskStatusWindow) {
    taskStatusWindow.style.display = 'none';
  }
}

function generateRef() {
  refCounter++;
  return `e${refCounter}`;
}

function getAccessibleName(el) {
  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  const label = el.getAttribute('aria-labelledby');
  if (label) {
    const labelEl = document.getElementById(label);
    if (labelEl) return labelEl.textContent?.trim() || '';
  }

  const name = el.getAttribute('name');
  if (name) return name;

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return placeholder;

  const title = el.getAttribute('title');
  if (title) return title;

  const alt = el.getAttribute('alt');
  if (alt) return alt;

  if (el.tagName === 'A') {
    const img = el.querySelector('img[alt]');
    if (img) return img.getAttribute('alt');
  }

  const textContent = el.textContent?.trim();
  if (textContent && textContent.length < 80) return textContent;

  return '';
}

function getClassName(el) {
  if (!el) return '';
  if (typeof el.className === 'string') return el.className.toLowerCase();
  if (el.className && typeof el.className.baseVal === 'string') return el.className.baseVal.toLowerCase();
  return '';
}

function getRole(el) {
  const explicitRole = el.getAttribute('role');
  if (explicitRole) return explicitRole;

  const tagName = el.tagName?.toLowerCase() || '';
  const className = getClassName(el);
  const textContent = (el.textContent || '').trim().slice(0, 20);
  const href = el.getAttribute('href') || '';
  const dataAttrs = {
    mod: el.getAttribute('data-mod'),
    type: el.getAttribute('data-type'),
    report: el.getAttribute('data-report'),
    action: el.getAttribute('data-action'),
  };
  
  if (tagName === 'a') {
    if (href.includes('space.bilibili.com') || href.includes('/member/') || href.includes('/up/')) {
      return 'user-link';
    }
    if (href.includes('video/BV') || href.includes('video/av') || href.includes('bilibili.com/video')) {
      return 'video-link';
    }
    return 'link';
  }
  
  if (textContent === '关注' || textContent === '已关注' || textContent === '+ 关注' || textContent === '已关注') {
    return 'follow-button';
  }
  
  if (tagName === 'button') {
    if (textContent.includes('关注')) return 'follow-button';
    return 'button';
  }
  
  if (className.includes('follow-btn') || className.includes('subscribe-btn') ||
      className.includes('follow-button') || className.includes('btn-follow') ||
      className.includes('follow') && className.includes('btn')) {
    return 'follow-button';
  }
  
  if (dataAttrs.mod === 'follow' || dataAttrs.type === 'follow' || 
      dataAttrs.report?.includes('follow') || dataAttrs.action === 'follow') {
    return 'follow-button';
  }
  
  if (className.includes('video-card') || className.includes('bili-video') || 
      className.includes('video-item') || className.includes('video-list') ||
      className.includes('video-card')) {
    const link = el.querySelector('a[href*="video/BV"], a[href*="video/av"]');
    if (link) return 'video-link';
  }
  
  if (className.includes('user-card') || className.includes('bili-user') ||
      className.includes('up-card') || className.includes('author-card') ||
      className.includes('user-item')) {
    return 'user-card';
  }

  const roleMap = {
    button: 'button',
    input: 'textbox',
    textarea: 'textbox',
    select: 'combobox',
    img: 'img',
    h1: 'heading',
    h2: 'heading',
    h3: 'heading',
    h4: 'heading',
    h5: 'heading',
    h6: 'heading',
    nav: 'navigation',
    main: 'main',
    header: 'banner',
    footer: 'contentinfo',
    form: 'form',
    table: 'table',
    ul: 'list',
    ol: 'list',
    li: 'listitem',
    dialog: 'dialog',
    menu: 'menu',
  };

  if (roleMap[tagName]) {
    if (tagName === 'input') {
      const type = el.type;
      if (type === 'checkbox') return 'checkbox';
      if (type === 'radio') return 'radio';
      if (type === 'submit' || type === 'button') return 'button';
      if (type === 'search') return 'searchbox';
      if (type === 'range') return 'slider';
    }
    return roleMap[tagName];
  }

  return 'generic';
}

function isInteractive(role) {
  return interactiveRoles.includes(role);
}

function isHidden(el) {
  const style = window.getComputedStyle(el);
  return style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) < 0.1;
}

function isVisible(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden') {
    console.log('[Browser Agent] Element not visible: display=' + style.display + ', visibility=' + style.visibility);
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log('[Browser Agent] Element has zero size: width=' + rect.width + ', height=' + rect.height);
    return false;
  }
  return true;
}

function isInViewport(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return rect.top >= 0 && rect.left >= 0 && 
         rect.bottom <= window.innerHeight && 
         rect.right <= window.innerWidth;
}

function getSelector(el) {
  if (el.id) return `#${el.id}`;

  const testId = el.getAttribute('data-testid');
  if (testId) return `[data-testid="${testId}"]`;

  const ariaLabel = el.getAttribute('aria-label');
  if (ariaLabel) return `[aria-label="${ariaLabel}"]`;

  const name = el.getAttribute('name');
  if (name) return `[name="${name}"]`;

  const placeholder = el.getAttribute('placeholder');
  if (placeholder) return `[placeholder="${placeholder}"]`;

  return el.tagName.toLowerCase();
}

function buildAOMTree(el, options = {}, depth = 0) {
  try {
    const { interactiveOnly = true, maxDepth = 12 } = options;

    if (!el) return null;
    if (maxDepth && depth > maxDepth) return null;
    if (isHidden(el)) return null;

    const role = getRole(el);
    const name = getAccessibleName(el);
    
    if (interactiveOnly && !isInteractive(role)) {
      const children = [];
      for (const child of el.children || []) {
        const childNode = buildAOMTree(child, options, depth + 1);
        if (childNode) {
          if (Array.isArray(childNode)) {
            children.push(...childNode);
          } else {
            children.push(childNode);
          }
        }
      }
      return children.length > 0 ? children : null;
    }

    const ref = generateRef();
    const selector = getSelector(el);
    const tagName = el.tagName?.toLowerCase() || '';
    const href = el.getAttribute('href') || '';

    refMap.set(ref, {
      selector,
      role,
      name,
      element: el,
      href,
    });

    const node = {
      ref,
      role,
      name,
      tagName,
    };
    
    if (role === 'video-link' || (tagName === 'a' && (href.includes('video/BV') || href.includes('video/av')))) {
      node.href = href;
      node.isVideo = true;
      
      const parent = el.closest('.bili-video-card, .video-card, [class*="video-item"], [class*="VideoCard"]');
      if (parent) {
        const statsText = parent.textContent || '';
        const playMatch = statsText.match(/([\d.]+[万亿]?)\s*(播放|次|观看)/);
        const likeMatch = statsText.match(/([\d.]+[万亿]?)\s*点赞/);
        const danmuMatch = statsText.match(/([\d.]+[万亿]?)\s*弹幕/);
        
        if (playMatch) node.playCount = playMatch[1];
        if (likeMatch) node.likeCount = likeMatch[1];
        if (danmuMatch) node.danmuCount = danmuMatch[1];
      }
    }
    
    if (role === 'user-link') {
      node.href = href;
      node.isUser = true;
    }

    if (role === 'heading') {
      const match = el.tagName?.match(/H(\d)/i);
      if (match) node.level = parseInt(match[1]);
    }

    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
      node.value = el.value;
      node.type = el.type || 'text';
    }

    if (role === 'checkbox' || role === 'radio' || role === 'switch') {
      node.checked = el.checked;
    }

    if (el.disabled) {
      node.disabled = true;
    }

    const children = [];
    for (const child of el.children || []) {
      const childNode = buildAOMTree(child, options, depth + 1);
      if (childNode) {
        if (Array.isArray(childNode)) {
          children.push(...childNode);
        } else {
          children.push(childNode);
        }
      }
    }
    if (children.length > 0) node.children = children;

    return node;
  } catch (error) {
    console.error('[Browser Agent] buildAOMTree error:', error);
    return null;
  }
}

function formatTree(node, indent = '') {
  if (!node) return '';
  if (Array.isArray(node)) {
    return node.map(n => formatTree(n, indent)).filter(Boolean).join('\n');
  }

  const parts = [];
  
  if (node.role === 'follow-button') {
    parts.push(`- follow-button "${node.name || '关注'}" [ref=${node.ref}] [FOLLOW]`);
  } else if (node.role === 'user-link') {
    parts.push(`- user-link "${node.name || '用户'}" [ref=${node.ref}] [USER]`);
  } else if (node.role === 'video-link') {
    parts.push(`- video-link "${node.name || '视频'}" [ref=${node.ref}] [VIDEO]`);
    if (node.playCount) parts.push(`[播放=${node.playCount}]`);
    if (node.likeCount) parts.push(`[点赞=${node.likeCount}]`);
    if (node.danmuCount) parts.push(`[弹幕=${node.danmuCount}]`);
  } else if (node.role === 'user-card') {
    parts.push(`- user-card "${node.name || '用户卡片'}" [ref=${node.ref}] [USER-CARD]`);
  } else {
    parts.push(`- ${node.role || 'unknown'}`);
    if (node.name) parts.push(`"${node.name}"`);
    parts.push(`[ref=${node.ref}]`);
    if (node.level) parts.push(`[level=${node.level}]`);
    if (node.value !== undefined && node.value !== '') parts.push(`[value="${node.value}"]`);
    if (node.type && node.role === 'textbox') parts.push(`[type=${node.type}]`);
    if (node.checked !== undefined) parts.push(`[checked=${node.checked}]`);
    if (node.disabled) parts.push(`[disabled]`);
    if (node.isVideo) parts.push(`[VIDEO]`);
    if (node.isUser) parts.push(`[USER]`);
  }

  const lines = [indent + parts.join(' ')];

  if (node.children && node.children.length > 0) {
    for (const child of node.children) {
      const childLine = formatTree(child, indent + '  ');
      if (childLine) lines.push(childLine);
    }
  }

  return lines.filter(Boolean).join('\n');
}

function getSnapshot(options = {}) {
  console.log('[Browser Agent] getSnapshot');
  
  refCounter = 0;
  refMap.clear();

  try {
    const tree = buildAOMTree(document.body, options);
    
    const treeString = formatTree(tree);

    const refs = {};
    refMap.forEach((value, key) => {
      refs[key] = {
        selector: value.selector,
        role: value.role,
        name: value.name,
        href: value.href,
      };
    });

    return {
      tree: treeString || '(empty page)',
      refs,
      elementCount: refCounter,
      success: true,
    };
  } catch (error) {
    console.error('[Browser Agent] getSnapshot error:', error);
    return {
      tree: '',
      refs: {},
      elementCount: 0,
      success: false,
      error: error.message,
    };
  }
}

function clickByRef(ref) {
  const info = refMap.get(ref);
  if (!info) {
    return { success: false, error: `Ref "${ref}" not found. Run snapshot first.` };
  }

  try {
    const el = info.element;
    console.log('[Browser Agent] Clicking:', el.tagName, info.role, info.name);
    
    el.focus();
    
    if (el.tagName === 'A' && el.href) {
      return { success: true, message: `Clicked link @${ref}`, navigate: el.href };
    }
    
    const innerLink = el.querySelector('a[href]');
    if (innerLink && innerLink.href) {
      return { success: true, message: `Clicked @${ref}`, navigate: innerLink.href };
    }
    
    const rect = el.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const events = [
      new PointerEvent('pointerover', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, pointerType: 'mouse' }),
      new PointerEvent('pointerenter', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, pointerType: 'mouse' }),
      new PointerEvent('pointerdown', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, pointerType: 'mouse', button: 0 }),
      new MouseEvent('mouseover', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY }),
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, button: 0 }),
      new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, button: 0 }),
      new PointerEvent('pointerup', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, pointerType: 'mouse', button: 0 }),
      new MouseEvent('click', { bubbles: true, cancelable: true, view: window, clientX: centerX, clientY: centerY, button: 0 }),
    ];

    events.forEach(event => el.dispatchEvent(event));
    
    el.click();
    
    return { success: true, message: `Clicked @${ref}` };
  } catch (error) {
    console.error('[Browser Agent] Click error:', error);
    return { success: false, error: error.message };
  }
}

function findSearchInput() {
  console.log('[Browser Agent] findSearchInput called');
  
  const searchSelectors = [
    '#kw',
    '#search-input',
    '.nav-search-input',
    'input[type="search"]',
    'input[role="searchbox"]',
    '.search-input',
    'input[class*="nav-search"]',
    'input[class*="search-input"]',
    'input[aria-label*="搜索"]',
    'input[aria-label*="search"]',
    'input[placeholder*="搜索"]',
    'input[placeholder*="Search"]',
    'input[name="search"]',
    'input[name="keyword"]',
    'input[name="wd"]',
    'input[name="q"]',
    'input[name="query"]',
    'input[name="word"]',
  ];

  let firstFoundInput = null;

  for (const selector of searchSelectors) {
    try {
      const input = document.querySelector(selector);
      if (input) {
        const visible = isVisible(input);
        console.log('[Browser Agent] Checking selector:', selector, 'found:', !!input, 'visible:', visible);
        if (visible) {
          console.log('[Browser Agent] Found search input by selector:', selector);
          return input;
        } else {
          console.log('[Browser Agent] Input found but not visible:', selector);
          if (!firstFoundInput) {
            firstFoundInput = input;
          }
        }
      }
    } catch (e) {
      console.log('[Browser Agent] Error checking selector:', selector, e);
    }
  }

  console.log('[Browser Agent] No selector match, checking all inputs');
  const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]');
  console.log('[Browser Agent] Found', allInputs.length, 'input elements');
  
  for (const input of allInputs) {
    const rect = input.getBoundingClientRect();
    console.log('[Browser Agent] Input:', input.id, input.name, getClassName(input), 'size:', rect.width, 'x', rect.height);
    
    if (rect.width > 0 && rect.height > 0) {
      const classLower = getClassName(input);
      const placeholder = (input.getAttribute('placeholder') || '').toLowerCase();
      const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      
      if (classLower.includes('search') || placeholder.includes('搜索') || 
          placeholder.includes('search') || ariaLabel.includes('搜索') || 
          ariaLabel.includes('search') || id.includes('search') || id.includes('kw')) {
        console.log('[Browser Agent] Found search input by attributes:', input);
        return input;
      }
    }
  }

  const largestInput = findLargestVisibleInput();
  if (largestInput) {
    console.log('[Browser Agent] Using largest visible input as fallback');
    return largestInput;
  }

  // If all selectors found inputs but none were visible, return the first found one
  if (firstFoundInput) {
    console.log('[Browser Agent] Returning first found input (not visible) as last resort:', firstFoundInput);
    return firstFoundInput;
  }

  console.log('[Browser Agent] No search input found');
  return null;
}

function findLargestVisibleInput() {
  const inputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]');
  let largest = null;
  let maxArea = 0;
  
  for (const input of inputs) {
    if (isVisible(input)) {
      const rect = input.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > maxArea) {
        maxArea = area;
        largest = input;
      }
    }
  }
  
  return largest;
}

function findSubmitButton() {
  console.log('[Browser Agent] findSubmitButton called');
  
  const buttonSelectors = [
    '#su',
    '#search-btn',
    '.nav-search-btn',
    '.search-btn',
    'button[type="submit"]',
    'button[aria-label*="搜索"]',
    'button[aria-label*="search"]',
    '.search-button',
    'button[class*="search"]',
    '.bili-header .search-btn',
    '.nav-search-content .search-btn',
    'input[type="submit"]',
  ];

  for (const selector of buttonSelectors) {
    try {
      const btn = document.querySelector(selector);
      if (btn && isVisible(btn)) {
        console.log('[Browser Agent] Found submit button by selector:', selector);
        return btn;
      }
    } catch (e) {}
  }

  console.log('[Browser Agent] No selector match, checking all buttons');
  const buttons = document.querySelectorAll('button, [role="button"], .btn, [class*="btn"], div[class*="search"], input[type="submit"]');
  console.log('[Browser Agent] Found', buttons.length, 'button elements');
  
  for (const btn of buttons) {
    const rect = btn.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const text = (btn.textContent || btn.value || '').trim().toLowerCase();
      const classLower = getClassName(btn);
      const id = (btn.id || '').toLowerCase();
      
      if (text.includes('搜索') || text.includes('search') || text.includes('百度一下') ||
          classLower.includes('search-btn') || classLower.includes('nav-search-btn') ||
          id.includes('su') || id.includes('search')) {
        console.log('[Browser Agent] Found submit button by text/class/id:', btn);
        return btn;
      }
    }
  }

  const searchInput = findSearchInput();
  if (searchInput) {
    const parent = searchInput.closest('.nav-search, .search-box, .search-wrapper, form, #s_fm');
    if (parent) {
      const btn = parent.querySelector('button, [class*="btn"], [class*="search"], input[type="submit"]');
      if (btn && isVisible(btn)) {
        console.log('[Browser Agent] Found submit button in parent container');
        return btn;
      }
    }
    
    const form = searchInput.closest('form');
    if (form) {
      const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
      if (submitBtn && isVisible(submitBtn)) {
        console.log('[Browser Agent] Found submit button in form');
        return submitBtn;
      }
    }
  }

  console.log('[Browser Agent] No submit button found');
  return null;
}

async function fillAndSubmit(text) {
  console.log('[Browser Agent] fillAndSubmit called with text:', text);
  
  // Helper function to wait for element to become visible
  const waitForVisible = (element, maxWait = 3000) => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log('[Browser Agent] Element became visible:', rect.width, 'x', rect.height);
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > maxWait) {
          console.log('[Browser Agent] Timeout waiting for element to become visible');
          clearInterval(checkInterval);
          resolve(false);
        }
      }, 100);
    });
  };
  
  let searchInput = findSearchInput();
  
  if (!searchInput) {
    console.log('[Browser Agent] No search input found, trying to find any text input');
    const allInputs = document.querySelectorAll('input[type="text"], input:not([type]), input[type="search"]');
    for (const input of allInputs) {
      const rect = input.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        searchInput = input;
        console.log('[Browser Agent] Found fallback input:', input);
        break;
      }
    }
  }
  
  if (!searchInput) {
    console.error('[Browser Agent] No search input found on this page');
    return { success: false, error: 'No search input found on this page' };
  }
  
  // Check if this is a known search engine - if so, use direct navigation regardless of input visibility
  const currentUrl = window.location.href;
  const urlConstructor = getSearchEngineUrlConstructor(currentUrl);

  if (urlConstructor) {
    // Known search engine: construct URL and navigate directly without needing visible input
    const searchUrl = urlConstructor(text);
    console.log('[Browser Agent] Known search engine detected, navigating directly to:', searchUrl);
    
    window.location.href = searchUrl;
    return { success: true, message: `Searched for "${text}" via direct navigation` };
  }
  
  // Wait for the input to become visible if it's not already
  const rect = searchInput.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) {
    console.log('[Browser Agent] Search input has zero size, waiting for it to become visible...');
    const becameVisible = await waitForVisible(searchInput);
    if (!becameVisible) {
      console.error('[Browser Agent] Search input did not become visible within timeout');
      return { success: false, error: 'Search input found but remained invisible' };
    }
  }

  try {
    console.log('[Browser Agent] Found search input:', {
      id: searchInput.id,
      name: searchInput.name,
      type: searchInput.type,
      placeholder: searchInput.placeholder,
      className: searchInput.className
    });
    console.log('[Browser Agent] Focusing on search input');
    searchInput.focus();
    searchInput.click();
    
    if (searchInput.select) {
      searchInput.select();
    }
    
    searchInput.value = '';
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(searchInput, text);
    } else {
      searchInput.value = text;
    }
    
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    searchInput.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Verify text was actually filled
    const actualValue = searchInput.value;
    console.log('[Browser Agent] Text filled. Expected:', text, 'Actual:', actualValue);
    if (actualValue !== text) {
      console.error('[Browser Agent] Text fill verification failed');
      return { success: false, error: `Failed to fill text. Expected: "${text}", Got: "${actualValue}"` };
    }
    
    console.log('[Browser Agent] Text filled successfully, attempting submission');

    // Unknown site: use Enter key submission as fallback
    console.log('[Browser Agent] Unknown site, trying Enter key submission');
    
    const submitBtn = findSubmitButton();
    if (submitBtn) {
      console.log('[Browser Agent] Found submit button, clicking');
      setTimeout(() => {
        submitBtn.focus();
        submitBtn.click();
      }, 100);
      return { success: true, message: `Searched for "${text}"` };
    }

    console.log('[Browser Agent] No submit button, trying Enter key');
    setTimeout(() => {
      searchInput.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
      searchInput.dispatchEvent(new KeyboardEvent('keyup', {
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13,
        bubbles: true
      }));
    }, 100);

    return { success: true, message: `Searched for "${text}" with Enter key` };
  } catch (error) {
    console.error('[Browser Agent] fillAndSubmit error:', error);
    return { success: false, error: error.message };
  }
}

function fillInput(ref, text) {
  const info = refMap.get(ref);
  if (!info) {
    return { success: false, error: `Ref "${ref}" not found` };
  }

  try {
    const el = info.element;
    el.focus();
    el.click();
    
    if (el.select) {
      el.select();
    }
    
    el.value = '';
    
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 
      'value'
    ).set;
    if (nativeInputValueSetter) {
      nativeInputValueSetter.call(el, text);
    } else {
      el.value = text;
    }
    
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    
    return { success: true, message: `Filled "${text}" into @${ref}` };
  } catch (error) {
    console.error('[Browser Agent] fillInput error:', error);
    return { success: false, error: error.message };
  }
}

function scrollPage(direction) {
  const scrollAmount = window.innerHeight * 0.7;
  
  if (direction === 'up') {
    window.scrollBy(0, -scrollAmount);
  } else {
    window.scrollBy(0, scrollAmount);
  }
  
  return { success: true, message: `Scrolled ${direction}` };
}

function getTextByRef(ref) {
  const info = refMap.get(ref);
  if (!info) {
    return { success: false, error: `Ref "${ref}" not found` };
  }
  
  return { success: true, text: info.element.textContent || '' };
}

function getPageMarkdown() {
  const getMarkdown = (el, depth = 0) => {
    if (!el || depth > 10) return '';
    
    const tag = el.tagName?.toLowerCase();
    let result = '';
    
    if (tag === 'h1') result += '\n# ';
    else if (tag === 'h2') result += '\n## ';
    else if (tag === 'h3') result += '\n### ';
    else if (tag === 'h4') result += '\n#### ';
    else if (tag === 'p' || tag === 'div') result += '\n';
    else if (tag === 'br') result += '\n';
    else if (tag === 'a') result += '[';
    
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent.trim() + ' ';
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        result += getMarkdown(child, depth + 1);
      }
    }
    
    if (tag === 'a') {
      const href = el.getAttribute('href');
      result += `](${href || ''})`;
    }
    
    return result;
  };
  
  return { success: true, markdown: getMarkdown(document.body).replace(/\n{3,}/g, '\n\n').trim() };
}

function getCurrentUrl() {
  return { success: true, url: window.location.href };
}

function getPageTitle() {
  return { success: true, title: document.title };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('[Browser Agent] Received message:', request.action);
  
  const handleAsync = async () => {
    let result;
    
    switch (request.action) {
      case 'ping':
        result = { success: true, message: 'pong' };
        break;
      case 'snapshot':
        result = getSnapshot(request.options || {});
        break;
      case 'click':
        result = clickByRef(request.ref);
        break;
      case 'fill':
        result = fillInput(request.ref, request.text);
        break;
      case 'search':
        result = await fillAndSubmit(request.text);
        break;
      case 'scroll':
        result = scrollPage(request.direction);
        break;
      case 'getText':
        result = getTextByRef(request.ref);
        break;
      case 'getMarkdown':
        result = getPageMarkdown();
        break;
      case 'getUrl':
        result = getCurrentUrl();
        break;
      case 'getTitle':
        result = getPageTitle();
        break;
      case 'extractPageContext':
        // Extract page context for Chat Mode (Task 5.1)
        // This calls the extractPageContext function from page-extractor.js
        result = extractPageContext();
        break;
      case 'updateTaskStatus':
        updateTaskStatus(request.task, request.actionName, request.status);
        result = { success: true };
        break;
      default:
        result = { success: false, error: `Unknown action: ${request.action}` };
    }
    
    sendResponse(result);
  };
  
  handleAsync();
  return true;
});

// Initialize task status window on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createTaskStatusWindow);
} else {
  createTaskStatusWindow();
}

console.log('[Browser Agent] Content script loaded');
