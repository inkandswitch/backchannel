import type { Code } from './wormhole';

/**
 * Utilities for common tasks specific to the browser
 */

export async function copyToClipboard(code: Code) {
  try {
    await navigator.clipboard.writeText(code);
    console.log('Code copied to clipboard');
  } catch (err) {
    console.error('Failed to copy: ', err);
  }
}
