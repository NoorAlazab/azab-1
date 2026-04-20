/**
 * Step Enhancer
 * Automatically enhances test steps by injecting backtick notation for element keys
 * This provides a safety net when AI forgets to use backticks
 */

import { loadSelectorMapping } from './selectorRepository';
import { mapToElementKey } from './elementKeyMapper';
import { parseStep } from './stepParser';
import { log } from '@/lib/shared/utils/logger';

/**
 * Enhance test steps with element keys from selector repository
 * Auto-injects backticks if AI forgets them and we have high-confidence match
 */
export async function enhanceStepsWithElementKeys(
  steps: string[],
  pageName: string,
  environmentSlug?: string
): Promise<string[]> {
  const mapping = await loadSelectorMapping(pageName, environmentSlug);
  if (!mapping) {
    log.debug('No selector mapping found for enhancement', {
      module: 'StepEnhancer',
      pageName,
      environmentSlug,
    });
    return steps;
  }

  const enhancedSteps: string[] = [];
  let enhancementCount = 0;

  for (const step of steps) {
    // Already has backticks? Skip enhancement
    if (step.includes('`')) {
      enhancedSteps.push(step);
      continue;
    }

    // Parse step to get action type and target
    const action = parseStep(step);

    // Only enhance steps that have element targets (click, fill, verify_element)
    if (action.type === 'unknown' || action.type === 'navigate' || action.type === 'wait') {
      enhancedSteps.push(step);
      continue;
    }

    // For verify_text, don't enhance (it's checking text content, not elements)
    if (action.type === 'verify_text') {
      enhancedSteps.push(step);
      continue;
    }

    // Try to map target to element key
    let enhancedStep = step;

    if (action.type === 'click' && action.target) {
      const elementKey = await mapToElementKey(action.target, pageName, environmentSlug);
      if (elementKey) {
        // High confidence - inject backticks
        enhancedStep = enhanceClickStep(step, action.target, elementKey);
        if (enhancedStep !== step) {
          enhancementCount++;
          log.debug('Enhanced click step', {
            module: 'StepEnhancer',
            original: step,
            enhanced: enhancedStep,
            elementKey,
          });
        }
      }
    } else if (action.type === 'fill' && action.target) {
      const elementKey = await mapToElementKey(action.target, pageName, environmentSlug);
      if (elementKey) {
        enhancedStep = enhanceFillStep(step, action.target, elementKey);
        if (enhancedStep !== step) {
          enhancementCount++;
          log.debug('Enhanced fill step', {
            module: 'StepEnhancer',
            original: step,
            enhanced: enhancedStep,
            elementKey,
          });
        }
      }
    } else if (action.type === 'verify_element' && action.target) {
      const elementKey = await mapToElementKey(action.target, pageName, environmentSlug);
      if (elementKey) {
        enhancedStep = enhanceVerifyElementStep(step, action.target, elementKey);
        if (enhancedStep !== step) {
          enhancementCount++;
          log.debug('Enhanced verify step', {
            module: 'StepEnhancer',
            original: step,
            enhanced: enhancedStep,
            elementKey,
          });
        }
      }
    }

    enhancedSteps.push(enhancedStep);
  }

  if (enhancementCount > 0) {
    log.info('Step enhancement complete', {
      module: 'StepEnhancer',
      pageName,
      totalSteps: steps.length,
      enhancedCount: enhancementCount,
    });
  }

  return enhancedSteps;
}

/**
 * Enhance a click step by injecting backtick notation
 * Example: "Click the submit button" -> "Click `buttonSubmit`"
 */
function enhanceClickStep(step: string, target: string, elementKey: string): string {
  // Pattern: "Click 'Text'" or "Click the button" or "Click on element"
  const patterns = [
    new RegExp(`Click\\s+'${escapeRegex(target)}'`, 'i'),
    new RegExp(`Click\\s+the\\s+${escapeRegex(target)}`, 'i'),
    new RegExp(`Click\\s+on\\s+${escapeRegex(target)}`, 'i'),
    new RegExp(`Click\\s+on\\s+the\\s+${escapeRegex(target)}`, 'i'),
    new RegExp(`Click\\s+${escapeRegex(target)}`, 'i'),
  ];

  for (const pattern of patterns) {
    if (pattern.test(step)) {
      return step.replace(pattern, `Click \`${elementKey}\``);
    }
  }

  return step;
}

/**
 * Enhance a fill step by injecting backtick notation
 * Example: "Enter 'value' in the email field" -> "Enter 'value' in `inputEmail`"
 */
function enhanceFillStep(step: string, target: string, elementKey: string): string {
  // Pattern: "Enter 'value' in target" or "Type 'value' into target"
  const patterns = [
    new RegExp(`(Enter|Type|Input|Fill)\\s+['""][^'"]*['""]\\s+(?:in|into|to)\\s+the\\s+${escapeRegex(target)}`, 'i'),
    new RegExp(`(Enter|Type|Input|Fill)\\s+['""][^'"]*['""]\\s+(?:in|into|to)\\s+${escapeRegex(target)}`, 'i'),
  ];

  for (const pattern of patterns) {
    if (pattern.test(step)) {
      // Extract the action and value, then rebuild with backtick
      const match = step.match(/(Enter|Type|Input|Fill)\s+(['""][^'"]*['"])/i);
      if (match) {
        const action = match[1];
        const value = match[2];
        return `${action} ${value} in \`${elementKey}\``;
      }
    }
  }

  return step;
}

/**
 * Enhance a verify_element step by injecting backtick notation
 * Example: "Verify the submit button is displayed" -> "Verify `buttonSubmit` is displayed"
 */
function enhanceVerifyElementStep(step: string, target: string, elementKey: string): string {
  // Pattern: "Verify target is displayed" or "Confirm element exists"
  const patterns = [
    new RegExp(`(Verify|Check|Confirm|Ensure|Assert)\\s+the\\s+${escapeRegex(target)}\\s+is`, 'i'),
    new RegExp(`(Verify|Check|Confirm|Ensure|Assert)\\s+${escapeRegex(target)}\\s+is`, 'i'),
    new RegExp(`(Verify|Check|Confirm|Ensure|Assert)\\s+that\\s+the\\s+${escapeRegex(target)}\\s+is`, 'i'),
  ];

  for (const pattern of patterns) {
    if (pattern.test(step)) {
      const match = step.match(/(Verify|Check|Confirm|Ensure|Assert)\s+(?:that\s+)?(?:the\s+)?/i);
      if (match) {
        const verb = match[0].trim();
        const rest = step.substring(step.indexOf(target) + target.length).trim();
        return `${verb} \`${elementKey}\` ${rest}`;
      }
    }
  }

  return step;
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Check if test steps need enhancement (have natural language but no backticks)
 */
export function needsEnhancement(steps: string[]): boolean {
  for (const step of steps) {
    // Has action words but no backticks
    if (/^(Click|Enter|Type|Fill|Verify|Check)\s+/.test(step) && !step.includes('`')) {
      return true;
    }
  }
  return false;
}
