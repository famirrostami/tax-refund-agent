import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { afterEach, expect, vi } from "vitest";

// apps/web has its own vitest, so jest-dom's auto-registering entry would extend a different `expect`.
expect.extend(matchers);

Element.prototype.scrollIntoView = vi.fn();

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
