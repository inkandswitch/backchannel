/** Util for managing localStorage */

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
