import { describe, it, expect } from 'vitest';
import { detectClamp } from './sizeClamp.js';

// The bug this covers: an inline `!important` height wins the cascade, so the
// declaration really is on the element — but min-height/max-height clamp the
// *used* value afterwards, so the element never moves. The edit looked like a
// no-op with no explanation anywhere in the panel.
describe('detectClamp', () => {
  it('names min-height when it holds an element above the requested height', () => {
    expect(detectClamp({
      property: 'height', requested: '48px',
      sizeBefore: 56, sizeAfter: 56,
      minValue: '56px', maxValue: 'none',
    })).toEqual({ by: 'min-height', byValue: '56px', effective: '56px' });
  });

  it('names max-width when it holds an element below the requested width', () => {
    expect(detectClamp({
      property: 'width', requested: '500px',
      sizeBefore: 300, sizeAfter: 300,
      minValue: '0px', maxValue: '300px',
    })).toEqual({ by: 'max-width', byValue: '300px', effective: '300px' });
  });

  it('reports nothing when the element actually resized', () => {
    expect(detectClamp({
      property: 'height', requested: '200px',
      sizeBefore: 56, sizeAfter: 200,
      minValue: '56px', maxValue: 'none',
    })).toBeNull();
  });

  // Only claim a culprit we can actually name. An element that didn't move for
  // some other reason (flex, table layout) must not be blamed on a constraint
  // that isn't there — a wrong explanation is worse than none.
  it('reports nothing when no constraint explains the stall', () => {
    expect(detectClamp({
      property: 'height', requested: '48px',
      sizeBefore: 56, sizeAfter: 56,
      minValue: '0px', maxValue: 'none',
    })).toBeNull();
  });

  it('reports nothing when the request already matches the current size', () => {
    expect(detectClamp({
      property: 'height', requested: '56px',
      sizeBefore: 56, sizeAfter: 56,
      minValue: '56px', maxValue: 'none',
    })).toBeNull();
  });

  // Sub-pixel layout noise must not read as either a move or a mismatch.
  it('tolerates sub-pixel differences', () => {
    expect(detectClamp({
      property: 'height', requested: '56px',
      sizeBefore: 56.4, sizeAfter: 56.4,
      minValue: '56px', maxValue: 'none',
    })).toBeNull();
  });

  it('ignores properties that min/max cannot clamp', () => {
    expect(detectClamp({
      property: 'padding-top', requested: '48px',
      sizeBefore: 56, sizeAfter: 56,
      minValue: '56px', maxValue: 'none',
    })).toBeNull();
  });

  it('ignores non-numeric requests it cannot compare', () => {
    expect(detectClamp({
      property: 'height', requested: 'auto',
      sizeBefore: 56, sizeAfter: 56,
      minValue: '56px', maxValue: 'none',
    })).toBeNull();
  });

  it('prefers the constraint on the side the request was pushing toward', () => {
    // Requesting bigger than max while a min also exists — max is the culprit.
    expect(detectClamp({
      property: 'height', requested: '900px',
      sizeBefore: 400, sizeAfter: 400,
      minValue: '100px', maxValue: '400px',
    })).toEqual({ by: 'max-height', byValue: '400px', effective: '400px' });
  });
});
