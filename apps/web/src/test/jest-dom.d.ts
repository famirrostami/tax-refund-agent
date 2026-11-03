import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers";
import "vitest";

// Type-side twin of the expect.extend call in setup.ts (jest-dom's own augmentation targets the hoisted vitest).
declare module "vitest" {
  interface Assertion<T = any> extends TestingLibraryMatchers<any, T> {}
  interface AsymmetricMatchersContaining extends TestingLibraryMatchers<any, any> {}
}
