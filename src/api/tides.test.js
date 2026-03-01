/**
 * Tides API Unit Tests
 * Tests computeTideState interpolation logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeTideState } from './tides.js';

describe('computeTideState', () => {
  const NOW = Date.now();

  // Generate predictions bracketing "now" at 6-min intervals
  function makePredictions(baseTime, count, startHeight, endHeight) {
    const preds = [];
    const interval = 6 * 60 * 1000; // 6 minutes
    for (let i = 0; i < count; i++) {
      const frac = i / (count - 1);
      preds.push({
        time: new Date(baseTime + i * interval),
        height: startHeight + frac * (endHeight - startHeight),
      });
    }
    return preds;
  }

  function makeExtremes(baseTime) {
    return [
      { time: new Date(baseTime - 3600000), height: 0.5, type: 'L' },
      { time: new Date(baseTime + 7200000), height: 2.0, type: 'H' },
      { time: new Date(baseTime + 14400000), height: 0.3, type: 'L' },
    ];
  }

  it('interpolates level between bracketing predictions', () => {
    const before = NOW - 180000; // 3 min ago
    const predictions = makePredictions(before, 20, 1.0, 2.0);
    const extremes = makeExtremes(NOW);

    const result = computeTideState(predictions, extremes);
    // Should be between 1.0 and 2.0
    expect(result.level).toBeGreaterThan(0.9);
    expect(result.level).toBeLessThan(2.1);
  });

  it('computes positive rate of change for rising tide', () => {
    const before = NOW - 180000;
    const predictions = makePredictions(before, 20, 1.0, 2.0); // rising
    const extremes = makeExtremes(NOW);

    const result = computeTideState(predictions, extremes);
    expect(result.rateOfChange).toBeGreaterThan(0);
  });

  it('computes negative rate of change for falling tide', () => {
    const before = NOW - 180000;
    const predictions = makePredictions(before, 20, 2.0, 1.0); // falling
    const extremes = makeExtremes(NOW);

    const result = computeTideState(predictions, extremes);
    expect(result.rateOfChange).toBeLessThan(0);
  });

  it('finds next future extreme as nextSlack', () => {
    const before = NOW - 180000;
    const predictions = makePredictions(before, 20, 1.0, 2.0);
    const extremes = makeExtremes(NOW);

    const result = computeTideState(predictions, extremes);
    expect(result.nextSlack).not.toBeNull();
    expect(result.nextSlack.time.getTime()).toBeGreaterThan(NOW);
    expect(result.nextSlack.type).toBe('high');
  });

  it('converts H/L type to high/low', () => {
    const before = NOW - 180000;
    const predictions = makePredictions(before, 20, 1.0, 2.0);
    const extremes = [
      { time: new Date(NOW + 7200000), height: 0.5, type: 'L' },
    ];

    const result = computeTideState(predictions, extremes);
    expect(result.nextSlack.type).toBe('low');
  });

  it('returns fallback when now is outside prediction range', () => {
    // All predictions are in the future
    const predictions = makePredictions(NOW + 3600000, 10, 1.0, 2.0);
    const extremes = makeExtremes(NOW);

    const result = computeTideState(predictions, extremes);
    // Should use fallback (first prediction height or 0)
    expect(result.level).toBeDefined();
    expect(result.rateOfChange).toBe(0);
  });

  it('handles empty predictions array', () => {
    const result = computeTideState([], []);
    expect(result.level).toBe(0);
    expect(result.rateOfChange).toBe(0);
    expect(result.nextSlack).toBeNull();
  });
});
