import { Page } from 'playwright';
import { BrowserManager } from '../browser-manager';
import { ToolResult, Logger, ContentExtractionResult } from '../../types';
import { ConsoleLogger } from '../../utils';

export class ContentTools {
  private logger: Logger;
  private readonly CHUNK_SIZE = 8000;

  constructor(private browserManager: BrowserManager, logger?: Logger) {
    this.logger = logger ?? new ConsoleLogger('ContentTools');
  }

  async getMarkdown(page?: number): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const browserPage = this.browserManager.getPage();
      const result = await this.extractContent(browserPage, page ?? 1);

      return {
        status: 'success',
        data: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error extracting markdown: ${errorMessage}`);
      return { status: 'error', message: `Failed to extract content: ${errorMessage}` };
    }
  }

  async getUrl(): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      const url = page.url();

      return {
        status: 'success',
        data: { url },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { status: 'error', message: `Failed to get URL: ${errorMessage}` };
    }
  }

  async getTitle(): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      const title = await page.title();

      return {
        status: 'success',
        data: { title },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return { status: 'error', message: `Failed to get title: ${errorMessage}` };
    }
  }

  private async extractContent(page: Page, pageNum: number): Promise<ContentExtractionResult> {
    const title = await page.title();

    const content = await page.evaluate(() => {
      const getInnerText = (element: Element): string => {
        let text = '';
        const childNodes = Array.from(element.childNodes);
        for (const node of childNodes) {
          if (node.nodeType === Node.TEXT_NODE) {
            text += node.textContent?.trim() + ' ';
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            const el = node as Element;
            const tagName = el.tagName.toLowerCase();

            if (['script', 'style', 'noscript', 'iframe', 'svg'].includes(tagName)) {
              continue;
            }

            if (tagName === 'br') {
              text += '\n';
            } else if (tagName === 'p' || tagName === 'div' || tagName === 'section') {
              text += '\n' + getInnerText(el) + '\n';
            } else if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'h4' || tagName === 'h5' || tagName === 'h6') {
              text += '\n## ' + getInnerText(el) + '\n';
            } else if (tagName === 'a') {
              const href = el.getAttribute('href');
              const linkText = getInnerText(el).trim();
              if (href && linkText) {
                text += `[${linkText}](${href}) `;
              } else {
                text += linkText + ' ';
              }
            } else if (tagName === 'img') {
              const alt = el.getAttribute('alt') || '';
              const src = el.getAttribute('src') || '';
              if (alt || src) {
                text += `![${alt}](${src}) `;
              }
            } else if (tagName === 'li') {
              text += '- ' + getInnerText(el) + '\n';
            } else if (tagName === 'ul' || tagName === 'ol') {
              text += '\n' + getInnerText(el) + '\n';
            } else if (tagName === 'input' || tagName === 'textarea') {
              const inputType = el.getAttribute('type') || 'text';
              const value = (el as HTMLInputElement).value || '';
              const placeholder = el.getAttribute('placeholder') || '';
              text += `[${inputType} input: ${value || placeholder}] `;
            } else if (tagName === 'button') {
              text += `[Button: ${getInnerText(el).trim()}] `;
            } else {
              text += getInnerText(el) + ' ';
            }
          }
        }
        return text;
      };

      const body = document.body;
      return getInnerText(body);
    });

    const cleanContent = content
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    const totalPages = Math.ceil(cleanContent.length / this.CHUNK_SIZE);
    const currentPage = Math.min(pageNum, Math.max(1, totalPages));
    const startIndex = (currentPage - 1) * this.CHUNK_SIZE;
    const endIndex = startIndex + this.CHUNK_SIZE;
    const pageContent = totalPages > 1 ? cleanContent.slice(startIndex, endIndex) : cleanContent;

    return {
      content: pageContent,
      title,
      pagination: {
        currentPage,
        totalPages: Math.max(1, totalPages),
        hasMorePages: currentPage < totalPages,
      },
    };
  }
}
