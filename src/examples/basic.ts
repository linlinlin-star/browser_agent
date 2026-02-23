import { BrowserAgent } from '../agent';
import { ConsoleLogger } from '../utils';

async function main() {
  const logger = new ConsoleLogger('Example');
  const agent = new BrowserAgent({
    browser: {
      headless: false,
      control: 'hybrid',
    },
    language: 'zh',
  });

  try {
    logger.info('Initializing browser agent...');
    await agent.initialize();

    logger.info('Navigating to example.com...');
    await agent.runStep(
      'Navigate to example.com to demonstrate the browser agent',
      "navigate(url='https://example.com')"
    );

    await new Promise(resolve => setTimeout(resolve, 1000));

    logger.info('Getting page content...');
    const contentResult = await agent.runStep(
      'Extract the page content',
      'get_markdown()'
    );

    logger.info('Page content extracted:');
    console.log(contentResult.result.data?.content?.slice(0, 500));

    logger.info('Getting page URL...');
    const urlResult = await agent.runStep(
      'Get the current page URL',
      'get_url()'
    );
    logger.info(`Current URL: ${urlResult.result.data?.url}`);

    logger.info('Taking screenshot...');
    const screenshotResult = await agent.runStep(
      'Take a screenshot of the page',
      'screenshot()'
    );
    logger.info('Screenshot taken successfully');

    logger.info('Task completed successfully!');
    await agent.runStep(
      'Task completed',
      "finished(content='Successfully navigated to example.com and extracted content')"
    );

  } catch (error) {
    logger.error('Error during execution:', error);
  } finally {
    logger.info('Closing browser...');
    await agent.close();
  }
}

main().catch(console.error);
