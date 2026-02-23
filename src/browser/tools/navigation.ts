import { BrowserManager } from '../browser-manager';
import { ToolResult, Logger, ContentExtractionResult } from '../../types';
import { ConsoleLogger } from '../../utils';

export class NavigationTools {
  private logger: Logger;

  constructor(private browserManager: BrowserManager, logger?: Logger) {
    this.logger = logger ?? new ConsoleLogger('NavigationTools');
  }

  async navigate(url: string): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      await this.browserManager.navigate(url);
      return {
        status: 'success',
        message: `Navigated to ${url}`,
        data: { url },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error navigating to URL: ${errorMessage}`);
      return { status: 'error', message: `Failed to navigate: ${errorMessage}` };
    }
  }

  async goBack(): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      await this.browserManager.goBack();
      return { status: 'success', message: 'Navigated back' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error navigating back: ${errorMessage}`);
      return { status: 'error', message: `Failed to navigate back: ${errorMessage}` };
    }
  }

  async goForward(): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      await this.browserManager.goForward();
      return { status: 'success', message: 'Navigated forward' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error navigating forward: ${errorMessage}`);
      return { status: 'error', message: `Failed to navigate forward: ${errorMessage}` };
    }
  }

  async refresh(): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      await this.browserManager.refresh();
      return { status: 'success', message: 'Page refreshed' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error refreshing page: ${errorMessage}`);
      return { status: 'error', message: `Failed to refresh: ${errorMessage}` };
    }
  }
}
