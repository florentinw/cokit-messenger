/**
 * Shallow structural equality for arrays (order-sensitive).
 * Mirrors the API expected by `@1io/tauri-plugin-co-sdk` (`useFilteredCores`).
 */
export function compareArrayItemsEqual(a, b) {
  if (a === b) return true;
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    const left = a[i];
    const right = b[i];
    if (left === right) continue;
    if (
      left != null &&
      right != null &&
      typeof left === "object" &&
      typeof right === "object"
    ) {
      const leftKeys = Object.keys(left);
      const rightKeys = Object.keys(right);
      if (leftKeys.length !== rightKeys.length) return false;
      for (const key of leftKeys) {
        if (left[key] !== right[key]) return false;
      }
      continue;
    }
    return false;
  }
  return true;
}
