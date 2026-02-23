import { BrowserAgent } from '../agent';
import { ConsoleLogger, sleep } from '../utils';

export interface TaskResult {
  success: boolean;
  message: string;
  data?: any;
  steps: Array<{
    thought: string;
    action: string;
    result: any;
  }>;
}

export async function runSearchTask(
  query: string,
  options: {
    headless?: boolean;
    searchEngine?: 'google' | 'bing' | 'baidu';
  } = {}
): Promise<TaskResult> {
  const { headless = false, searchEngine = 'google' } = options;
  const logger = new ConsoleLogger('SearchTask');

  const searchUrls: Record<string, string> = {
    google: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
    bing: `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
    baidu: `https://www.baidu.com/s?wd=${encodeURIComponent(query)}`,
  };

  const agent = new BrowserAgent({
    browser: { headless, control: 'hybrid' },
    language: 'zh',
  });

  const steps: TaskResult['steps'] = [];

  try {
    await agent.initialize();

    logger.info(`Searching for: ${query}`);
    const navResult = await agent.runStep(
      `Navigate to ${searchEngine} and search for "${query}"`,
      `navigate(url='${searchUrls[searchEngine]}')`
    );
    steps.push({
      thought: navResult.thought,
      action: navResult.action,
      result: navResult.result,
    });

    await sleep(2000);

    logger.info('Extracting search results...');
    const contentResult = await agent.runStep(
      'Extract the search results content',
      'get_markdown()'
    );
    steps.push({
      thought: contentResult.thought,
      action: contentResult.action,
      result: contentResult.result,
    });

    const content = contentResult.result.data?.content || '';

    return {
      success: true,
      message: `Successfully searched for "${query}"`,
      data: { query, searchEngine, content },
      steps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Search task failed: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
      steps,
    };
  } finally {
    await agent.close();
  }
}

export async function runFormFillTask(
  url: string,
  formData: Record<string, string>,
  options: { headless?: boolean } = {}
): Promise<TaskResult> {
  const { headless = false } = options;
  const logger = new ConsoleLogger('FormFillTask');

  const agent = new BrowserAgent({
    browser: { headless, control: 'hybrid' },
    language: 'zh',
  });

  const steps: TaskResult['steps'] = [];

  try {
    await agent.initialize();

    logger.info(`Navigating to form: ${url}`);
    const navResult = await agent.runStep(
      `Navigate to the form page`,
      `navigate(url='${url}')`
    );
    steps.push({
      thought: navResult.thought,
      action: navResult.action,
      result: navResult.result,
    });

    await sleep(1000);

    for (const [selector, value] of Object.entries(formData)) {
      logger.info(`Filling field: ${selector}`);
      const fillResult = await agent.runStep(
        `Fill the field "${selector}" with "${value}"`,
        `dom_type(selector='${selector}', text='${value}')`
      );
      steps.push({
        thought: fillResult.thought,
        action: fillResult.action,
        result: fillResult.result,
      });
      await sleep(300);
    }

    return {
      success: true,
      message: 'Successfully filled the form',
      data: { url, formData },
      steps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Form fill task failed: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
      steps,
    };
  } finally {
    await agent.close();
  }
}

export async function runScrapeTask(
  url: string,
  options: {
    headless?: boolean;
    waitFor?: string;
    scrollTimes?: number;
  } = {}
): Promise<TaskResult> {
  const { headless = false, waitFor, scrollTimes = 0 } = options;
  const logger = new ConsoleLogger('ScrapeTask');

  const agent = new BrowserAgent({
    browser: { headless, control: 'hybrid' },
    language: 'zh',
  });

  const steps: TaskResult['steps'] = [];

  try {
    await agent.initialize();

    logger.info(`Navigating to: ${url}`);
    const navResult = await agent.runStep(
      `Navigate to the target page`,
      `navigate(url='${url}')`
    );
    steps.push({
      thought: navResult.thought,
      action: navResult.action,
      result: navResult.result,
    });

    if (waitFor) {
      logger.info(`Waiting for selector: ${waitFor}`);
      await sleep(2000);
    }

    for (let i = 0; i < scrollTimes; i++) {
      logger.info(`Scrolling page (${i + 1}/${scrollTimes})`);
      const scrollResult = await agent.runStep(
        `Scroll down to load more content`,
        `scroll(point='<point>500 500</point>', direction='down')`
      );
      steps.push({
        thought: scrollResult.thought,
        action: scrollResult.action,
        result: scrollResult.result,
      });
      await sleep(1000);
    }

    logger.info('Extracting page content...');
    const contentResult = await agent.runStep(
      'Extract all page content',
      'get_markdown()'
    );
    steps.push({
      thought: contentResult.thought,
      action: contentResult.action,
      result: contentResult.result,
    });

    const content = contentResult.result.data?.content || '';
    const title = contentResult.result.data?.title || '';

    return {
      success: true,
      message: `Successfully scraped page: ${title}`,
      data: { url, title, content },
      steps,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Scrape task failed: ${errorMessage}`);
    return {
      success: false,
      message: errorMessage,
      steps,
    };
  } finally {
    await agent.close();
  }
}
