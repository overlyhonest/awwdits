import { describe, it, expect } from 'vitest';
import { hasOwnText } from './elementText.js';

// The DOM contract hasOwnText reads: nodeType 3 = text node, 1 = element node.
const textNode = (s) => ({ nodeType: 3, textContent: s });
const elementNode = () => ({ nodeType: 1 });

describe('hasOwnText', () => {
  it('is true for an element that renders its own text', () => {
    expect(hasOwnText({ childNodes: [textNode('Hello')] })).toBe(true);
  });

  it('is false for a container whose text lives only in child elements', () => {
    // The bug: <div><span>text</span></div> — textContent is truthy, but the div
    // renders no text of its own.
    expect(hasOwnText({ childNodes: [elementNode(), elementNode()] })).toBe(false);
  });

  it('is true for mixed content — own text alongside child elements', () => {
    // <p>Some <a>link</a> text</p> is a real text element; the leaf check would drop it.
    expect(hasOwnText({ childNodes: [textNode('Some '), elementNode(), textNode(' text')] })).toBe(true);
  });

  it('ignores whitespace-only text between child elements', () => {
    expect(hasOwnText({ childNodes: [textNode('\n  '), elementNode(), textNode('\n')] })).toBe(false);
  });

  it('is false for an empty element and for nullish input', () => {
    expect(hasOwnText({ childNodes: [] })).toBe(false);
    expect(hasOwnText(null)).toBe(false);
    expect(hasOwnText(undefined)).toBe(false);
  });
});
