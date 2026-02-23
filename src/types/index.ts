export type BrowserControlMode = 'dom' | 'visual-grounding' | 'hybrid';

export interface BrowserOptions {
  headless?: boolean;
  control?: BrowserControlMode;
  cdpEndpoint?: string;
  userDataDir?: string;
}

export interface ActionInput {
  action_type: ActionType;
  action_inputs?: Record<string, string | number>;
}

export type ActionType =
  | 'click'
  | 'left_double'
  | 'right_single'
  | 'drag'
  | 'hotkey'
  | 'type'
  | 'scroll'
  | 'wait'
  | 'finished'
  | 'call_user';

export interface ParsedAction {
  action_type: ActionType;
  action_inputs?: Record<string, any>;
}

export interface ScreenshotOutput {
  base64: string;
  scaleFactor: number;
  width?: number;
  height?: number;
}

export interface ExecuteParams {
  parsedPrediction: ActionInput;
}

export interface ExecuteOutput {
  success: boolean;
  status?: 'success' | 'error';
  message?: string;
}

export interface BrowserState {
  currentUrl?: string;
  currentScreenshot?: string;
  title?: string;
}

export interface ContentExtractionResult {
  content: string;
  title: string;
  pagination?: {
    currentPage: number;
    totalPages: number;
    hasMorePages: boolean;
  };
}

export interface ToolResult {
  status: 'success' | 'error';
  message?: string;
  data?: any;
}

export interface AgentConfig {
  browser?: BrowserOptions;
  maxTokens?: number;
  language?: 'zh' | 'en';
}

export interface Logger {
  info(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  debug(message: string, ...args: any[]): void;
  success(message: string, ...args: any[]): void;
  spawn(prefix: string): Logger;
}

export type Coordinate = { x: number; y: number };
export type BoundingBox = [number, number, number, number];

export interface AOMElement {
  ref: string;
  role: string;
  name: string;
  tagName: string;
  children?: AOMElement[];
  level?: number;
  nth?: number;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
}

export interface AOMSnapshot {
  tree: string;
  refs: RefMap;
  elementCount: number;
}

export type RefMap = Record<string, { selector: string; role: string; name: string }>;
