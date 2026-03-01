/**
 * Moon Phase Calculator
 *
 * Pure client-side computation using the suncalc library.
 * Moon phase affects night diving visibility and can influence
 * tidal range (spring vs neap tides).
 *
 * Uses Lanai coordinates for accurate rise/set times.
 */

import SunCalc from 'suncalc';
import { LANAI_LAT, LANAI_LON } from './config.js';

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent'
];

// Unicode moon phase emojis matching PHASE_NAMES order
const PHASE_EMOJIS = [
  '\u{1F311}', // New Moon
  '\u{1F312}', // Waxing Crescent
  '\u{1F313}', // First Quarter
  '\u{1F314}', // Waxing Gibbous
  '\u{1F315}', // Full Moon
  '\u{1F316}', // Waning Gibbous
  '\u{1F317}', // Last Quarter
  '\u{1F318}', // Waning Crescent
];

/**
 * Get current moon phase data for Lanai.
 * @returns {{ name: string, emoji: string, illumination: number, phase: number, rise: Date|null, set: Date|null, tidalNote: string }}
 */
export function getMoonPhase() {
  const now = new Date();

  const illum = SunCalc.getMoonIllumination(now);
  const times = SunCalc.getMoonTimes(now, LANAI_LAT, LANAI_LON);

  // phase: 0 = new moon, 0.25 = first quarter, 0.5 = full, 0.75 = last quarter
  const phaseIndex = Math.round(illum.phase * 8) % 8;

  // Tidal note: spring tides (stronger) near new/full moon, neap tides near quarters
  let tidalNote;
  const distFromNewFull = Math.min(illum.phase, Math.abs(illum.phase - 0.5), 1 - illum.phase);
  if (distFromNewFull < 0.08) {
    tidalNote = 'Spring tides (stronger currents)';
  } else if (Math.abs(illum.phase - 0.25) < 0.08 || Math.abs(illum.phase - 0.75) < 0.08) {
    tidalNote = 'Neap tides (weaker currents)';
  } else {
    tidalNote = '';
  }

  return {
    name: PHASE_NAMES[phaseIndex],
    emoji: PHASE_EMOJIS[phaseIndex],
    illumination: Math.round(illum.fraction * 100),
    phase: illum.phase,
    rise: times.rise || null,
    set: times.set || null,
    tidalNote
  };
}
