import { Page, Locator } from 'playwright';
import { BrowserManager } from '../browser-manager';
import { ToolResult, Logger, AOMSnapshot, AOMElement, RefMap } from '../../types';
import { ConsoleLogger } from '../../utils';

export class AOMTools {
  private logger: Logger;
  private refCounter: number = 0;
  private refMap: RefMap = {};

  constructor(private browserManager: BrowserManager, logger?: Logger) {
    this.logger = logger ?? new ConsoleLogger('AOMTools');
  }

  private resetRefs(): void {
    this.refCounter = 0;
    this.refMap = {};
  }

  private generateRef(): string {
    this.refCounter++;
    return `e${this.refCounter}`;
  }

  async getSnapshot(options: {
    interactiveOnly?: boolean;
    compact?: boolean;
    maxDepth?: number;
    selector?: string;
  } = {}): Promise<ToolResult> {
    try {
      if (!this.browserManager.isLaunchingComplete()) {
        return { status: 'error', message: 'Browser not initialized' };
      }

      const page = this.browserManager.getPage();
      this.resetRefs();

      const snapshot = await this.buildAOMTree(page, options);

      return {
        status: 'success',
        data: {
          tree: snapshot.tree,
          refs: this.refMap,
          elementCount: this.refCounter,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error getting AOM snapshot: ${errorMessage}`);
      return { status: 'error', message: `Failed to get snapshot: ${errorMessage}` };
    }
  }

  private async buildAOMTree(
    page: Page,
    options: {
      interactiveOnly?: boolean;
      compact?: boolean;
      maxDepth?: number;
      selector?: string;
    }
  ): Promise<{ tree: string }> {
    const interactiveRoles = [
      'button',
      'link',
      'textbox',
      'checkbox',
      'radio',
      'combobox',
      'searchbox',
      'slider',
      'spinbutton',
      'switch',
      'tab',
      'menuitem',
      'menuitemcheckbox',
      'menuitemradio',
      'option',
    ];

    const result = await page.evaluate(
      ({ interactiveOnly, compact, maxDepth, selector, interactiveRoles }) => {
        const refs: Record<string, { selector: string; role: string; name: string }> = {};
        let refCounter = 0;

        const generateRef = (): string => {
          refCounter++;
          return `e${refCounter}`;
        };

        const getSelector = (el: Element): string => {
          if (el.id) return `#${el.id}`;

          const role = el.getAttribute('role') || el.tagName.toLowerCase();
          const name = el.getAttribute('aria-label') || el.getAttribute('name') || el.getAttribute('placeholder');

          if (name) {
            return `[aria-label="${name}"], [name="${name}"], [placeholder="${name}"]`;
          }

          const testId = el.getAttribute('data-testid');
          if (testId) return `[data-testid="${testId}"]`;

          return el.tagName.toLowerCase();
        };

        const getAccessibleName = (el: Element): string => {
          const ariaLabel = el.getAttribute('aria-label');
          if (ariaLabel) return ariaLabel;

          const label = el.getAttribute('aria-labelledby');
          if (label) {
            const labelEl = document.getElementById(label);
            if (labelEl) return labelEl.textContent?.trim() || '';
          }

          const name = el.getAttribute('name');
          if (name) return name;

          const placeholder = el.getAttribute('placeholder');
          if (placeholder) return placeholder;

          const title = el.getAttribute('title');
          if (title) return title;

          const textContent = el.textContent?.trim();
          if (textContent && textContent.length < 100) return textContent;

          return '';
        };

        const getRole = (el: Element): string => {
          const explicitRole = el.getAttribute('role');
          if (explicitRole) return explicitRole;

          const tagName = el.tagName.toLowerCase();

          const roleMap: Record<string, string> = {
            a: 'link',
            button: 'button',
            input: 'textbox',
            textarea: 'textbox',
            select: 'combobox',
            img: 'img',
            h1: 'heading',
            h2: 'heading',
            h3: 'heading',
            h4: 'heading',
            h5: 'heading',
            h6: 'heading',
            nav: 'navigation',
            main: 'main',
            header: 'banner',
            footer: 'contentinfo',
            form: 'form',
            table: 'table',
            ul: 'list',
            ol: 'list',
            li: 'listitem',
            dialog: 'dialog',
            menu: 'menu',
          };

          if (roleMap[tagName]) {
            if (tagName === 'input') {
              const type = (el as HTMLInputElement).type;
              if (type === 'checkbox') return 'checkbox';
              if (type === 'radio') return 'radio';
              if (type === 'submit' || type === 'button') return 'button';
              if (type === 'search') return 'searchbox';
              if (type === 'range') return 'slider';
            }
            return roleMap[tagName];
          }

          return 'generic';
        };

        const isInteractive = (role: string): boolean => {
          return interactiveRoles.includes(role);
        };

        const isHidden = (el: Element): boolean => {
          const style = window.getComputedStyle(el);
          return style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0';
        };

        interface TreeNode {
          ref: string;
          role: string;
          name: string;
          tagName: string;
          children: TreeNode[];
          level?: number;
          nth?: number;
          value?: string;
          checked?: boolean;
          disabled?: boolean;
        }

        const processElement = (
          el: Element,
          depth: number = 0,
          siblingCounts: Map<string, number> = new Map()
        ): TreeNode | null => {
          if (maxDepth && depth > maxDepth) return null;
          if (isHidden(el)) return null;

          const role = getRole(el);
          const name = getAccessibleName(el);

          if (interactiveOnly && !isInteractive(role)) {
            const children: TreeNode[] = [];
            for (const child of Array.from(el.children)) {
              const childNode = processElement(child, depth + 1, siblingCounts);
              if (childNode) children.push(childNode);
            }
            if (children.length === 0) return null;
            if (children.length === 1) return children[0];
            return { ref: '', role: 'group', name: '', tagName: 'group', children };
          }

          const ref = generateRef();
          const selector = getSelector(el);

          const key = `${role}:${name}`;
          const count = siblingCounts.get(key) || 0;
          siblingCounts.set(key, count + 1);

          refs[ref] = {
            selector,
            role,
            name,
          };

          const node: TreeNode = {
            ref,
            role,
            name,
            tagName: el.tagName.toLowerCase(),
            children: [],
          };

          if (role === 'heading') {
            const match = el.tagName.match(/H(\d)/i);
            if (match) node.level = parseInt(match[1]);
          }

          if (count > 0) {
            node.nth = count;
          }

          if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
            node.value = (el as HTMLInputElement).value;
          }

          if (role === 'checkbox' || role === 'radio' || role === 'switch') {
            node.checked = (el as HTMLInputElement).checked;
          }

          if (el.getAttribute('disabled') !== null) {
            node.disabled = true;
          }

          const childSiblingCounts = new Map<string, number>();
          for (const child of Array.from(el.children)) {
            const childNode = processElement(child, depth + 1, childSiblingCounts);
            if (childNode) node.children.push(childNode);
          }

          return node;
        };

        const root = selector ? document.querySelector(selector) : document.body;
        if (!root) return { tree: '', refs: {} };

        const tree = processElement(root);

        return { tree, refs, refCounter };
      },
      {
        interactiveOnly: options.interactiveOnly ?? false,
        compact: options.compact ?? false,
        maxDepth: options.maxDepth ?? 10,
        selector: options.selector,
        interactiveRoles,
      }
    );

