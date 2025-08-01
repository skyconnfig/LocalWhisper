const Sequencer = require('@jest/test-sequencer').default;

class CustomSequencer extends Sequencer {
  sort(tests) {
    // Define test order priority
    const priority = {
      'services': 1,    // Test services first
      'api': 2,         // Then API endpoints
      'e2e': 3,         // Then end-to-end tests
      'performance': 4, // Then performance tests
      'error': 5        // Finally error handling tests
    };

    return Array.from(tests).sort((testA, testB) => {
      const priorityA = this.getTestPriority(testA.path, priority);
      const priorityB = this.getTestPriority(testB.path, priority);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      // If same priority, sort alphabetically
      return testA.path.localeCompare(testB.path);
    });
  }

  getTestPriority(testPath, priority) {
    for (const [key, value] of Object.entries(priority)) {
      if (testPath.includes(key)) {
        return value;
      }
    }
    return 999; // Default priority for unknown tests
  }
}

module.exports = CustomSequencer;