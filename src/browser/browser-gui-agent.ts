import { Page, Keyboard, Mouse } from 'playwright';
import { BrowserManager } from './browser-manager';
import { ActionType, Logger, ExecuteParams, ExecuteOutput, ScreenshotOutput, Coordinate } from '../types';
import { ConsoleLogger, sleep, parseActionString, normalizeCoordinates } from '../utils';

export const ACTION_SPACES = [
  `click(point='<point>x y</point>') - Click at the specified coordinates`,
  `left_double(point='<point>x y</point>') - Double-click at the specified coordinates`,
  `right_single(point='<point>x y y</point>') - Right-click at the specified coordinates`,
  `drag(start_point='<point>x1 y1</point>', end_point='<point>x2 y2</point>') - Drag from start to end point`,
  `hotkey(key='ctrl c') - Press keyboard shortcut (use space to separate keys, lowercase)`,
  `type(content='xxx') - Type text content (use \\n for newline, \\n at end to submit)`,
  `scroll(point='<point>x y</point>', direction='down or up or right or left') - Scroll in specified direction`,
  `wait() - Wait 5 seconds and take a screenshot to check for changes`,
  `finished(content='xxx') - Submit the task with a report to the user`,
  `call_user() - Call the user when the task is unsolvable or need help`,
];

export interface GUIAgentOptions {
  browserManager: BrowserManager;
  logger?: Logger;
  scaleFactor?: number;
}

export class BrowserGUIAgent {
  private browserManager: BrowserManager;
  private logger: Logger;
  private scaleFactor: number;
  private screenWidth: number = 1280;
  private screenHeight: number = 720;

  constructor(options: GUIAgentOptions) {
    this.browserManager = options.browserManager;
    this.logger = options.logger ?? new ConsoleLogger('BrowserGUIAgent');
    this.scaleFactor = options.scaleFactor ?? 1000;
  }

  async screenshot(): Promise<ScreenshotOutput> {
    return await this.browserManager.screenshot();
  }

