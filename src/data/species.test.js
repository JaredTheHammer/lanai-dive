/**
 * Species Data & Season Logic Tests
 *
 * Tests season status computation, species filtering by zone/date,
 * lobster season status, season score modifier, data integrity,
 * and MLCD regulation data.
 */

import { describe, it, expect } from 'vitest';
import {
  SPECIES,
  SPECIES_CATEGORY,
  HARVEST_METHOD,
  SEASON_STATUS,
  MANELE_HULOPOE_MLCD,
  getSeasonStatus,
  getInSeasonSpecies,
  getSpeciesByCategory,
  getSeasonScoreModifier,
  getSpeciesForZone,
  getHarvestableSpeciesForZone,
  getLobsterSeasonStatus,
} from './species.js';

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------
describe('SPECIES data integrity', () => {
  it('contains at least 10 species', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(10);
  });

  it('every species has required fields', () => {
    for (const s of SPECIES) {
      expect(s.id).toBeTruthy();
      expect(s.category).toBeTruthy();
      expect(s.commonName).toBeTruthy();
      expect(s.harvestMethods).toBeInstanceOf(Array);
      expect(s.habitatZones).toBeInstanceOf(Array);
    }
  });

  it('every species id is unique', () => {
    const ids = SPECIES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all categories are valid SPECIES_CATEGORY values', () => {
    const validCategories = Object.values(SPECIES_CATEGORY);
    for (const s of SPECIES) {
      expect(validCategories).toContain(s.category);
    }
  });

  it('all harvest methods are valid HARVEST_METHOD values', () => {
    const validMethods = Object.values(HARVEST_METHOD);
    for (const s of SPECIES) {
      for (const m of s.harvestMethods) {
        expect(validMethods).toContain(m);
      }
    }
  });

  it('closedMonths values are valid month indices (0-11)', () => {
    for (const s of SPECIES) {
      if (s.closedMonths) {
        for (const m of s.closedMonths) {
          expect(m).toBeGreaterThanOrEqual(0);
          expect(m).toBeLessThanOrEqual(11);
        }
      }
    }
  });
});

// ---------------------------------------------------------------------------
// getSeasonStatus
// ---------------------------------------------------------------------------
describe('getSeasonStatus', () => {
  const lobster = SPECIES.find((s) => s.id === 'lobster_spiny');

  it('returns OPEN for species with no closedMonths', () => {
    const openSpecies = SPECIES.find((s) => !s.closedMonths || s.closedMonths.length === 0);
    if (!openSpecies) return; // skip if all species have seasons
    const status = getSeasonStatus(openSpecies);
    expect(status.status).toBe(SEASON_STATUS.OPEN);
    expect(status.label).toBe('Open year-round');
    expect(status.nextChange).toBeNull();
  });

  it('returns CLOSED for lobster in July (mid-closed season)', () => {
    const july = new Date(2025, 6, 15); // month 6 = July
    const status = getSeasonStatus(lobster, july);
    expect(status.status).toBe(SEASON_STATUS.CLOSED);
    expect(status.label).toContain('Closed');
  });

  it('returns OPEN for lobster in January (open season)', () => {
    const jan = new Date(2025, 0, 15);
    const status = getSeasonStatus(lobster, jan);
    expect(status.status).toBe(SEASON_STATUS.OPEN);
  });

  it('returns OPEN for lobster in September (season just opened)', () => {
    const sep = new Date(2025, 8, 1);
    const status = getSeasonStatus(lobster, sep);
    expect(status.status).toBe(SEASON_STATUS.OPEN);
  });

  it('returns CLOSED for lobster in May (season just closed)', () => {
    const may = new Date(2025, 4, 1);
    const status = getSeasonStatus(lobster, may);
    expect(status.status).toBe(SEASON_STATUS.CLOSED);
  });

  it('provides nextChange date pointing to when season opens (from closed)', () => {
    const july = new Date(2025, 6, 15);
    const status = getSeasonStatus(lobster, july);
    expect(status.nextChange).toBeInstanceOf(Date);
    // Lobster closed May-Aug, so next open = September 1
    expect(status.nextChange.getMonth()).toBe(8); // September
  });

  it('provides nextChange date pointing to when season closes (from open)', () => {
    const jan = new Date(2025, 0, 15);
    const status = getSeasonStatus(lobster, jan);
    expect(status.nextChange).toBeInstanceOf(Date);
    // Lobster closes in May
    expect(status.nextChange.getMonth()).toBe(4); // May
  });

  it('nextChange is always in the future', () => {
    const dec = new Date(2025, 11, 15);
    const status = getSeasonStatus(lobster, dec);
    expect(status.nextChange.getTime()).toBeGreaterThan(dec.getTime());
  });
});

