import { BrowserManager } from './browser/browser-manager';
import { BrowserGUIAgent, ACTION_SPACES } from './browser/browser-gui-agent';
import { NavigationTools, ContentTools, InteractionTools, AOMTools } from './browser/tools';
import { AgentConfig, Logger, BrowserState, ToolResult, ActionType, ExecuteOutput } from './types';
import { ConsoleLogger, sleep, parseActionString } from './utils';
import { DEFAULT_SYSTEM_PROMPT, generateBrowserRulesPrompt } from './prompts';

export interface AgentResult {
  success: boolean;
  message: string;
  data?: any;
  state?: BrowserState;
}

export interface StepResult {
  thought: string;
  action: string;
  result: ToolResult;
  screenshot?: string;
}

function executeOutputToToolResult(output: ExecuteOutput): ToolResult {
  return {
    status: output.success ? 'success' : 'error',
    message: output.message,
  };
}

export class BrowserAgent {
  private browserManager: BrowserManager;
  private guiAgent: BrowserGUIAgent;
  private navigationTools: NavigationTools;
  private contentTools: ContentTools;
  private interactionTools: InteractionTools;
  private aomTools: AOMTools;
  private logger: Logger;
  private config: AgentConfig;
  private state: BrowserState = {};
  private stepHistory: StepResult[] = [];

  constructor(config: AgentConfig = {}, logger?: Logger) {
    this.config = {
      browser: {
        headless: config.browser?.headless ?? false,
        control: config.browser?.control ?? 'hybrid',
        userDataDir: config.browser?.userDataDir,
      },
      maxTokens: config.maxTokens ?? 8192,
      language: config.language ?? 'zh',
    };

    this.logger = logger ?? new ConsoleLogger('BrowserAgent');

    this.browserManager = new BrowserManager(this.config.browser, this.logger.spawn('Browser'));
    this.guiAgent = new BrowserGUIAgent({
      browserManager: this.browserManager,
      logger: this.logger.spawn('GUIAgent'),
    });

    this.navigationTools = new NavigationTools(
      this.browserManager,
      this.logger.spawn('Navigation')
    );
    this.contentTools = new ContentTools(
      this.browserManager,
      this.logger.spawn('Content')
    );
    this.interactionTools = new InteractionTools(
      this.browserManager,
      this.logger.spawn('Interaction')
    );
    this.aomTools = new AOMTools(
      this.browserManager,
      this.logger.spawn('AOM')
    );
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Browser Agent...');
    await this.browserManager.launch();
    this.logger.success('Browser Agent initialized successfully');
  }

  async close(): Promise<void> {
    this.logger.info('Closing Browser Agent...');
    await this.browserManager.close();
    this.stepHistory = [];
    this.logger.success('Browser Agent closed');
  }

  getSystemPrompt(): string {
    const browserRules = generateBrowserRulesPrompt(this.config.browser?.control);
    return `${DEFAULT_SYSTEM_PROMPT}\n${browserRules}`;
  }

  getActionSpaces(): string[] {
    return ACTION_SPACES;
  }

  async getState(): Promise<BrowserState> {
    if (!this.browserManager.isLaunchingComplete()) {
      return {};
    }
    this.state = await this.browserManager.getState();
    return this.state;
  }

  async screenshot(): Promise<string | null> {
    if (!this.browserManager.isLaunchingComplete()) {
      return null;
    }
    const output = await this.browserManager.screenshot();
    return `data:image/jpeg;base64,${output.base64}`;
  }

  async executeAction(actionStr: string): Promise<ToolResult> {
    const parsed = parseActionString(actionStr);
    if (!parsed) {
      return { status: 'error', message: `Invalid action format: ${actionStr}` };
    }

    const { action_type, action_inputs } = parsed;
    this.logger.debug(`Executing action: ${action_type}`, action_inputs);

    try {
      switch (action_type) {
        case 'navigate':
          return await this.navigationTools.navigate(action_inputs?.url);

        case 'go_back':
          return await this.navigationTools.goBack();

        case 'go_forward':
          return await this.navigationTools.goForward();

        case 'refresh':
          return await this.navigationTools.refresh();

        case 'click':
        case 'left_double':
        case 'right_single':
        case 'drag':
        case 'hotkey':
        case 'type':
        case 'scroll':
        case 'wait':
        case 'finished':
        case 'call_user': {
          const output = await this.guiAgent.execute({
            parsedPrediction: {
              action_type: action_type as ActionType,
              action_inputs,
            },
          });
          return executeOutputToToolResult(output);
        }

        case 'dom_click':
          return await this.interactionTools.click(action_inputs?.selector);

        case 'dom_type':
          return await this.interactionTools.type(
            action_inputs?.selector,
            action_inputs?.text
          );

        case 'dom_hover':
          return await this.interactionTools.hover(action_inputs?.selector);

        case 'dom_select':
          return await this.interactionTools.select(
            action_inputs?.selector,
            action_inputs?.value
          );

        case 'get_markdown':
          return await this.contentTools.getMarkdown(action_inputs?.page);

        case 'get_url':
          return await this.contentTools.getUrl();

        case 'get_title':
          return await this.contentTools.getTitle();

        case 'screenshot':
          const screenshot = await this.screenshot();
          return {
            status: 'success',
            data: { screenshot },
          };

        case 'snapshot':
        case 'get_snapshot':
          return await this.aomTools.getSnapshot({
            interactiveOnly: action_inputs?.interactive_only ?? true,
            compact: action_inputs?.compact ?? true,
            maxDepth: action_inputs?.max_depth ?? 10,
          });

        case 'click_ref':
        case 'ref_click':
          return await this.aomTools.clickByRef(action_inputs?.ref);

        case 'fill_ref':
        case 'ref_fill':
          return await this.aomTools.fillByRef(
            action_inputs?.ref,
            action_inputs?.text
          );

        case 'get_text_ref':
          return await this.aomTools.getTextByRef(action_inputs?.ref);

        default:
          return { status: 'error', message: `Unknown action: ${action_type}` };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Action execution failed: ${errorMessage}`);
      return { status: 'error', message: errorMessage };
    }
  }

  async runStep(thought: string, action: string): Promise<StepResult> {
    this.logger.info(`Step ${this.stepHistory.length + 1}: ${action}`);

    const result = await this.executeAction(action);
    const screenshot = await this.screenshot();

    const stepResult: StepResult = {
      thought,
      action,
      result,
      screenshot: screenshot ?? undefined,
    };

    this.stepHistory.push(stepResult);

    await this.getState();

    return stepResult;
  }

  getStepHistory(): StepResult[] {
    return this.stepHistory;
  }

  clearHistory(): void {
    this.stepHistory = [];
  }

  isBrowserReady(): boolean {
    return this.browserManager.isLaunchingComplete() && this.browserManager.isBrowserAlive();
  }

  getBrowserManager(): BrowserManager {
    return this.browserManager;
  }

  getGUIAgent(): BrowserGUIAgent {
    return this.guiAgent;
  }
}
