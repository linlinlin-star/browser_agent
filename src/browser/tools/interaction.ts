import { Page } from 'playwright';
import { BrowserManager } from '../browser-manager';
import { ToolResult, Logger } from '../../types';
import { ConsoleLogger } from '../../utils';

export class InteractionTools {
  private logger: Logger;

  private static readonly KNOWN_SEARCH_ENGINES: Record<string, (query: string) => string> = {
    'baidu.com': (query: string) => `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
    'bilibili.com': (query: string) => `https://search.bilibili.com/all?keyword=${encodeURIComponent(query)}`,
    'google.com': (query: string) => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    'bing.com': (query: string) => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    'duckduckgo.com': (query: string) => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
    'yahoo.com': (query: string) => `https://search.yahoo.com/search?p=${encodeURIComponent(query)}`
  };

  constructor(private browserManager: BrowserManager, logger?: Logger) {
    this.logger = logger ?? new ConsoleLogger('InteractionTools');
  }

  async click(selector: string): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      await page.click(selector);

      return { status: 'success', message: `Clicked element: ${selector}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error clicking element: ${errorMessage}`);
      return { status: 'error', message: `Failed to click: ${errorMessage}` };
    }
  }

  async type(selector: string, text: string): Promise<ToolResult> {
      try {
        if (!this.browserManager.isLaunchingComplete()) {
          return { status: 'error', message: 'Browser not initialized' };
        }

        const page = this.browserManager.getPage();
        await page.fill(selector, text);

        // Check if this is a search input and text doesn't end with \n
        const isSearch = await this.isSearchInput(page, selector);
        const endsWithNewline = text.endsWith('\n');

        if (isSearch && !endsWithNewline) {
          try {
            this.logger.info('Search input detected, auto-submitting search...');

            // Check if this is a known search engine
            const currentUrl = page.url();
            const urlConstructor = this.getSearchEngineUrlConstructor(currentUrl);

            if (urlConstructor) {
              // Known search engine: construct URL and navigate directly
              const searchUrl = urlConstructor(text);
              this.logger.info(`Known search engine detected, navigating to: ${searchUrl}`);

              await page.goto(searchUrl);

              // Wait for page response after navigation
              try {
                await page.waitForLoadState('networkidle', { timeout: 5000 });
              } catch (waitError) {
                this.logger.debug('Network idle timeout after navigation (this is acceptable)');
              }

              return { 
                status: 'success', 
                message: `Typed text into: ${selector} and submitted search via direct navigation` 
              };
            } else {
              // Unknown site: use Enter key submission as fallback
              this.logger.info('Unknown site, using Enter key submission');
              await page.keyboard.press('Enter');

              try {
                await page.waitForLoadState('networkidle', { timeout: 5000 });
              } catch (waitError) {
                this.logger.debug('Network idle timeout after search submission (this is acceptable)');
              }

              return { 
                status: 'success', 
                message: `Typed text into: ${selector} and submitted search via Enter key` 
              };
            }
          } catch (submitError) {
            const submitErrorMessage = submitError instanceof Error ? submitError.message : String(submitError);
            this.logger.error(`Error submitting search: ${submitErrorMessage}`);
            return { 
              status: 'success', 
              message: `Typed text into: ${selector} (search submission failed: ${submitErrorMessage})` 
            };
          }
        }

        return { status: 'success', message: `Typed text into: ${selector}` };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Error typing text: ${errorMessage}`);
        return { status: 'error', message: `Failed to type: ${errorMessage}` };
      }
    }
  private getSearchEngineUrlConstructor(url: string): ((query: string) => string) | null {
    try {
      const urlObj = new URL(url);
      const hostname = urlObj.hostname.toLowerCase();
      
      for (const [domain, constructor] of Object.entries(InteractionTools.KNOWN_SEARCH_ENGINES)) {
        // Check if hostname ends with the domain (handles subdomains)
        if (hostname === domain || hostname.endsWith('.' + domain)) {
          return constructor;
        }
      }
    } catch (error) {
      // Invalid URL, return null
      this.logger.debug(`Invalid URL provided to getSearchEngineUrlConstructor: ${url}`);
    }
    return null;
  }

  private async isSearchInput(page: Page, selector: string): Promise<boolean> {
    try {
      const element = await page.$(selector);
      if (!element) {
        return false;
      }

      // Check type="search"
      const type = await element.getAttribute('type');
      if (type === 'search') {
        this.logger.debug('Detected search input: type="search"');
        return true;
      }

      // Check role="searchbox"
      const role = await element.getAttribute('role');
      if (role === 'searchbox') {
        this.logger.debug('Detected search input: role="searchbox"');
        return true;
      }

      // Check aria-label contains search keywords
      const ariaLabel = await element.getAttribute('aria-label');
      if (ariaLabel && /search|搜索|検索/i.test(ariaLabel)) {
        this.logger.debug(`Detected search input: aria-label="${ariaLabel}"`);
        return true;
      }

      // Check name matches search pattern
      const name = await element.getAttribute('name');
      if (name && /^(search|query|q|keyword|搜索|wd|kw|s|term)$/i.test(name)) {
        this.logger.debug(`Detected search input: name="${name}"`);
        return true;
      }

      // Check id matches search pattern
      const id = await element.getAttribute('id');
      if (id && /search|query|搜索|kw|keyword/i.test(id)) {
        this.logger.debug(`Detected search input: id="${id}"`);
        return true;
      }

      // Check placeholder contains search keywords
      const placeholder = await element.getAttribute('placeholder');
      if (placeholder && /search|搜索|検索/i.test(placeholder)) {
        this.logger.debug(`Detected search input: placeholder="${placeholder}"`);
        return true;
      }

      // Check class contains search keywords
      const className = await element.getAttribute('class');
      if (className && /search|query|搜索/i.test(className)) {
        this.logger.debug(`Detected search input: class="${className}"`);
        return true;
      }

      // Check if parent form action contains "search"
      const formAction = await element.evaluate((el) => {
        const form = el.closest('form');
        return form ? form.action : null;
      });
      if (formAction && /search/i.test(formAction)) {
        this.logger.debug(`Detected search input: form action="${formAction}"`);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error detecting search input: ${error}`);
      return false;
    }
  }

  async press(key: string): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      await page.keyboard.press(key);

      return { status: 'success', message: `Pressed key: ${key}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error pressing key: ${errorMessage}`);
      return { status: 'error', message: `Failed to press key: ${errorMessage}` };
    }
  }

  async hover(selector: string): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      await page.hover(selector);

      return { status: 'success', message: `Hovered over: ${selector}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error hovering: ${errorMessage}`);
      return { status: 'error', message: `Failed to hover: ${errorMessage}` };
    }
  }

  async scroll(direction: 'up' | 'down' | 'left' | 'right', amount: number = 300): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      let deltaX = 0;
      let deltaY = 0;

      switch (direction) {
        case 'up':
          deltaY = -amount;
          break;
        case 'down':
          deltaY = amount;
          break;
        case 'left':
          deltaX = -amount;
          break;
        case 'right':
          deltaX = amount;
          break;
      }

      await page.evaluate(
        ({ deltaX, deltaY }) => {
          window.scrollBy(deltaX, deltaY);
        },
        { deltaX, deltaY }
      );

      return { status: 'success', message: `Scrolled ${direction}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error scrolling: ${errorMessage}`);
      return { status: 'error', message: `Failed to scroll: ${errorMessage}` };
    }
  }

  async select(selector: string, value: string): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      await page.selectOption(selector, value);

      return { status: 'success', message: `Selected option: ${value}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error selecting option: ${errorMessage}`);
      return { status: 'error', message: `Failed to select: ${errorMessage}` };
    }
  }

  async waitForSelector(selector: string, timeout: number = 10000): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      await page.waitForSelector(selector, { timeout });

      return { status: 'success', message: `Element found: ${selector}` };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error waiting for selector: ${errorMessage}`);
      return { status: 'error', message: `Element not found: ${errorMessage}` };
    }
  }

  async getElements(selector: string): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      const elements = await page.$$(selector);
      const count = elements.length;

      const elementInfo = await Promise.all(
        elements.slice(0, 10).map(async (el, index) => {
          const text = await el.textContent();
          const tagName = await el.evaluate((e) => e.tagName.toLowerCase());
          return { index, tagName, text: text?.trim().slice(0, 100) };
        })
      );

      return {
        status: 'success',
        data: { count, elements: elementInfo },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting elements: ${errorMessage}`);
      return { status: 'error', message: `Failed to get elements: ${errorMessage}` };
    }
  }
}