  async execute(params: ExecuteParams): Promise<ExecuteOutput> {
    const { action_type, action_inputs } = params.parsedPrediction;

    try {
      const page = this.browserManager.getPage();

      switch (action_type) {
        case 'click':
          return await this.executeClick(page, action_inputs);
        case 'left_double':
          return await this.executeDoubleClick(page, action_inputs);
        case 'right_single':
          return await this.executeRightClick(page, action_inputs);
        case 'drag':
          return await this.executeDrag(page, action_inputs);
        case 'hotkey':
          return await this.executeHotkey(page, action_inputs);
        case 'type':
          return await this.executeType(page, action_inputs);
        case 'scroll':
          return await this.executeScroll(page, action_inputs);
        case 'wait':
          return await this.executeWait();
        case 'finished':
          return { success: true, message: String(action_inputs?.content ?? 'Task finished') };
        case 'call_user':
          return { success: true, message: 'Calling user for assistance' };
        default:
          return { success: false, message: `Unknown action type: ${action_type}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Action execution failed: ${errorMessage}`);
      return { success: false, message: errorMessage };
    }
  }

  private parsePoint(pointInput: any): Coordinate | null {
    if (!pointInput) return null;

    if (typeof pointInput === 'object' && 'x' in pointInput && 'y' in pointInput) {
      return normalizeCoordinates(
        { x: pointInput.x, y: pointInput.y },
        this.screenWidth,
        this.screenHeight,
        this.scaleFactor
      );
    }

    if (typeof pointInput === 'string') {
      const match = pointInput.match(/<point>(\d+)\s+(\d+)<\/point>/);
      if (match) {
        return normalizeCoordinates(
          { x: parseInt(match[1], 10), y: parseInt(match[2], 10) },
          this.screenWidth,
          this.screenHeight,
          this.scaleFactor
        );
      }
    }

    return null;
  }

  private async executeClick(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const point = this.parsePoint(inputs?.point);
    if (!point) {
      return { success: false, message: 'Invalid click coordinates' };
    }

    this.logger.debug(`Clicking at (${point.x}, ${point.y})`);
    await page.mouse.click(point.x, point.y);
    await sleep(300);

    return { success: true, message: `Clicked at (${point.x}, ${point.y})` };
  }

  private async executeDoubleClick(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const point = this.parsePoint(inputs?.point);
    if (!point) {
      return { success: false, message: 'Invalid double-click coordinates' };
    }

    this.logger.debug(`Double-clicking at (${point.x}, ${point.y})`);
    await page.mouse.dblclick(point.x, point.y);
    await sleep(300);

    return { success: true, message: `Double-clicked at (${point.x}, ${point.y})` };
  }

  private async executeRightClick(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const point = this.parsePoint(inputs?.point);
    if (!point) {
      return { success: false, message: 'Invalid right-click coordinates' };
    }

    this.logger.debug(`Right-clicking at (${point.x}, ${point.y})`);
    await page.mouse.click(point.x, point.y, { button: 'right' });
    await sleep(300);

    return { success: true, message: `Right-clicked at (${point.x}, ${point.y})` };
  }

  private async executeDrag(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const startPoint = this.parsePoint(inputs?.start_point);
    const endPoint = this.parsePoint(inputs?.end_point);

    if (!startPoint || !endPoint) {
      return { success: false, message: 'Invalid drag coordinates' };
    }

    this.logger.debug(`Dragging from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})`);
    await page.mouse.move(startPoint.x, startPoint.y);
    await page.mouse.down();
    await page.mouse.move(endPoint.x, endPoint.y, { steps: 10 });
    await page.mouse.up();
    await sleep(300);

    return { success: true, message: `Dragged from (${startPoint.x}, ${startPoint.y}) to (${endPoint.x}, ${endPoint.y})` };
  }

  private async executeHotkey(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const key = inputs?.key;
    if (!key) {
      return { success: false, message: 'No key specified for hotkey' };
    }

    const keys = key.split(' ').map((k: string) => {
      const keyMap: Record<string, string> = {
        'ctrl': 'Control',
        'alt': 'Alt',
        'shift': 'Shift',
        'meta': 'Meta',
        'enter': 'Enter',
        'tab': 'Tab',
        'escape': 'Escape',
        'backspace': 'Backspace',
        'delete': 'Delete',
        'arrowup': 'ArrowUp',
        'arrowdown': 'ArrowDown',
        'arrowleft': 'ArrowLeft',
        'arrowright': 'ArrowRight',
      };
      return keyMap[k.toLowerCase()] ?? k;
    });

    this.logger.debug(`Pressing hotkey: ${keys.join('+')}`);

    if (keys.length === 1) {
      await page.keyboard.press(keys[0]);
    } else {
      for (const k of keys.slice(0, -1)) {
        await page.keyboard.down(k);
      }
      await page.keyboard.press(keys[keys.length - 1]);
      for (const k of keys.slice(0, -1).reverse()) {
        await page.keyboard.up(k);
      }
    }

    await sleep(200);
    return { success: true, message: `Pressed hotkey: ${keys.join('+')}` };
  }

  private async executeType(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const content = inputs?.content;
    if (!content) {
      return { success: false, message: 'No content specified for typing' };
    }

    const text = String(content).replace(/\\n/g, '\n');
    this.logger.debug(`Typing: ${text}`);
    await page.keyboard.type(text, { delay: 50 });

    if (String(content).endsWith('\\n') || String(content).endsWith('\n')) {
      await page.keyboard.press('Enter');
    }

    await sleep(200);
    return { success: true, message: `Typed: ${text}` };
  }

  private async executeScroll(page: Page, inputs?: Record<string, any>): Promise<ExecuteOutput> {
    const point = this.parsePoint(inputs?.point);
    const direction = inputs?.direction ?? 'down';

    if (!point) {
      return { success: false, message: 'Invalid scroll coordinates' };
    }

    const scrollAmount = 300;
    let deltaX = 0;
    let deltaY = 0;

    switch (direction.toLowerCase()) {
      case 'up':
        deltaY = -scrollAmount;
        break;
      case 'down':
        deltaY = scrollAmount;
        break;
      case 'left':
        deltaX = -scrollAmount;
        break;
      case 'right':
        deltaX = scrollAmount;
        break;
    }

    this.logger.debug(`Scrolling ${direction} at (${point.x}, ${point.y})`);
    await page.mouse.move(point.x, point.y);
    await page.evaluate(
      ({ deltaX, deltaY }) => {
        window.scrollBy(deltaX, deltaY);
      },
      { deltaX, deltaY }
    );
    await sleep(300);

    return { success: true, message: `Scrolled ${direction}` };
  }

  private async executeWait(): Promise<ExecuteOutput> {
    this.logger.debug('Waiting for 5 seconds');
    await sleep(5000);
    return { success: true, message: 'Waited for 5 seconds' };
  }

  parseAction(actionStr: string): { action_type: ActionType; action_inputs?: Record<string, any> } | null {
    const parsed = parseActionString(actionStr);
    if (!parsed) return null;

    return {
      action_type: parsed.action_type as ActionType,
      action_inputs: parsed.action_inputs,
    };
  }
}
