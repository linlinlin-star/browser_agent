import { chromium, Browser, Page, BrowserContext } from 'playwright';
import { BrowserOptions, Logger, BrowserState, ScreenshotOutput } from '../types';
import { ConsoleLogger } from '../utils/logger';
import * as path from 'path';
import * as fs from 'fs';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private logger: Logger;
  private isLaunched = false;
  private options: BrowserOptions;
  private userDataDir?: string;
  private isPersistentContext = false;

  constructor(options: BrowserOptions = {}, logger?: Logger) {
    this.options = {
      headless: options.headless ?? false,
      control: options.control ?? 'hybrid',
      ...options,
    };
    this.logger = logger ?? new ConsoleLogger('BrowserManager');
    this.userDataDir = options.userDataDir;
  }

  async launch(): Promise<void> {
    if (this.isLaunched) {
      this.logger.info('Browser already launched, skipping launch');
      return;
    }

    try {
      this.logger.info('Launching browser instance...');

      if (this.options.cdpEndpoint) {
        this.browser = await chromium.connectOverCDP(this.options.cdpEndpoint);
        this.context = this.browser.contexts()[0] || await this.browser.newContext();
        this.page = this.context.pages()[0] || await this.context.newPage();
      } else if (this.userDataDir) {
        if (!fs.existsSync(this.userDataDir)) {
          fs.mkdirSync(this.userDataDir, { recursive: true });
        }
        this.context = await chromium.launchPersistentContext(this.userDataDir, {
          headless: this.options.headless,
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        });
        this.isPersistentContext = true;
        this.page = this.context.pages()[0] || await this.context.newPage();
      } else {
        this.browser = await chromium.launch({
          headless: this.options.headless,
          args: [
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security',
            '--disable-features=IsolateOrigins,site-per-process',
          ],
        });

        this.context = await this.browser.newContext({
          viewport: { width: 1280, height: 720 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        });

        this.page = await this.context.newPage();
      }

      this.isLaunched = true;

      this.logger.success('Browser instance launched successfully');
    } catch (error) {
      this.logger.error(`Failed to launch browser: ${error}`);
      throw error;
    }
  }

  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      if (this.context) {
        await this.context.close();
        this.context = null;
      }
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      this.isLaunched = false;
      this.logger.info('Browser closed successfully');
    } catch (error) {
      this.logger.error(`Failed to close browser: ${error}`);
    }
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  getContext(): BrowserContext | null {
    return this.context;
  }

  getPage(): Page {
    if (!this.page) {
      throw new Error('Browser not initialized. Call launch() first.');
    }
    return this.page;
  }

  async getActivePage(): Promise<Page> {
    return this.getPage();
  }

  isBrowserAlive(): boolean {
    return this.isLaunched && this.browser !== null && this.browser.isConnected();
  }

  isLaunchingComplete(): boolean {
    return this.isLaunched;
  }

  async screenshot(): Promise<ScreenshotOutput> {
    const page = this.getPage();
    const buffer = await page.screenshot({ type: 'jpeg', quality: 75 });

    return {
      base64: buffer.toString('base64'),
      scaleFactor: 1,
      width: 1280,
      height: 720,
    };
  }

  async getState(): Promise<BrowserState> {
    const page = this.getPage();
    const screenshot = await this.screenshot();

    return {
      currentUrl: page.url(),
      currentScreenshot: `data:image/jpeg;base64,${screenshot.base64}`,
      title: await page.title(),
    };
  }

  async navigate(url: string): Promise<void> {
    const page = this.getPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    this.logger.info(`Navigated to: ${url}`);
  }

  async goBack(): Promise<void> {
    const page = this.getPage();
    await page.goBack({ waitUntil: 'domcontentloaded' });
    this.logger.info('Navigated back');
  }

  async goForward(): Promise<void> {
    const page = this.getPage();
    await page.goForward({ waitUntil: 'domcontentloaded' });
    this.logger.info('Navigated forward');
  }

  async refresh(): Promise<void> {
    const page = this.getPage();
    await page.reload({ waitUntil: 'domcontentloaded' });
    this.logger.info('Page refreshed');
  }

  async waitForSelector(selector: string, timeout: number = 10000): Promise<void> {
    const page = this.getPage();
    await page.waitForSelector(selector, { timeout });
  }

  async waitForLoadState(state: 'load' | 'domcontentloaded' | 'networkidle' = 'load'): Promise<void> {
    const page = this.getPage();
    await page.waitForLoadState(state);
  }
}
