/**
 * ProgressTracker - Tracks sub-goal completion and detects stuck states
 * 
 * This component monitors progress through sub-goals during task execution,
 * detects when the agent is stuck, and provides context for LLM messages.
 * 
 * Requirements: 2.1
 */
class ProgressTracker {
  /**
   * Creates a new ProgressTracker
   * @param {Array} subGoals - Array of sub-goal objects from TaskPlanner
   */
  constructor(subGoals) {
    this.subGoals = subGoals;
    this.currentSubGoalIndex = 0;
    this.subGoalStepCounts = new Array(subGoals.length).fill(0);
    this.stuckThreshold = 8;
  }
  
  /**
   * Gets current active sub-goal
   * @returns {Object|null} Current sub-goal object, or null if all complete
   */
  getCurrentSubGoal() {
    if (this.currentSubGoalIndex >= this.subGoals.length) {
      return null;
    }
    return this.subGoals[this.currentSubGoalIndex];
  }
  
  /**
   * Records a step taken on current sub-goal
   * Increments the step counter for the current sub-goal
   */
  recordStep() {
    try {
      if (this.currentSubGoalIndex >= this.subGoals.length) {
        console.warn('[ProgressTracker] Cannot record step: all sub-goals complete');
        return;
      }
      this.subGoalStepCounts[this.currentSubGoalIndex]++;
    } catch (error) {
      console.error('[ProgressTracker] Error recording step:', error);
    }
  }
  
  /**
   * Checks if current sub-goal is stuck
   * @returns {boolean} True if steps exceed stuck threshold
   */
  isStuck() {
    return this.subGoalStepCounts[this.currentSubGoalIndex] > this.stuckThreshold;
  }
  
  /**
   * Marks current sub-goal as complete and advances to next
   * @param {Object} result - Completion result data
   */
  completeCurrentSubGoal(result) {
    try {
      const subGoal = this.getCurrentSubGoal();
      if (!subGoal) {
        console.warn('[ProgressTracker] Cannot complete: no current sub-goal');
        return;
      }
      subGoal.completed = true;
      subGoal.completedAt = Date.now();
      subGoal.result = result;
      this.currentSubGoalIndex++;
    } catch (error) {
      console.error('[ProgressTracker] Error completing sub-goal:', error);
      // Graceful degradation: still increment index
      this.currentSubGoalIndex++;
    }
  }
  
  /**
   * Skips current sub-goal (when stuck or unable to complete)
   * @param {string} reason - Reason for skipping
   */
  skipCurrentSubGoal(reason) {
    try {
      const subGoal = this.getCurrentSubGoal();
      if (!subGoal) {
        console.warn('[ProgressTracker] Cannot skip: no current sub-goal');
        return;
      }
      subGoal.skipped = true;
      subGoal.skipReason = reason;
      this.currentSubGoalIndex++;
    } catch (error) {
      console.error('[ProgressTracker] Error skipping sub-goal:', error);
      // Graceful degradation: still increment index
      this.currentSubGoalIndex++;
    }
  }
  
  /**
   * Checks if all sub-goals are complete
   * @returns {boolean} True if all sub-goals processed
   */
  isComplete() {
    return this.currentSubGoalIndex >= this.subGoals.length;
  }
  
  /**
   * Gets progress percentage
   * @returns {number} Progress from 0-100
   */
  getProgress() {
    return Math.round((this.currentSubGoalIndex / this.subGoals.length) * 100);
  }
  
  /**
   * Gets context string for LLM messages
   * Includes current sub-goal info, progress, and completion criteria
   * @returns {string} Formatted progress context
   */
  getContext() {
    if (this.isComplete()) {
      return `All sub-goals complete (100%)`;
    }
    
    const current = this.getCurrentSubGoal();
    const progress = this.getProgress();
    const stepsOnCurrent = this.subGoalStepCounts[this.currentSubGoalIndex];
    
    return `Sub-Goal ${this.currentSubGoalIndex + 1}/${this.subGoals.length} (${progress}%): ${current.description}
Steps on current sub-goal: ${stepsOnCurrent}
Completion criteria: ${current.completionCriteria}`;
  }
  
  /**
   * Gets completion data for a sub-goal
   * @param {Object} subGoal - The sub-goal to get completion data for
   * @returns {Object|null} Completion data with steps taken, time, and summary
   */
  getCompletionData(subGoal) {
    if (!subGoal) return null;
    
    const subGoalIndex = this.subGoals.indexOf(subGoal);
    if (subGoalIndex === -1 || !subGoal.completed) {
      return null;
    }
    
    return {
      stepsTaken: this.subGoalStepCounts[subGoalIndex] || 0,
      completionTime: subGoal.completedAt || Date.now(),
      summary: `Completed: ${subGoal.description}`,
      result: subGoal.result || {}
    };
  }
  
  /**
   * Gets final summary of all sub-goals
   * @returns {Object} Summary with totals and sub-goal details
   */
  getSummary() {
    return {
      total: this.subGoals.length,
      completed: this.subGoals.filter(sg => sg.completed).length,
      skipped: this.subGoals.filter(sg => sg.skipped).length,
      subGoals: this.subGoals
    };
  }
  /**
   * Gets completion data for a sub-goal
   * @param {Object} subGoal - The sub-goal to get completion data for
   * @returns {Object|null} Completion data with steps taken, time, and summary
   */
  getCompletionData(subGoal) {
    if (!subGoal) return null;

    const subGoalIndex = this.subGoals.indexOf(subGoal);
    if (subGoalIndex === -1 || !subGoal.completed) {
      return null;
    }

    return {
      stepsTaken: this.subGoalStepCounts[subGoalIndex] || 0,
      completionTime: subGoal.completedAt || Date.now(),
      summary: `Completed: ${subGoal.description}`,
      result: subGoal.result || {}
    };
  }

}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProgressTracker;
}
