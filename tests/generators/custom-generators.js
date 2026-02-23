/**
 * Custom generators for property-based testing
 * Used with fast-check library for agent performance optimization tests
 */

const fc = require('fast-check');

/**
 * Generates realistic task descriptions for testing
 * Includes simple tasks, search tasks, and multi-step tasks
 */
const taskGenerator = () => fc.oneof(
  // Simple navigation tasks
  fc.constant('Open Bilibili'),
  fc.constant('Navigate to Google'),
  fc.constant('Go to YouTube'),
  
  // Simple search tasks
  fc.constant('Search Baidu for "莆田"'),
  fc.constant('Search Google for "weather"'),
  
  // Multi-step tasks with "and"
  fc.tuple(
    fc.constantFrom('Search', 'Find', 'Look for', 'Look up'),
    fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', ' '), { minLength: 3, maxLength: 20 }),
    fc.constantFrom('and tell me', 'and extract', 'and show me', 'and find'),
    fc.constantFrom('the first result', 'the top 3 results', 'all results', 'the first two posts', 'the content')
  ).map(([verb, query, connector, target]) => `${verb} ${query.trim()} ${connector} ${target}`),
  
  // Multi-step tasks with "then"
  fc.tuple(
    fc.constantFrom('Open', 'Navigate to', 'Go to'),
    fc.constantFrom('Baidu', 'Google', 'YouTube', 'Bilibili'),
    fc.constantFrom('then search for', 'then find', 'then look for'),
    fc.stringOf(fc.constantFrom('a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', ' '), { minLength: 3, maxLength: 15 })
  ).map(([action, site, connector, query]) => `${action} ${site} ${connector} ${query.trim()}`)
);

/**
 * Generates page snapshots with realistic HTML structure
 */
const snapshotGenerator = () => fc.oneof(
  // Search results page
  fc.tuple(
    fc.array(fc.tuple(fc.string({ minLength: 10, maxLength: 50 }), fc.string({ minLength: 20, maxLength: 100 })), { minLength: 3, maxLength: 10 })
  ).map(([results]) => {
    const resultHtml = results.map(([title, snippet], i) => 
      `<div class="result" ref="e${i}"><h3>${title}</h3><p>${snippet}</p></div>`
    ).join('\n');
    return `<div class="search-results">${resultHtml}</div>`;
  }),
  
  // Article page
  fc.tuple(
    fc.string({ minLength: 10, maxLength: 100 }),
    fc.string({ minLength: 100, maxLength: 1000 })
  ).map(([title, content]) => 
    `<article><h1>${title}</h1><div class="content">${content}</div></article>`
  ),
  
  // Post/forum page
  fc.tuple(
    fc.string({ minLength: 10, maxLength: 50 }),
    fc.string({ minLength: 5, maxLength: 20 }),
    fc.string({ minLength: 50, maxLength: 500 })
  ).map(([title, author, body]) => 
    `<div class="post"><h2>${title}</h2><span class="author">${author}</span><div class="body">${body}</div></div>`
  ),
  
  // Generic page
  fc.string({ minLength: 100, maxLength: 2000 }).map(s => `<div>${s}</div>`)
);

/**
 * Generates action sequences for testing execution patterns
 */
const actionSequenceGenerator = () => fc.array(
  fc.record({
    action: fc.constantFrom('snapshot', 'click', 'fill', 'search', 'navigate', 'wait', 'getUrl', 'getText', 'getMarkdown'),
    args: fc.oneof(
      fc.record({ ref: fc.string() }),
      fc.record({ url: fc.webUrl() }),
      fc.record({ query: fc.string() }),
      fc.record({ ms: fc.integer({ min: 100, max: 5000 }) }),
      fc.constant({})
    ),
    timestamp: fc.integer({ min: 1000000000000, max: 2000000000000 })
  }),
  { minLength: 5, maxLength: 30 }
);

/**
 * Generates sub-goal objects for testing progress tracking
 */
const subGoalGenerator = () => fc.record({
  id: fc.integer({ min: 1, max: 5 }),
  description: fc.string({ minLength: 10, maxLength: 100 }),
  type: fc.constantFrom('search', 'navigation', 'content_extraction', 'interaction', 'composite'),
  completionCriteria: fc.string({ minLength: 10, maxLength: 100 }),
  estimatedSteps: fc.integer({ min: 1, max: 15 }),
  completed: fc.boolean()
});

/**
 * Generates arrays of sub-goals (2-5 items)
 */
const subGoalsArrayGenerator = () => fc.array(subGoalGenerator(), { minLength: 2, maxLength: 5 });

/**
 * Generates content strings of various lengths
 */
const contentGenerator = (minLength = 0, maxLength = 5000) => 
  fc.string({ minLength, maxLength });

/**
 * Generates URL strings
 */
const urlGenerator = () => fc.webUrl();

/**
 * Generates task categories
 */
const taskCategoryGenerator = () => 
  fc.constantFrom('navigation', 'search', 'content_extraction', 'interaction', 'composite');

/**
 * Generates content extraction patterns
 */
const contentPatternGenerator = () => 
  fc.constantFrom('search_results', 'article_content', 'post_content', 'list_items');

module.exports = {
  taskGenerator,
  snapshotGenerator,
  actionSequenceGenerator,
  subGoalGenerator,
  subGoalsArrayGenerator,
  contentGenerator,
  urlGenerator,
  taskCategoryGenerator,
  contentPatternGenerator
};
