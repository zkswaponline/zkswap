/*
 * Browser storage keys. Deliberately neutral (not the brand name), so renaming the project never orphans what visitors'
 * browsers already hold.
 */
const PREFIX = "zs1";
export const storageKey = (...parts: string[]) => [PREFIX, ...parts].join(".");

/** Every key the site uses in this browser. */
export const KEYS = {
  slippage: storageKey("swap", "slippage"),
  practiceGroups: storageKey("access", "practice"),
  identity: storageKey("access", "identity"),
  practicePass: storageKey("access", "pass"),
} as const;
