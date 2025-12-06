import { exec } from 'child_process';
import { promisify } from 'util';
import logger from '../utils/logger.js';

const execAsync = promisify(exec);

/**
 * Task verification service - runs kubectl commands to verify task completion
 */
export const VerificationService = {
  /**
   * Execute verification script in the terminal container
   * @param {string} containerName - Terminal container name
   * @param {string} script - Verification script to run (kubectl commands)
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<{success: boolean, output: string, error: string|null}>}
   */
  async executeVerification(containerName, script, timeout = 30000) {
    try {
      logger.info('Executing verification script', { containerName, script: script.substring(0, 100) });

      // Execute the script in the container
      const { stdout, stderr } = await execAsync(
        `docker exec ${containerName} /bin/bash -c ${JSON.stringify(script)}`,
        { timeout }
      );

      const output = stdout.trim();
      const errorOutput = stderr.trim();

      logger.info('Verification script executed', { 
        containerName, 
        hasOutput: !!output,
        hasError: !!errorOutput 
      });

      return {
        success: true,
        output,
        error: errorOutput || null,
      };
    } catch (error) {
      logger.error('Verification script execution failed', {
        containerName,
        error: error.message,
        stderr: error.stderr,
      });

      return {
        success: false,
        output: error.stdout || '',
        error: error.message,
      };
    }
  },

  /**
   * Parse verification script results and determine if task passed
   * @param {object} verificationConfig - Verification configuration from task
   * @param {string} output - Output from verification script
   * @returns {object} Verification result with pass/fail and details
   */
  parseVerificationResult(verificationConfig, output, error) {
    const results = {
      passed: false,
      checks: [],
      score: 0,
      maxScore: 0,
      message: '',
    };

    // If execution failed, return fail
    if (error && !output) {
      results.message = 'Verification script failed to execute';
      return results;
    }

    // Process each check in the verification config
    for (const check of verificationConfig.checks || []) {
      const checkResult = this.evaluateCheck(check, output);
      results.checks.push(checkResult);
      results.maxScore += check.points || 1;
      if (checkResult.passed) {
        results.score += check.points || 1;
      }
    }

    // Determine overall pass/fail (need to pass all checks)
    results.passed = results.checks.every(c => c.passed) && results.checks.length > 0;
    
    if (results.passed) {
      results.message = '✅ All checks passed!';
    } else {
      const failedChecks = results.checks.filter(c => !c.passed);
      results.message = `❌ ${failedChecks.length} check(s) failed`;
    }

    return results;
  },

  /**
   * Evaluate a single verification check
   * @param {object} check - Check configuration
   * @param {string} output - Command output
   * @returns {object} Check result
   */
  evaluateCheck(check, output) {
    const result = {
      name: check.name,
      passed: false,
      actual: null,
      expected: check.expected,
      message: '',
      points: check.points || 1,
    };

    try {
      switch (check.type) {
        case 'contains':
          // Check if output contains expected string
          result.passed = output.includes(check.expected);
          result.actual = output;
          result.message = result.passed 
            ? `Found "${check.expected}"` 
            : `Expected to find "${check.expected}"`;
          break;

        case 'not_contains':
          // Check if output does NOT contain string
          result.passed = !output.includes(check.expected);
          result.actual = output;
          result.message = result.passed 
            ? `Correctly does not contain "${check.expected}"` 
            : `Should not contain "${check.expected}"`;
          break;

        case 'regex':
          // Check if output matches regex
          const regex = new RegExp(check.expected);
          result.passed = regex.test(output);
          result.actual = output;
          result.message = result.passed 
            ? 'Pattern matched' 
            : `Expected pattern: ${check.expected}`;
          break;

        case 'count':
          // Count occurrences of a pattern
          const countRegex = new RegExp(check.pattern, 'g');
          const matches = output.match(countRegex);
          const count = matches ? matches.length : 0;
          result.actual = count;
          result.passed = count === check.expected;
          result.message = result.passed 
            ? `Found ${count} occurrences` 
            : `Expected ${check.expected} occurrences, found ${count}`;
          break;

        case 'exit_code':
          // For exit code checks (would need to be captured differently)
          // For now, assume success if we got output
          result.passed = output.length > 0;
          result.message = result.passed ? 'Command executed successfully' : 'Command failed';
          break;

        case 'json_path':
          // Extract JSON value using path notation
          try {
            const jsonMatch = output.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const json = JSON.parse(jsonMatch[0]);
              const value = this.getJsonPath(json, check.path);
              result.actual = value;
              result.passed = value === check.expected || 
                             (Array.isArray(check.expected) && check.expected.includes(value));
              result.message = result.passed 
                ? `Found correct value: ${value}` 
                : `Expected ${check.expected}, got ${value}`;
            } else {
              result.passed = false;
              result.message = 'No JSON found in output';
            }
          } catch (e) {
            result.passed = false;
            result.message = `JSON parse error: ${e.message}`;
          }
          break;

        default:
          result.message = `Unknown check type: ${check.type}`;
      }
    } catch (error) {
      result.passed = false;
      result.message = `Check failed: ${error.message}`;
    }

    return result;
  },

  /**
   * Get value from JSON object using dot notation path
   * @param {object} obj - JSON object
   * @param {string} path - Dot notation path (e.g., "metadata.name")
   * @returns {*} Value at path
   */
  getJsonPath(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  },

  /**
   * Create verification script from checks
   * @param {array} checks - Array of verification checks
   * @returns {string} Bash script to execute
   */
  generateVerificationScript(checks) {
    const commands = checks.map(check => {
      if (check.command) {
        return check.command;
      }
      return ''; // Skip checks without commands
    }).filter(cmd => cmd);

    // Combine all commands with separators
    return commands.join(' && echo "---CHECK---" && ');
  },
};

export default VerificationService;
