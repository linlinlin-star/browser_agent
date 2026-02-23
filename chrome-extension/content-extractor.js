/**
 * ContentExtractor - Intelligently extracts and summarizes content from web pages
 * 
 * This component helps the Browser Agent efficiently extract content by:
 * - Detecting page patterns (search results, articles, posts, lists)
 * - Recommending appropriate extraction actions
 * - Extracting structured content from different page types
 * - Summarizing long content to stay within token limits
 */

class ContentExtractor {
  /**
   * Identifies content extraction pattern for current page
   * 
   * Analyzes the page snapshot and URL to determine what type of content
   * is present and how it should be extracted.
   * 
   * @param {string} snapshot - Page snapshot text
   * @param {string} url - Current page URL (optional)
   * @returns {string} Pattern type: 'search_results', 'article_content', 'post_content', 'list_items', or 'generic'
   * 
   * @example
   * const pattern = ContentExtractor.identifyPattern(snapshot, 'https://www.baidu.com/s?wd=test');
   * // Returns: 'search_results'
   */
  static identifyPattern(snapshot, url = '') {
    if (!snapshot || typeof snapshot !== 'string') {
      return 'generic';
    }

    const lowerSnapshot = snapshot.toLowerCase();
    const lowerUrl = url.toLowerCase();

    // Search results detection
    // Look for search engine URLs and repeated result structures
    const searchEnginePatterns = [
      'baidu.com/s',
      'google.com/search',
      'bing.com/search',
      'duckduckgo.com',
      'yahoo.com/search'
    ];
    
    const hasSearchUrl = searchEnginePatterns.some(pattern => lowerUrl.includes(pattern));
    const hasSearchMarkers = lowerSnapshot.includes('[search-result]') || 
                            lowerSnapshot.includes('search result');
    const hasMultipleLinks = (snapshot.match(/https?:\/\//g) || []).length > 5;
    
    if (hasSearchUrl || (hasSearchMarkers && hasMultipleLinks)) {
      return 'search_results';
    }

    // Article content detection
    // Look for article-like structures with headings, paragraphs, author info
    const articleKeywords = ['article', 'author:', 'published', 'posted on', 'by:', 'read more'];
    const hasArticleKeywords = articleKeywords.some(keyword => lowerSnapshot.includes(keyword));
    const hasParagraphs = (snapshot.match(/\n\n/g) || []).length > 3;
    const hasHeadings = /^#{1,3}\s/m.test(snapshot) || lowerSnapshot.includes('<h1') || lowerSnapshot.includes('<h2');
    
    if (hasArticleKeywords && (hasParagraphs || hasHeadings)) {
      return 'article_content';
    }

    // Post content detection (social media, forums, blogs)
    // Look for post-like structures with timestamps, usernames, comments
    const postKeywords = ['posted', 'comment', 'reply', 'share', 'like', 'timestamp', 'ago', 'username'];
    const hasPostKeywords = postKeywords.filter(keyword => lowerSnapshot.includes(keyword)).length >= 2;
    const hasTimestamp = /\d{1,2}:\d{2}/.test(snapshot) || 
                        /\d{4}-\d{2}-\d{2}/.test(snapshot) ||
                        /(minute|hour|day|week|month|year)s?\s+ago/i.test(snapshot);
    
    if (hasPostKeywords && hasTimestamp) {
      return 'post_content';
    }

    // List items detection
    // Look for repeated list structures (ul, ol, or repeated patterns)
    const hasListMarkers = lowerSnapshot.includes('<ul') || 
                          lowerSnapshot.includes('<ol') ||
                          lowerSnapshot.includes('<li');
    const hasBulletPoints = /^[\*\-\+]\s/m.test(snapshot);
    const hasNumberedList = /^\d+\.\s/m.test(snapshot);
    const hasRepeatedStructure = this._detectRepeatedStructure(snapshot);
    
    if (hasListMarkers || hasBulletPoints || hasNumberedList || hasRepeatedStructure) {
      return 'list_items';
    }

    // Default to generic if no specific pattern detected
    return 'generic';
  }

  /**
   * Determines best action for content extraction based on pattern
   * 
   * Recommends the most efficient extraction action (getMarkdown, getText, or snapshot)
   * based on the detected content pattern and current sub-goal.
   * 
   * @param {string} pattern - Content pattern from identifyPattern()
   * @param {Object} subGoal - Current sub-goal object (optional)
   * @returns {Object} Action recommendation with action name, reasoning, and suggested args
   * 
   * @example
   * const recommendation = ContentExtractor.recommendAction('search_results', subGoal);
   * // Returns: { action: 'snapshot', reasoning: '...', args: {} }
   */
  static recommendAction(pattern, subGoal = null) {
    const recommendations = {
      search_results: {
        action: 'snapshot',
        reasoning: 'Search results are best extracted from a snapshot to identify all result elements with their refs. Use getText() on specific refs afterward.',
        args: {}
      },
      
      article_content: {
        action: 'getMarkdown',
        reasoning: 'Articles typically contain rich formatted content (headings, paragraphs, lists) that is best preserved in markdown format.',
        args: {}
      },
      
      post_content: {
        action: 'getMarkdown',
        reasoning: 'Post content often includes formatting, links, and structure that markdown preserves well. Good for extracting complete post information.',
        args: {}
      },
      
      list_items: {
        action: 'snapshot',
        reasoning: 'List items are best identified from a snapshot to see the structure and refs. Extract specific items with getText() afterward.',
        args: {}
      },
      
      generic: {
        action: 'snapshot',
        reasoning: 'For unknown content patterns, start with a snapshot to understand the page structure before deciding on specific extraction.',
        args: {}
      }
    };

    // Get base recommendation for pattern
    const recommendation = recommendations[pattern] || recommendations.generic;

    // Adjust recommendation based on sub-goal if provided
    if (subGoal && subGoal.description) {
      const description = subGoal.description.toLowerCase();
      
      // If sub-goal mentions specific elements or short content, prefer getText
      if (description.includes('title') || 
          description.includes('heading') || 
          description.includes('link') ||
          description.includes('snippet')) {
        return {
          action: 'getText',
          reasoning: `Sub-goal requests specific elements. Use getText() with element refs for targeted extraction.`,
          args: {}
        };
      }
      
      // If sub-goal mentions full content or multiple paragraphs, prefer getMarkdown
      if (description.includes('full content') || 
          description.includes('entire') || 
          description.includes('complete') ||
          description.includes('all text')) {
        return {
          action: 'getMarkdown',
          reasoning: `Sub-goal requests complete content. Use getMarkdown() to get full formatted content.`,
          args: {}
        };
      }
    }

    return recommendation;
  }

  /**
   * Detects repeated structural patterns in snapshot
   * Helper method for identifying list-like content
   * 
   * @private
   * @param {string} snapshot - Page snapshot
   * @returns {boolean} True if repeated structure detected
   */
  static _detectRepeatedStructure(snapshot) {
    // Look for repeated patterns like multiple [ref=X] markers
    const refMatches = snapshot.match(/\[ref=\d+\]/g);
    if (refMatches && refMatches.length > 5) {
      return true;
    }

    // Look for repeated heading patterns
    const headingMatches = snapshot.match(/^#{2,4}\s.+$/gm);
    if (headingMatches && headingMatches.length > 3) {
      return true;
    }

    return false;
  }

  /**
   * Extracts search results from snapshot
   * 
   * Parses a search results page snapshot to extract structured information
   * about each result (title, snippet, link, ref).
   * 
   * @param {string} snapshot - Page snapshot containing search results
   * @param {number} count - Number of results to extract (default: 5)
   * @returns {Array<Object>} Array of result objects with title, snippet, link, ref
   * 
   * @example
   * const results = ContentExtractor.extractSearchResults(snapshot, 3);
   * // Returns: [{ title: '...', snippet: '...', link: '...', ref: 'e1' }, ...]
   */
  static extractSearchResults(snapshot, count = 5) {
    if (!snapshot || typeof snapshot !== 'string') {
      return [];
    }

    const results = [];
    const lines = snapshot.split('\n');
    
    // Track current result being built
    let currentResult = null;
    let hasMarkers = snapshot.toLowerCase().includes('[search-result]');
    
    for (let i = 0; i < lines.length && results.length < count; i++) {
      const line = lines[i].trim();
      
      // Look for [SEARCH-RESULT] or [search-result] markers
      if (line.toLowerCase().includes('[search-result]')) {
        // Save previous result if exists
        if (currentResult && currentResult.title) {
          results.push(currentResult);
        }
        // Start new result
        currentResult = { title: '', snippet: '', link: '', ref: '' };
        continue;
      }
      
      // If no markers, treat each ref as a new result
      if (!hasMarkers && line.match(/\[ref=([^\]]+)\]|\[([a-z]\d+)\]/i)) {
        if (currentResult && currentResult.title) {
          results.push(currentResult);
        }
        currentResult = { title: '', snippet: '', link: '', ref: '' };
      }
      
      // Look for ref markers like [ref=e1] or [e1]
      const refMatch = line.match(/\[ref=([^\]]+)\]|\[([a-z]\d+)\]/i);
      if (refMatch && currentResult) {
        currentResult.ref = refMatch[1] || refMatch[2];
      }
      
      // Look for URLs (links)
      const urlMatch = line.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch && currentResult && !currentResult.link) {
        currentResult.link = urlMatch[1];
      }
      
      // Extract title (usually first non-empty line after marker, or line with ref)
      if (currentResult && !currentResult.title && line.length > 0 && 
          !line.startsWith('[') && !line.startsWith('http')) {
        // Check if this looks like a title (not too long, not a snippet)
        if (line.length < 200 && !line.includes('...')) {
          currentResult.title = line;
        }
      }
      
      // Extract snippet (usually longer text, may contain ...)
      if (currentResult && currentResult.title && !currentResult.snippet && 
          line.length > 0 && line !== currentResult.title && 
          !line.startsWith('[') && !line.startsWith('http')) {
        currentResult.snippet = line;
      }
    }
    
    // Add last result if exists
    if (currentResult && currentResult.title) {
      results.push(currentResult);
    }
    
    // Handle missing fields gracefully - ensure all results have required fields
    return results.map(result => ({
      title: result.title || '',
      snippet: result.snippet || '',
      link: result.link || '',
      ref: result.ref || ''
    }));
  }

