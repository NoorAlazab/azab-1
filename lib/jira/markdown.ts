import type { TestCase, TestStep } from "@/lib/generator/types";

/**
 * Map priority codes to human-readable names
 */
const mapPriorityToLabel = (priority: string): string => {
  const mapping: Record<string, string> = {
    'P0': 'Critical',
    'P1': 'High', 
    'P2': 'Medium',
    'P3': 'Low'
  };
  return mapping[priority] || priority;
};

/**
 * Format a single test case as markdown
 */
export function formatTestCaseMarkdown(testCase: TestCase): string {
  const sections: string[] = [];
  
  // Title and metadata
  sections.push(`# ${testCase.title}`);
  sections.push(`**Type:** ${testCase.type}`);
  sections.push(`**Priority:** ${mapPriorityToLabel(testCase.priority)}`);
  
  if (testCase.tags && testCase.tags.length > 0) {
    sections.push(`**Tags:** ${testCase.tags.join(", ")}`);
  }
  
  // Preconditions
  if (testCase.preconditions && testCase.preconditions.length > 0) {
    sections.push(`\n## Preconditions`);
    testCase.preconditions.forEach((condition, index) => {
      sections.push(`${index + 1}. ${condition}`);
    });
  }
  
  // Test steps
  if (testCase.steps && testCase.steps.length > 0) {
    sections.push(`\n## Test Steps`);
    testCase.steps.forEach((step, index) => {
      let stepText = `${index + 1}. ${step.action}`;
      if (step.data) {
        stepText += `\n   - Data: ${step.data}`;
      }
      sections.push(stepText);
    });
  }
  
  // Expected result
  sections.push(`\n## Expected Result`);
  sections.push(testCase.expected);
  
  return sections.join("\n");
}

/**
 * Format multiple test cases as a markdown test suite
 */
export function formatTestSuiteMarkdown(testCases: TestCase[]): string {
  const sections: string[] = [];
  
  // Header
  sections.push("# Test Cases");
  sections.push(`Generated ${new Date().toLocaleString()} by QA CaseForge\n`);
  
  // Summary
  const typeCount = testCases.reduce((acc, tc) => {
    acc[tc.type] = (acc[tc.type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  sections.push("## Summary");
  sections.push(`Total test cases: ${testCases.length}`);
  Object.entries(typeCount).forEach(([type, count]) => {
    sections.push(`- ${type}: ${count}`);
  });
  sections.push("");
  
  // Test cases by priority
  const priorityGroups = groupBy(testCases, "priority");
  const priorities = ["P0", "P1", "P2", "P3"] as const;
  
  priorities.forEach(priority => {
    const cases = priorityGroups[priority];
    if (!cases || cases.length === 0) return;
    
    const priorityLabel = mapPriorityToLabel(priority);
    sections.push(`## ${priorityLabel} Priority Tests`);
    cases.forEach((testCase, index) => {
      sections.push(`### ${priorityLabel}.${index + 1} ${testCase.title}`);
      sections.push("");
      
      // Metadata
      sections.push(`**Type:** ${testCase.type}`);
      if (testCase.tags && testCase.tags.length > 0) {
        sections.push(`**Tags:** ${testCase.tags.join(", ")}`);
      }
      sections.push("");
      
      // Preconditions
      if (testCase.preconditions && testCase.preconditions.length > 0) {
        sections.push("**Preconditions:**");
        testCase.preconditions.forEach((condition, i) => {
          sections.push(`${i + 1}. ${condition}`);
        });
        sections.push("");
      }
      
      // Steps
      if (testCase.steps && testCase.steps.length > 0) {
        sections.push("**Test Steps:**");
        testCase.steps.forEach((step, i) => {
          let stepText = `${i + 1}. ${step.action}`;
          if (step.data) {
            stepText += ` (Data: ${step.data})`;
          }
          sections.push(stepText);
        });
        sections.push("");
      }
      
      // Expected result
      sections.push("**Expected Result:**");
      sections.push(testCase.expected);
      sections.push("\n---\n");
    });
  });
  
  return sections.join("\n");
}

/**
 * Format test steps as a numbered list
 */
export function formatTestSteps(steps: TestStep[]): string {
  return steps
    .map((step, index) => {
      let text = `${index + 1}. ${step.action}`;
      if (step.data) {
        text += `\n   Data: ${step.data}`;
      }
      return text;
    })
    .join("\n");
}

/**
 * Generate a compact summary for dashboard/notifications
 */
export function formatTestSummary(testCases: TestCase[]): string {
  const total = testCases.length;
  const types = Array.from(new Set(testCases.map(tc => tc.type)));
  const priorities = Array.from(new Set(testCases.map(tc => tc.priority)))
    .map(priority => mapPriorityToLabel(priority));
  
  return `${total} test cases (${types.join(", ")}) across ${priorities.join(", ")} priorities`;
}

/**
 * Utility function to group array by key
 */
function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const value = String(item[key]);
    groups[value] = groups[value] || [];
    groups[value].push(item);
    return groups;
  }, {} as Record<string, T[]>);
}