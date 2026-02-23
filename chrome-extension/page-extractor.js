/**
 * Page Context Extractor
 * 
 * This module provides functionality to extract page content for the Chat Mode.
 * It extracts the page title, URL, and main text content while filtering out
 * scripts, styles, and hidden elements.
 */

/**
 * PageContext data structure
 * @typedef {Object} PageContext
 * @property {string} title - Page title
 * @property {string} url - Page URL
 * @property {string} content - Extracted text content (≤10000 characters)
 * @property {number} timestamp - Extraction timestamp
 * @property {boolean} cached - Whether the content is from cache
 */

/**
 * Check if an element is hidden
 * @param {Element} element - The element to check
 * @returns {boolean} True if the element is hidden
 */
function isElementHidden(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const style = window.getComputedStyle(element);
  return style.display === 'none' || style.visibility === 'hidden';
}

/**
 * Check if an element should be skipped during traversal
 * @param {Element} element - The element to check
 * @returns {boolean} True if the element should be skipped
 */
function shouldSkipElement(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) {
    return false;
  }

  const tagName = element.tagName.toLowerCase();
  const skipTags = ['script', 'style', 'noscript', 'iframe'];
  
  return skipTags.includes(tagName) || isElementHidden(element);
}

/**
 * Recursively traverse DOM and extract text content
 * @param {Node} node - The node to traverse
 * @param {Array<string>} textParts - Array to collect text parts
 * @param {number} depth - Current traversal depth
 * @param {number} maxDepth - Maximum traversal depth
 */
function traverseDOM(node, textParts, depth = 0, maxDepth = 10) {
  // Limit traversal depth to prevent performance issues
  if (depth > maxDepth) {
    return;
  }

  // Skip if node should be filtered
  if (node.nodeType === Node.ELEMENT_NODE && shouldSkipElement(node)) {
    return;
  }

  // Extract text from text nodes
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent.trim();
    if (text) {
      textParts.push(text);
    }
    return;
  }

  // Recursively traverse child nodes
  if (node.childNodes && node.childNodes.length > 0) {
    for (let i = 0; i < node.childNodes.length; i++) {
      traverseDOM(node.childNodes[i], textParts, depth + 1, maxDepth);
    }
  }
}

/**
 * Extract text content from a specific element
 * @param {Element} element - The element to extract from
 * @returns {string} Extracted text content
 */
function extractFromElement(element) {
  if (!element) {
    return '';
  }

  const textParts = [];
  traverseDOM(element, textParts);
  return textParts.join(' ');
}

/**
 * Find and prioritize main content areas
 * @returns {Array<Element>} Array of content elements in priority order
 */
function findMainContentAreas() {
  const prioritySelectors = [
    'main',
    'article',
    '[role="main"]',
    '.content',
    '.main-content',
    '#content',
    '#main-content'
  ];

  const contentAreas = [];

  // Try to find priority content areas
  for (const selector of prioritySelectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      if (!shouldSkipElement(el)) {
        contentAreas.push(el);
      }
    });
  }

  // If no priority areas found, use body
  if (contentAreas.length === 0 && document.body) {
    contentAreas.push(document.body);
  }

  return contentAreas;
}

/**
 * Remove excessive whitespace from text
 * Collapses multiple spaces into one and multiple newlines into double newlines
 * @param {string} text - The text to clean
 * @returns {string} Cleaned text
 */
function removeExcessiveWhitespace(text) {
  if (!text) {
    return '';
  }

  // Replace multiple spaces with single space
  let cleaned = text.replace(/[ \t]+/g, ' ');
  
  // Replace multiple newlines with double newlines (preserve paragraph structure)
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  
  // Trim leading/trailing whitespace
  cleaned = cleaned.trim();
  
  return cleaned;
}

/**
 * Smart truncate text to keep sentences intact
 * Truncates at the last complete sentence before the limit
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length (default 10000)
 * @returns {string} Truncated text with marker if truncated
 */
function smartTruncate(text, maxLength = 10000) {
  if (!text || text.length <= maxLength) {
    return text;
  }

  // Find the last sentence boundary before maxLength
  const truncatePoint = maxLength - 20; // Leave room for truncation marker
  let lastSentenceEnd = -1;
  
  // Look for sentence endings: . ! ? followed by space or newline
  const sentenceEndings = /[.!?][\s\n]/g;
  let match;
  
  while ((match = sentenceEndings.exec(text)) !== null) {
    if (match.index < truncatePoint) {
      lastSentenceEnd = match.index + 1; // Include the punctuation
    } else {
      break;
    }
  }

  // If we found a sentence boundary, truncate there
  if (lastSentenceEnd > 0) {
    return text.substring(0, lastSentenceEnd).trim() + '...[内容已截断]';
  }

  // Otherwise, truncate at word boundary
  const lastSpace = text.lastIndexOf(' ', truncatePoint);
  if (lastSpace > 0) {
    return text.substring(0, lastSpace).trim() + '...[内容已截断]';
  }

  // Fallback: hard truncate
  return text.substring(0, truncatePoint).trim() + '...[内容已截断]';
}

/**
 * Filter and clean extracted content
 * Removes excessive whitespace, preserves paragraph structure,
 * and applies length limit with smart truncation
 * @param {string} content - The raw extracted content
 * @returns {string} Filtered and cleaned content
 */
function filterAndCleanContent(content) {
  if (!content) {
    return '';
  }

  // Step 1: Remove excessive whitespace while preserving paragraph structure
  let cleaned = removeExcessiveWhitespace(content);
  
  // Step 2: Apply length limit with smart truncation
  cleaned = smartTruncate(cleaned, 10000);
  
  return cleaned;
}

/**
 * Extract page context from the current page
 * 
 * This function extracts the page title, URL, and main text content.
 * It filters out scripts, styles, and hidden elements, and limits
 * the content to 10000 characters.
 * 
 * @returns {PageContext} The extracted page context
 */
function extractPageContext() {
  const context = {
    title: document.title || '',
    url: window.location.href || '',
    content: '',
    timestamp: Date.now(),
    cached: false
  };

  try {
    // Find main content areas
    const contentAreas = findMainContentAreas();

    // Extract text from each content area
    const textParts = [];
    for (const area of contentAreas) {
      const text = extractFromElement(area);
      if (text) {
        textParts.push(text);
      }
    }

    // Join all text parts
    const rawContent = textParts.join('\n\n');

    // Apply content filtering and cleaning (Task 3.3)
    context.content = filterAndCleanContent(rawContent);
  } catch (error) {
    console.error('Error extracting page context:', error);
    context.content = '';
  }

  return context;
}

// Export for use in content.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { 
    extractPageContext,
    filterAndCleanContent,
    removeExcessiveWhitespace,
    smartTruncate
  };
}
