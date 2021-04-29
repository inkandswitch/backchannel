/**
 * Utilities for common tasks specific to the browser
 */

export async function copyToClipboard(code: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(code);
    console.log('Code copied to clipboard');
    return true;
  } catch (err) {
    console.error('Failed to copy: ', err);
    return false;
  }
}
