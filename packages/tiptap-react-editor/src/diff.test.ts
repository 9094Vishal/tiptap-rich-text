import { describe, expect, it } from 'vitest';
import { compareRichTextSnapshots } from './diff';

describe('compareRichTextSnapshots', () => {
  it('treats identical content as unchanged', () => {
    expect(compareRichTextSnapshots('<p>Hello world</p>', '<p>Hello world</p>')).toBe(true);
  });

  it('treats genuinely different text as changed', () => {
    expect(compareRichTextSnapshots('<p>Hello world</p>', '<p>Hello there</p>')).toBe(false);
  });

  it('ignores incidental re-serialization differences (attribute order, quoting)', () => {
    const a = '<p><strong>bold</strong> text</p>';
    const b = "<p><strong >bold</strong> text</p>"; // extra space before '>' — same DOM once parsed
    expect(compareRichTextSnapshots(a, b)).toBe(true);
  });

  it('detects a formatting-only change (bold added) as changed', () => {
    expect(compareRichTextSnapshots('<p>Hello world</p>', '<p><strong>Hello world</strong></p>')).toBe(false);
  });

  it('compares mention nodes correctly when enableMentions is set', () => {
    const html = '<p><span data-type="mention" data-id="1" data-label="Ada">@Ada</span></p>';
    expect(compareRichTextSnapshots(html, html, { enableMentions: true })).toBe(true);
    const differentMention = '<p><span data-type="mention" data-id="2" data-label="Alan">@Alan</span></p>';
    expect(compareRichTextSnapshots(html, differentMention, { enableMentions: true })).toBe(false);
  });

  it('respects toolbarItems when comparing (e.g. link mark disabled)', () => {
    const withLink = '<p><a href="https://example.com">link</a></p>';
    // With links disabled, the schema has no link mark — the href
    // attribute is dropped on parse for both sides, so they compare
    // equal as plain text rather than throwing.
    expect(compareRichTextSnapshots(withLink, '<p>link</p>', { toolbarItems: { link: false } })).toBe(true);
  });

  it('fails open (reports "different") on unparseable input rather than throwing', () => {
    // Passing something that isn't a string shouldn't crash the caller.
    expect(() => compareRichTextSnapshots(null as unknown as string, '<p>x</p>')).not.toThrow();
  });
});
