/**
 * Moon Phase Calculator Tests
 *
 * Tests getMoonPhase() return shape, phase index mapping,
 * tidal note logic, and illumination bounds.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SunCalc from 'suncalc';

// We need to mock SunCalc so tests are deterministic (moon phase changes daily)
vi.mock('suncalc', () => ({
  default: {
    getMoonIllumination: vi.fn(),
    getMoonTimes: vi.fn(),
  },
}));

let getMoonPhase;

beforeEach(async () => {
  vi.resetModules();
  // Default mocks
  SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.0, fraction: 0.0 });
  SunCalc.getMoonTimes.mockReturnValue({
    rise: new Date('2025-01-01T20:00:00Z'),
    set: new Date('2025-01-02T08:00:00Z'),
  });
  const mod = await import('./moonphase.js');
  getMoonPhase = mod.getMoonPhase;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('getMoonPhase', () => {
  // --- Return shape ---
  it('returns all expected fields', () => {
    const result = getMoonPhase();
    expect(result).toHaveProperty('name');
    expect(result).toHaveProperty('emoji');
    expect(result).toHaveProperty('illumination');
    expect(result).toHaveProperty('phase');
    expect(result).toHaveProperty('rise');
    expect(result).toHaveProperty('set');
    expect(result).toHaveProperty('tidalNote');
  });

  // --- Phase name mapping ---
  it('maps phase 0.0 (new moon) correctly', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.0, fraction: 0.0 });
    const result = getMoonPhase();
    expect(result.name).toBe('New Moon');
  });

  it('maps phase ~0.25 (first quarter) correctly', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.25, fraction: 0.5 });
    const result = getMoonPhase();
    expect(result.name).toBe('First Quarter');
  });

  it('maps phase ~0.5 (full moon) correctly', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.5, fraction: 1.0 });
    const result = getMoonPhase();
    expect(result.name).toBe('Full Moon');
  });

  it('maps phase ~0.75 (last quarter) correctly', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.75, fraction: 0.5 });
    const result = getMoonPhase();
    expect(result.name).toBe('Last Quarter');
  });

  it('maps phase ~0.125 (waxing crescent) correctly', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.125, fraction: 0.25 });
    const result = getMoonPhase();
    expect(result.name).toBe('Waxing Crescent');
  });

  // --- Illumination ---
  it('returns illumination as a 0-100 integer', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.5, fraction: 0.987 });
    const result = getMoonPhase();
    expect(result.illumination).toBe(99); // Math.round(0.987 * 100)
    expect(Number.isInteger(result.illumination)).toBe(true);
  });

  it('returns 0 illumination for new moon', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.0, fraction: 0.0 });
    expect(getMoonPhase().illumination).toBe(0);
  });

  // --- Tidal notes ---
  it('reports spring tides near new moon (phase ~0)', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.02, fraction: 0.01 });
    expect(getMoonPhase().tidalNote).toMatch(/spring/i);
  });

  it('reports spring tides near full moon (phase ~0.5)', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.49, fraction: 0.99 });
    expect(getMoonPhase().tidalNote).toMatch(/spring/i);
  });

  it('reports neap tides near first quarter (phase ~0.25)', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.25, fraction: 0.5 });
    expect(getMoonPhase().tidalNote).toMatch(/neap/i);
  });

  it('reports neap tides near last quarter (phase ~0.75)', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.75, fraction: 0.5 });
    expect(getMoonPhase().tidalNote).toMatch(/neap/i);
  });

  it('returns empty tidal note for intermediate phases', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.15, fraction: 0.3 });
    expect(getMoonPhase().tidalNote).toBe('');
  });

  // --- Rise/set ---
  it('returns Date objects for rise and set', () => {
    const result = getMoonPhase();
    expect(result.rise).toBeInstanceOf(Date);
    expect(result.set).toBeInstanceOf(Date);
  });

  it('returns null for rise/set when SunCalc does not provide them', () => {
    SunCalc.getMoonTimes.mockReturnValue({});
    const result = getMoonPhase();
    expect(result.rise).toBeNull();
    expect(result.set).toBeNull();
  });

  // --- Edge case: phase wraps around at 1.0 ---
  it('handles phase very close to 1.0 (wraps to new moon)', () => {
    SunCalc.getMoonIllumination.mockReturnValue({ phase: 0.99, fraction: 0.01 });
    // Math.round(0.99 * 8) = Math.round(7.92) = 8, % 8 = 0 → New Moon
    expect(getMoonPhase().name).toBe('New Moon');
  });
});
