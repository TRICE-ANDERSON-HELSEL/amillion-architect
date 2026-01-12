
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

/**
 * A safe wrapper for window.localStorage.
 * It handles cases where localStorage is disabled or inaccessible (e.g., in sandboxed iframes).
 */
export const safeLocalStorage = {
  getItem(key: string): string | null {
    try {
      return window.localStorage.getItem(key);
    } catch (e) {
      console.warn(`localStorage.getItem failed for key "${key}":`, e);
      return null;
    }
  },

  setItem(key: string, value: string): void {
    try {
      window.localStorage.setItem(key, value);
    } catch (e) {
      console.warn(`localStorage.setItem failed for key "${key}":`, e);
    }
  },
};
