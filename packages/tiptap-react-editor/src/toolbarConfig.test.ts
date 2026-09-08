import { describe, expect, it } from 'vitest';
import { DEFAULT_TOOLBAR_ITEMS, mergeToolbarItems, TOOLBAR_KEYS } from './toolbarConfig';

describe('mergeToolbarItems', () => {
  it('enables every feature by default when no overrides are given', () => {
    const merged = mergeToolbarItems();
    Object.values(TOOLBAR_KEYS).forEach((key) => {
      expect(merged[key]).toBe(true);
    });
  });

  it('overrides only the keys explicitly passed, leaving the rest at their default', () => {
    const merged = mergeToolbarItems({ table: false, codeBlock: false });
    expect(merged.table).toBe(false);
    expect(merged.codeBlock).toBe(false);
    expect(merged.bold).toBe(true);
    expect(merged.link).toBe(true);
  });

  it('never mutates the shared DEFAULT_TOOLBAR_ITEMS object', () => {
    mergeToolbarItems({ bold: false });
    expect(DEFAULT_TOOLBAR_ITEMS.bold).toBe(true);
  });
});