  /**
   * Extracts article content from page content
   * 
   * @param {string} content - Page content (markdown or text)
   * @returns {Object} Extracted article with title, author, date, body
   */
  static extractArticle(content) {
    if (!content || typeof content !== 'string') {
      return { title: '', author: '', date: '', body: '' };
    }

    const lines = content.split('\n');
    let title = '';
    let author = '';
    let date = '';
    let bodyLines = [];
    let titleLineIndex = -1;
    
    // Extract title - look for first heading or first non-empty line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for markdown heading
      if (line.match(/^#{1,3}\s+(.+)$/)) {
        title = line.replace(/^#{1,3}\s+/, '');
        titleLineIndex = i;
        break;
      }
      
      // Check for HTML heading
      if (line.match(/<h[1-3][^>]*>(.+?)<\/h[1-3]>/i)) {
        const match = line.match(/<h[1-3][^>]*>(.+?)<\/h[1-3]>/i);
        title = match[1].replace(/<[^>]+>/g, '');
        titleLineIndex = i;
        break;
      }
      
      // First substantial non-empty line
      if (!title && line.length > 10 && line.length < 200) {
        title = line;
        titleLineIndex = i;
        break;
      }
    }
    
    // Extract author - look for "by:", "author:", "written by", etc.
    const authorPatterns = [
      /(?:by|author|written by|posted by):\s*([^\n]+)/i,
      /(?:by|author)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/,
      /<author>([^<]+)<\/author>/i
    ];
    
    for (const pattern of authorPatterns) {
      const match = content.match(pattern);
      if (match) {
        author = match[1].trim();
        break;
      }
    }
    
    // Extract date - look for date patterns
    const datePatterns = [
      /(?:published|posted|date):\s*([^\n]+)/i,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{4})/,
      /(\w+\s+\d{1,2},\s+\d{4})/,
      /<time[^>]*>([^<]+)<\/time>/i
    ];
    
    for (const pattern of datePatterns) {
      const match = content.match(pattern);
      if (match) {
        date = match[1].trim();
        break;
      }
    }
    
    // Extract body - collect main content paragraphs
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip lines before title
      if (titleLineIndex >= 0 && i <= titleLineIndex) {
        continue;
      }
      
      // Skip author/date lines
      if ((author && line.includes(author)) || (date && line.includes(date))) {
        continue;
      }
      
      // Skip navigation, headers, footers
      if (line.toLowerCase().includes('navigation') ||
          line.toLowerCase().includes('menu') ||
          line.toLowerCase().includes('footer') ||
          line.toLowerCase().includes('sidebar')) {
        continue;
      }
      
      // Collect substantial content lines
      if (line.length > 0) {
        bodyLines.push(line);
      }
    }
    
