/**
 * Task Status Window Integration Example
 * 
 * This file demonstrates how to integrate the task status window
 * into your browser agent workflows.
 */

// Example 1: Simple status update from background script
async function updateTaskStatusInTab(tabId, task, action, status) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: 'updateTaskStatus',
      task: task,
      action: action,
      status: status
    });
    console.log('Task status updated:', { task, action, status });
  } catch (error) {
    console.error('Failed to update task status:', error);
  }
}

// Example 2: Workflow with status updates
async function performSearchWorkflow(tabId, searchQuery) {
  try {
    // Step 1: Initialize
    await updateTaskStatusInTab(
      tabId,
      'Search Task',
      'Initializing search',
      'Starting'
    );
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Step 2: Take snapshot
    await updateTaskStatusInTab(
      tabId,
      'Search Task',
      'Analyzing page structure',
      'In progress'
    );
    
    const snapshot = await chrome.tabs.sendMessage(tabId, {
      action: 'snapshot',
      options: { interactiveOnly: true }
    });
    
    // Step 3: Fill search
    await updateTaskStatusInTab(
      tabId,
      'Search Task',
      `Searching for: ${searchQuery}`,
      'In progress'
    );
    
    const result = await chrome.tabs.sendMessage(tabId, {
      action: 'search',
      text: searchQuery
    });
    
    // Step 4: Complete
    if (result.success) {
      await updateTaskStatusInTab(
        tabId,
        'Search Task',
        'Search submitted successfully',
        'Complete'
      );
    } else {
      await updateTaskStatusInTab(
        tabId,
        'Search Task',
        'Search failed',
        'Error: ' + result.error
      );
    }
    
    return result;
  } catch (error) {
    await updateTaskStatusInTab(
      tabId,
      'Search Task',
      'Unexpected error',
      'Error: ' + error.message
    );
    throw error;
  }
}

// Example 3: Click workflow with status updates
async function performClickWorkflow(tabId, elementRef, elementName) {
  try {
    await updateTaskStatusInTab(
      tabId,
      'Click Task',
      `Clicking: ${elementName}`,
      'In progress'
    );
    
    const result = await chrome.tabs.sendMessage(tabId, {
      action: 'click',
      ref: elementRef
    });
    
    if (result.success) {
      await updateTaskStatusInTab(
        tabId,
        'Click Task',
        `Clicked: ${elementName}`,
        'Complete'
      );
    } else {
      await updateTaskStatusInTab(
        tabId,
        'Click Task',
        `Failed to click: ${elementName}`,
        'Error: ' + result.error
      );
    }
    
    return result;
  } catch (error) {
    await updateTaskStatusInTab(
      tabId,
      'Click Task',
      'Unexpected error',
      'Error: ' + error.message
    );
    throw error;
  }
}

// Example 4: Multi-step task with detailed status
async function performComplexTask(tabId) {
  const steps = [
    { task: 'Complex Task', action: 'Step 1: Taking snapshot', status: 'In progress' },
    { task: 'Complex Task', action: 'Step 2: Finding elements', status: 'In progress' },
    { task: 'Complex Task', action: 'Step 3: Interacting', status: 'In progress' },
    { task: 'Complex Task', action: 'Step 4: Verifying results', status: 'In progress' },
    { task: 'Complex Task', action: 'All steps completed', status: 'Complete' }
  ];
  
  for (let i = 0; i < steps.length; i++) {
    await updateTaskStatusInTab(
      tabId,
      steps[i].task,
      steps[i].action,
      steps[i].status
    );
    
    // Simulate work
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

// Example 5: Error handling with status updates
async function safeExecuteWithStatus(tabId, taskName, actionFn) {
  try {
    await updateTaskStatusInTab(tabId, taskName, 'Starting', 'In progress');
    
    const result = await actionFn();
    
    await updateTaskStatusInTab(
      tabId,
      taskName,
      'Completed successfully',
      'Complete'
    );
    
    return result;
  } catch (error) {
    await updateTaskStatusInTab(
      tabId,
      taskName,
      'Failed: ' + error.message,
      'Error'
    );
    throw error;
  }
}

// Example 6: Status update helper class
class TaskStatusManager {
  constructor(tabId) {
    this.tabId = tabId;
    this.currentTask = null;
  }
  
  async start(taskName, action = 'Starting') {
    this.currentTask = taskName;
    await updateTaskStatusInTab(this.tabId, taskName, action, 'Starting');
  }
  
  async update(action, status = 'In progress') {
    if (!this.currentTask) {
      throw new Error('No task started');
    }
    await updateTaskStatusInTab(this.tabId, this.currentTask, action, status);
  }
  
  async complete(action = 'Completed') {
    if (!this.currentTask) {
      throw new Error('No task started');
    }
    await updateTaskStatusInTab(this.tabId, this.currentTask, action, 'Complete');
    this.currentTask = null;
  }
  
  async error(action, errorMessage) {
    if (!this.currentTask) {
      throw new Error('No task started');
    }
    await updateTaskStatusInTab(
      this.tabId,
      this.currentTask,
      action,
      'Error: ' + errorMessage
    );
    this.currentTask = null;
  }
}

// Example usage of TaskStatusManager
async function exampleWithManager(tabId) {
  const statusManager = new TaskStatusManager(tabId);
  
  try {
    await statusManager.start('Video Search', 'Initializing');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await statusManager.update('Finding search input');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await statusManager.update('Filling search query');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    await statusManager.complete('Search submitted');
  } catch (error) {
    await statusManager.error('Search failed', error.message);
  }
}

// Export functions for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    updateTaskStatusInTab,
    performSearchWorkflow,
    performClickWorkflow,
    performComplexTask,
    safeExecuteWithStatus,
    TaskStatusManager
  };
}