    this.refMap = result.refs;
    this.refCounter = result.refCounter ?? 0;

    const treeString = this.formatTree(result.tree, options.compact);

    return { tree: treeString };
  }

  private formatTree(node: any, compact: boolean = false, indent: string = ''): string {
    if (!node) return '';

    const lines: string[] = [];
    const parts: string[] = [];

    parts.push(`- ${node.role}`);

    if (node.name) {
      parts.push(`"${node.name}"`);
    }

    parts.push(`[ref=${node.ref}]`);

    if (node.level) {
      parts.push(`[level=${node.level}]`);
    }

    if (node.nth !== undefined) {
      parts.push(`[nth=${node.nth}]`);
    }

    if (node.value !== undefined && node.value !== '') {
      parts.push(`[value="${node.value}"]`);
    }

    if (node.checked !== undefined) {
      parts.push(`[checked=${node.checked}]`);
    }

    if (node.disabled) {
      parts.push(`[disabled]`);
    }

    lines.push(indent + parts.join(' '));

    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        lines.push(this.formatTree(child, compact, indent + '  '));
      }
    }

    return lines.filter(Boolean).join('\n');
  }

  getRefSelector(ref: string): string | undefined {
    return this.refMap[ref]?.selector;
  }

  getRefInfo(ref: string): { selector: string; role: string; name: string } | undefined {
    return this.refMap[ref];
  }

  async clickByRef(ref: string): Promise<ToolResult> {
    try {
      const info = this.getRefInfo(ref);
      if (!info) {
        return {
          status: 'error',
          message: `Ref "${ref}" not found. Run snapshot to get current refs.`,
        };
      }

      const page = this.browserManager.getPage();
      await page.click(info.selector);

      return {
        status: 'success',
        message: `Clicked element @${ref} (${info.role}: "${info.name}")`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.toAIFriendlyError(errorMessage, ref);
    }
  }

  async fillByRef(ref: string, text: string): Promise<ToolResult> {
    try {
      const info = this.getRefInfo(ref);
      if (!info) {
        return {
          status: 'error',
          message: `Ref "${ref}" not found. Run snapshot to get current refs.`,
        };
      }

      const page = this.browserManager.getPage();
      await page.fill(info.selector, text);

      return {
        status: 'success',
        message: `Filled element @${ref} with "${text}"`,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.toAIFriendlyError(errorMessage, ref);
    }
  }

  async getTextByRef(ref: string): Promise<ToolResult> {
    try {
      const info = this.getRefInfo(ref);
      if (!info) {
        return {
          status: 'error',
          message: `Ref "${ref}" not found. Run snapshot to get current refs.`,
        };
      }

      const page = this.browserManager.getPage();
      const text = await page.textContent(info.selector);

      return {
        status: 'success',
        data: { text, ref, role: info.role, name: info.name },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return this.toAIFriendlyError(errorMessage, ref);
    }
  }

  private toAIFriendlyError(errorMessage: string, ref: string): ToolResult {
    if (errorMessage.includes('strict mode violation')) {
      return {
        status: 'error',
        message: `Multiple elements match ref "${ref}". Run 'snapshot' to get updated refs with nth indices.`,
      };
    }

    if (errorMessage.includes('intercepts pointer events')) {
      return {
        status: 'error',
        message: `Element @${ref} is blocked by another element. Try dismissing modals or cookie banners first.`,
      };
    }

    if (errorMessage.includes('waiting for') && errorMessage.includes('Timeout')) {
      return {
        status: 'error',
        message: `Element @${ref} not found or not visible. Run 'snapshot' to see current elements.`,
      };
    }

    return {
      status: 'error',
      message: `Error with ref @${ref}: ${errorMessage}`,
    };
  }
}