    const body = bodyLines.join('\n').trim();
    
    return {
      title: title || '',
      author: author || '',
      date: date || '',
      body: body || ''
    };
  }

  /**
   * Extracts post content from page content
   * 
   * @param {string} content - Page content
   * @returns {Object} Extracted post with title, author, timestamp, body
   */
  static extractPost(content) {
    if (!content || typeof content !== 'string') {
      return { title: '', author: '', timestamp: '', body: '' };
    }

    const lines = content.split('\n');
    let title = '';
    let author = '';
    let timestamp = '';
    let bodyLines = [];
    let titleLineIndex = -1;
    
    // Extract title - first line or heading
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Check for markdown heading
      if (line.match(/^#{1,4}\s+(.+)$/)) {
        title = line.replace(/^#{1,4}\s+/, '');
        titleLineIndex = i;
        break;
      }
      
      // Check for HTML heading
      if (line.match(/<h[1-4][^>]*>(.+?)<\/h[1-4]>/i)) {
        const match = line.match(/<h[1-4][^>]*>(.+?)<\/h[1-4]>/i);
        title = match[1].replace(/<[^>]+>/g, '');
        titleLineIndex = i;
        break;
      }
      
      // First substantial line (not too long for a title)
      if (!title && line.length > 5 && line.length < 200) {
        title = line;
        titleLineIndex = i;
        break;
      }
    }
    
    // Extract author/username - look for common patterns
    const authorPatterns = [
      /(?:by|author|posted by|username|user):\s*([^\n]+)/i,
      /(?:@|u\/)([a-zA-Z0-9_-]+)/,
      /<(?:author|username)>([^<]+)<\/(?:author|username)>/i,
      /(?:by|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/
    ];
    
    for (const pattern of authorPatterns) {
      const match = content.match(pattern);
      if (match) {
        author = match[1].trim();
        break;
      }
    }
    
    // Extract timestamp - look for relative or absolute time
    const timestampPatterns = [
      /(\d+\s+(?:second|minute|hour|day|week|month|year)s?\s+ago)/i,
      /(?:posted|published|timestamp):\s*([^\n]+)/i,
      /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/,
      /(\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2})/,
      /(\d{1,2}:\d{2}\s*(?:AM|PM)?)/i,
      /<time[^>]*>([^<]+)<\/time>/i
    ];
    
    for (const pattern of timestampPatterns) {
      const match = content.match(pattern);
      if (match) {
        timestamp = match[1].trim();
        break;
      }
    }
    
    // Extract body - collect post content
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip lines before title
      if (titleLineIndex >= 0 && i <= titleLineIndex) {
        continue;
      }
      
      // Skip metadata lines (author, timestamp)
      if ((author && line.includes(author)) || (timestamp && line.includes(timestamp))) {
        continue;
      }
      
      // Skip UI elements
      if (line.toLowerCase().match(/^(like|share|comment|reply|report|edit|delete)$/)) {
        continue;
      }
      
      // Skip navigation and UI chrome
      if (line.toLowerCase().includes('navigation') ||
          line.toLowerCase().includes('sidebar') ||
          line.toLowerCase().includes('footer')) {
        continue;
      }
      
      // Collect content lines
      if (line.length > 0) {
        bodyLines.push(line);
      }
    }
    
    const body = bodyLines.join('\n').trim();
    
    return {
      title: title || '',
      author: author || '',
      timestamp: timestamp || '',
      body: body || ''
    };
  }

  /**
   * Summarizes content if it exceeds maximum length
   * 
   * Intelligently summarizes long content by:
   * - Keeping first paragraph (introduction)
   * - Extracting key sentences from middle
   * - Keeping last paragraph (conclusion)
   * - Removing redundant information
   * 
   * @param {string} content - Content to summarize
   * @param {number} maxLength - Maximum length (default: 1000)
   * @returns {string} Summarized content or original if under limit
   */
  static summarize(content, maxLength = 1000) {
    if (!content || typeof content !== 'string') {
      return '';
    }

    // If content is already under limit, return as-is
    if (content.length <= maxLength) {
      return content;
    }

    // Extract first paragraph (introduction)
    const firstParagraph = this._extractFirstParagraph(content);
    
    // Extract last paragraph (conclusion)
    const lastParagraph = this._extractLastParagraph(content);
    
    // Calculate remaining space for middle content
    const usedSpace = firstParagraph.length + lastParagraph.length + 40; // +40 for separators and indicators
    const remainingSpace = maxLength - usedSpace;
    
    // If first and last paragraphs already exceed limit, truncate them
    if (remainingSpace < 100) {
      const halfSpace = Math.floor((maxLength - 30) / 2); // -30 for indicator
      const truncatedFirst = firstParagraph.substring(0, halfSpace);
      const truncatedLast = lastParagraph.substring(Math.max(0, lastParagraph.length - halfSpace));
      const result = `${truncatedFirst}...\n\n[Content summarized]\n\n...${truncatedLast}`;
      // Ensure we don't exceed maxLength
      return result.length > maxLength ? result.substring(0, maxLength - 20) + '\n[Content truncated]' : result;
    }
    
    // Extract key sentences from middle
    const middleContent = this._extractMiddleContent(content, firstParagraph, lastParagraph);
    const keySentences = this._extractKeySentences(middleContent, remainingSpace);
    
    // Combine parts with indicator
    let result = firstParagraph;
    
    if (keySentences.length > 0 && middleContent.trim().length > 0) {
      result += '\n\n[Key points from content]\n' + keySentences;
    }
    
    if (lastParagraph.length > 0) {
      result += '\n\n' + lastParagraph;
    }
    
    // Final safety check - if still too long, hard truncate
    if (result.length > maxLength) {
      result = result.substring(0, maxLength - 20) + '\n\n[Content truncated]';
    }
    
    return result;
  }

  /**
   * Extracts the first paragraph from content
   * 
   * @private
   * @param {string} content - Content to extract from
   * @returns {string} First paragraph
   */
  static _extractFirstParagraph(content) {
    if (!content) return '';
    
    const lines = content.split('\n');
    const paragraphLines = [];
    let foundContent = false;
    
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines at start
      if (!foundContent && trimmed.length === 0) {
        continue;
      }
      
      // Skip markdown headings at start
      if (!foundContent && trimmed.match(/^#{1,6}\s/)) {
        continue;
      }
      
      foundContent = true;
      paragraphLines.push(line);
      
      // End of first paragraph (double newline or enough content)
      if (trimmed.length === 0 && paragraphLines.length > 1) {
        break;
      }
      
      // Limit first paragraph to reasonable size
      if (paragraphLines.join('\n').length > 300) {
        break;
      }
    }
    
    return paragraphLines.join('\n').trim();
  }

  /**
   * Extracts the last paragraph from content
   * 
   * @private
   * @param {string} content - Content to extract from
   * @returns {string} Last paragraph
   */
  static _extractLastParagraph(content) {
    if (!content) return '';
    
    const lines = content.split('\n');
    const paragraphLines = [];
    let foundContent = false;
    
    // Work backwards from end
    for (let i = lines.length - 1; i >= 0; i--) {
      const trimmed = lines[i].trim();
      const lowerTrimmed = trimmed.toLowerCase();
      
      // Skip empty lines at end
      if (!foundContent && trimmed.length === 0) {
        continue;
      }
      
      // Skip footer/navigation markers - check if line STARTS with these keywords
      if (lowerTrimmed.startsWith('footer') ||
          lowerTrimmed.startsWith('copyright') ||
          lowerTrimmed.startsWith('navigation')) {
        continue;
      }
      
      foundContent = true;
      paragraphLines.unshift(lines[i]);
      
      // End of last paragraph (double newline or enough content)
      if (trimmed.length === 0 && paragraphLines.length > 1) {
        break;
      }
      
      // Limit last paragraph to reasonable size
      if (paragraphLines.join('\n').length > 200) {
        break;
      }
    }
    
    return paragraphLines.join('\n').trim();
  }

  /**
   * Extracts middle content between first and last paragraphs
   * 
   * @private
   * @param {string} content - Full content
   * @param {string} firstParagraph - First paragraph
   * @param {string} lastParagraph - Last paragraph
   * @returns {string} Middle content
   */
  static _extractMiddleContent(content, firstParagraph, lastParagraph) {
    if (!content) return '';
    
    let middle = content;
    
    // Remove first paragraph
    if (firstParagraph) {
      const firstIndex = middle.indexOf(firstParagraph);
      if (firstIndex !== -1) {
        middle = middle.substring(firstIndex + firstParagraph.length);
      }
    }
    
    // Remove last paragraph
    if (lastParagraph) {
      const lastIndex = middle.lastIndexOf(lastParagraph);
      if (lastIndex !== -1) {
        middle = middle.substring(0, lastIndex);
      }
    }
    
    return middle.trim();
  }

  /**
   * Extracts key sentences from content
   * 
   * Prioritizes:
   * - Longer sentences (more substantial)
   * - Sentences with important keywords
   * - Removes very similar sentences
   * 
   * @private
   * @param {string} content - Content to extract from
   * @param {number} maxLength - Maximum total length
   * @returns {string} Key sentences
   */
  static _extractKeySentences(content, maxLength) {
    if (!content || maxLength < 50) return '';
    
    // Split into sentences (simple approach)
    const sentences = content
      .split(/[.!?]+\s+/)
      .map(s => s.trim())
      .filter(s => s.length > 20); // Filter out very short fragments
    
    if (sentences.length === 0) return '';
    
    // Score sentences based on importance
    const scoredSentences = sentences.map(sentence => ({
      text: sentence,
      score: this._scoreSentence(sentence)
    }));
    
    // Sort by score (highest first)
    scoredSentences.sort((a, b) => b.score - a.score);
    
    // Select sentences until we reach maxLength
    const selectedSentences = [];
    let currentLength = 0;
    
    for (const item of scoredSentences) {
      const sentenceLength = item.text.length + 2; // +2 for ". "
      
      if (currentLength + sentenceLength > maxLength) {
        break;
      }
      
      // Check for redundancy with already selected sentences
      if (!this._isRedundant(item.text, selectedSentences)) {
        selectedSentences.push(item.text);
        currentLength += sentenceLength;
      }
    }
    
    // Return sentences in original order (not sorted by score)
    const orderedSentences = [];
    for (const sentence of sentences) {
      if (selectedSentences.includes(sentence)) {
        orderedSentences.push(sentence);
      }
    }
    
    return orderedSentences.join('. ') + (orderedSentences.length > 0 ? '.' : '');
  }

  /**
   * Scores a sentence based on importance indicators
   * 
   * @private
   * @param {string} sentence - Sentence to score
   * @returns {number} Importance score
   */
  static _scoreSentence(sentence) {
    let score = 0;
    
    // Longer sentences tend to be more substantial
    score += Math.min(sentence.length / 10, 20);
    
    // Important keywords increase score
    const importantKeywords = [
      'important', 'key', 'significant', 'critical', 'essential',
      'main', 'primary', 'major', 'fundamental', 'crucial',
      'result', 'conclusion', 'finding', 'shows', 'demonstrates',
      'first', 'second', 'third', 'finally', 'therefore', 'however'
    ];
    
    const lowerSentence = sentence.toLowerCase();
    for (const keyword of importantKeywords) {
      if (lowerSentence.includes(keyword)) {
        score += 5;
      }
    }
    
    // Sentences with numbers/data are often important
    if (/\d+/.test(sentence)) {
      score += 3;
    }
    
    // Sentences with quotes might be important
    if (sentence.includes('"') || sentence.includes("'")) {
      score += 2;
    }
    
    return score;
  }

  /**
   * Checks if a sentence is redundant with already selected sentences
   * 
   * @private
   * @param {string} sentence - Sentence to check
   * @param {Array<string>} selectedSentences - Already selected sentences
   * @returns {boolean} True if redundant
   */
  static _isRedundant(sentence, selectedSentences) {
    if (selectedSentences.length === 0) return false;
    
    const words1 = sentence.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    for (const selected of selectedSentences) {
      const words2 = selected.toLowerCase().split(/\s+/).filter(w => w.length > 3);
      
      // Calculate word overlap
      const commonWords = words1.filter(w => words2.includes(w));
      const overlapRatio = commonWords.length / Math.min(words1.length, words2.length);
      
      // If more than 50% overlap, consider redundant
      if (overlapRatio > 0.5) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Extracts multiple items from snapshot
   * 
   * @param {string} snapshot - Page snapshot
   * @param {string} itemType - Type of items (posts, results, articles)
   * @param {number} count - Number of items to extract
   * @returns {Array} Extracted items
   */
  static extractMultipleItems(snapshot, itemType, count) {
    if (!snapshot || typeof snapshot !== 'string' || !itemType) {
      return [];
    }

    const lowerItemType = itemType.toLowerCase();
    
    // Delegate to appropriate extraction method based on item type
    if (lowerItemType === 'results' || lowerItemType === 'search_results') {
      return this.extractSearchResults(snapshot, count);
    }
    
    if (lowerItemType === 'posts' || lowerItemType === 'post_content') {
      // For posts, we need to split the snapshot into individual posts
      // and extract each one
      const posts = [];
      const sections = this._splitIntoSections(snapshot);
      
      for (let i = 0; i < Math.min(sections.length, count); i++) {
        const post = this.extractPost(sections[i]);
        if (post.title || post.body) {
          posts.push(post);
        }
      }
      
      return posts;
    }
    
    if (lowerItemType === 'articles' || lowerItemType === 'article_content') {
      // For articles, split into sections and extract each
      const articles = [];
      const sections = this._splitIntoSections(snapshot);
      
      for (let i = 0; i < Math.min(sections.length, count); i++) {
        const article = this.extractArticle(sections[i]);
        if (article.title || article.body) {
          articles.push(article);
        }
      }
      
      return articles;
    }
    
    // Unknown item type - return empty array
    return [];
  }

  /**
   * Splits content into sections for batch extraction
   * Helper method for extractMultipleItems
   * 
   * @private
   * @param {string} content - Content to split
   * @returns {Array<string>} Array of content sections
   */
  static _splitIntoSections(content) {
    if (!content) return [];
    
    // Try to split by common section markers
    let sections = [];
    
    // Split by [SEARCH-RESULT] markers
    if (content.includes('[SEARCH-RESULT]') || content.includes('[search-result]')) {
      const parts = content.split(/\[search-result\]/i);
      sections = parts.filter(p => p.trim().length > 0);
      return sections;
    }
    
    // Split by horizontal rules or multiple blank lines
    const parts = content.split(/\n\s*---+\s*\n|\n\n\n+/);
    if (parts.length > 1) {
      sections = parts.filter(p => p.trim().length > 50);
      if (sections.length > 1) {
        return sections;
      }
    }
    
    // Split by repeated heading patterns (## or ###)
    const headingParts = content.split(/\n(?=#{2,3}\s)/);
    if (headingParts.length > 1) {
      sections = headingParts.filter(p => p.trim().length > 50);
      if (sections.length > 1) {
        return sections;
      }
    }
    
    // If no clear sections, return whole content as single section
    return [content];
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContentExtractor;
}
