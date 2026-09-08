import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Vitest doesn't auto-register jest's globals, so React Testing Library's
// own auto-cleanup (which detects a global `afterEach`) never fires —
// without this, DOM from one test is still mounted when the next test's
// queries run, and every `getByTitle`-style query starts matching more
// than one element.
afterEach(() => cleanup());

// jsdom doesn't implement layout, so ProseMirror's own DOM measurement
// calls (used for cursor/selection coordinates) throw or no-op unless
// stubbed. None of this affects what a test actually asserts — it just
// keeps the editor from crashing while mounted in a DOM with no real
// rendering engine behind it.
class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
}

const emptyRect: DOMRect = {
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: 0,
  height: 0,
  x: 0,
  y: 0,
  toJSON: () => ({}),
};

if (!Range.prototype.getBoundingClientRect) {
  Range.prototype.getBoundingClientRect = () => emptyRect;
}
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
}
if (!Element.prototype.getClientRects) {
  Element.prototype.getClientRects = () =>
    ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} }) as unknown as DOMRectList;
}
if (!document.elementFromPoint) {
  document.elementFromPoint = () => null;
}

// jsdom doesn't implement the Blob URL registry — attachments use
// createObjectURL for a local preview until the real upload resolves.
let blobUrlCounter = 0;
if (typeof URL.createObjectURL === 'undefined') {
  URL.createObjectURL = () => `blob:mock-${(blobUrlCounter += 1)}`;
}
if (typeof URL.revokeObjectURL === 'undefined') {
  URL.revokeObjectURL = () => {};
}
