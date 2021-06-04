/** Util for managing localStorage */
import crypto from 'crypto';

export function get(key: string): any {
  const data: any = localStorage.getItem(key);
  return JSON.parse(data);
}

export function set(key: string, value): any {
  localStorage.setItem(key, JSON.stringify(value));
}

export function remove(key: string): void {
  localStorage.removeItem(key);
}

export const keys = {
  // boolean. Did user see and acknowledge the initial app screen?
  dismissed_welcome_message: 'dismissed_welcome_message',
};

const DRAWING_KEY_PREFIX = 'saved-drawing-';

export function getNicknameImage(nickname: string): string {
  return localStorage.getItem(`${DRAWING_KEY_PREFIX}${nickname}`);
}

/**
 * Save a contact's drawn moniker to localStorage.
 *
 * @param {string} imgData A stringified png image
 * @returns {string} The random nickname for the contact, used to look up the image attributed to the contact
 */
export function setNicknameImage(imgData: string): string {
  let drawingId = crypto.randomBytes(4).toString();
  localStorage.setItem(`${DRAWING_KEY_PREFIX}${drawingId}`, imgData);
  return drawingId;
}