// ---------------------------------------------------------------------------
// getInSeasonSpecies
// ---------------------------------------------------------------------------
describe('getInSeasonSpecies', () => {
  it('returns fewer species in July (lobster closed) than January', () => {
    const july = new Date(2025, 6, 15);
    const jan = new Date(2025, 0, 15);
    const julySpecies = getInSeasonSpecies(july);
    const janSpecies = getInSeasonSpecies(jan);
    expect(janSpecies.length).toBeGreaterThanOrEqual(julySpecies.length);
  });

  it('all returned species are actually in season', () => {
    const date = new Date(2025, 0, 15);
    const inSeason = getInSeasonSpecies(date);
    for (const s of inSeason) {
      const status = getSeasonStatus(s, date);
      expect(status.status).not.toBe(SEASON_STATUS.CLOSED);
    }
  });

  it('excludes species that are currently closed', () => {
    const july = new Date(2025, 6, 15);
    const inSeason = getInSeasonSpecies(july);
    const lobsterIds = inSeason.filter((s) => s.id.startsWith('lobster_'));
    expect(lobsterIds).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// getSpeciesByCategory
// ---------------------------------------------------------------------------
describe('getSpeciesByCategory', () => {
  it('returns an object with category keys', () => {
    const grouped = getSpeciesByCategory();
    expect(typeof grouped).toBe('object');
    // Should have at least fish and crustacean
    expect(grouped[SPECIES_CATEGORY.FISH]).toBeDefined();
    expect(grouped[SPECIES_CATEGORY.CRUSTACEAN]).toBeDefined();
  });

  it('total species across categories equals SPECIES length', () => {
    const grouped = getSpeciesByCategory();
    const total = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);
    expect(total).toBe(SPECIES.length);
  });
});

// ---------------------------------------------------------------------------
// getSeasonScoreModifier
// ---------------------------------------------------------------------------
describe('getSeasonScoreModifier', () => {
  it('returns modifier between 0 and 1', () => {
    const result = getSeasonScoreModifier(new Date(2025, 0, 15));
    expect(result.modifier).toBeGreaterThanOrEqual(0);
    expect(result.modifier).toBeLessThanOrEqual(1);
  });

  it('returns openCount + closedSpecies.length = totalCount', () => {
    const result = getSeasonScoreModifier(new Date(2025, 6, 15));
    expect(result.openCount + result.closedSpecies.length).toBe(result.totalCount);
  });

  it('filters by spearfishing activity', () => {
    const result = getSeasonScoreModifier(new Date(2025, 0, 15), 'spearfishing');
    // Should only count fish with spear harvest method
    expect(result.totalCount).toBeGreaterThan(0);
    expect(result.totalCount).toBeLessThan(SPECIES.length);
  });

  it('filters by lobster activity', () => {
    const jan = getSeasonScoreModifier(new Date(2025, 0, 15), 'lobster');
    const july = getSeasonScoreModifier(new Date(2025, 6, 15), 'lobster');

    // In January, lobster season is open
    expect(jan.modifier).toBe(1);
    // In July, lobster season is closed
    expect(july.modifier).toBe(0);
  });

  it('has lower modifier in July than January (lobster closed)', () => {
    const jan = getSeasonScoreModifier(new Date(2025, 0, 15), 'all');
    const july = getSeasonScoreModifier(new Date(2025, 6, 15), 'all');
    expect(jan.modifier).toBeGreaterThanOrEqual(july.modifier);
  });

  it('closedSpecies array contains string names', () => {
    const july = getSeasonScoreModifier(new Date(2025, 6, 15), 'all');
    if (july.closedSpecies.length > 0) {
      expect(typeof july.closedSpecies[0]).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// getSpeciesForZone / getHarvestableSpeciesForZone
// ---------------------------------------------------------------------------
describe('getSpeciesForZone', () => {
  it('returns species whose habitatZones includes the given zone', () => {
    const southSpecies = getSpeciesForZone('south_shore');
    expect(southSpecies.length).toBeGreaterThan(0);
    for (const s of southSpecies) {
      expect(s.habitatZones).toContain('south_shore');
    }
  });

  it('returns empty array for unknown zone', () => {
    expect(getSpeciesForZone('nonexistent_zone')).toHaveLength(0);
  });
});

describe('getHarvestableSpeciesForZone', () => {
  it('returns species in both the zone and in season', () => {
    const jan = new Date(2025, 0, 15);
    const harvestable = getHarvestableSpeciesForZone('south_shore', jan);
    expect(harvestable.length).toBeGreaterThan(0);
    for (const s of harvestable) {
      expect(s.habitatZones).toContain('south_shore');
      expect(getSeasonStatus(s, jan).status).not.toBe(SEASON_STATUS.CLOSED);
    }
  });

  it('excludes closed-season species from zone results', () => {
    const july = new Date(2025, 6, 15);
    const harvestable = getHarvestableSpeciesForZone('south_shore', july);
    const lobsters = harvestable.filter((s) => s.id.startsWith('lobster_'));
    expect(lobsters).toHaveLength(0);
  });

  it('returns fewer harvestable species in closed season', () => {
    const jan = new Date(2025, 0, 15);
    const july = new Date(2025, 6, 15);
    const janHarvestable = getHarvestableSpeciesForZone('southwest', jan);
    const julyHarvestable = getHarvestableSpeciesForZone('southwest', july);
    expect(janHarvestable.length).toBeGreaterThanOrEqual(julyHarvestable.length);
  });
});

// ---------------------------------------------------------------------------
// getLobsterSeasonStatus
// ---------------------------------------------------------------------------
describe('getLobsterSeasonStatus', () => {
  it('returns inSeason=true in January', () => {
    const result = getLobsterSeasonStatus(new Date(2025, 0, 15));
    expect(result.inSeason).toBe(true);
    expect(result.species.length).toBeGreaterThan(0);
    expect(result.closedUntil).toBeNull();
  });

  it('returns inSeason=false in July', () => {
    const result = getLobsterSeasonStatus(new Date(2025, 6, 15));
    expect(result.inSeason).toBe(false);
    expect(result.species).toHaveLength(0);
    expect(result.closedUntil).toBeInstanceOf(Date);
  });

  it('closedUntil is September when checked in summer', () => {
    const result = getLobsterSeasonStatus(new Date(2025, 6, 15));
    expect(result.closedUntil.getMonth()).toBe(8); // September
  });

  it('returns inSeason=true in September (just opened)', () => {
    const result = getLobsterSeasonStatus(new Date(2025, 8, 1));
    expect(result.inSeason).toBe(true);
  });

  it('returns inSeason=true in April (last month before closure)', () => {
    const result = getLobsterSeasonStatus(new Date(2025, 3, 30));
    expect(result.inSeason).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// MLCD data
// ---------------------------------------------------------------------------
describe('MANELE_HULOPOE_MLCD', () => {
  it('has subzones A and B', () => {
    expect(MANELE_HULOPOE_MLCD.subzones.A).toBeDefined();
    expect(MANELE_HULOPOE_MLCD.subzones.B).toBeDefined();
  });

  it('subzones have restrictions arrays', () => {
    expect(MANELE_HULOPOE_MLCD.subzones.A.restrictions.length).toBeGreaterThan(0);
    expect(MANELE_HULOPOE_MLCD.subzones.B.restrictions.length).toBeGreaterThan(0);
  });

  it('has permitted gear list', () => {
    expect(MANELE_HULOPOE_MLCD.permittedGear).toBeInstanceOf(Array);
    expect(MANELE_HULOPOE_MLCD.permittedGear.length).toBeGreaterThan(0);
  });
});
