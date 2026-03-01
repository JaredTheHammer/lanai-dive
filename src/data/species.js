/**
 * Harvestable Marine Species Database for Lanai, Hawaii
 *
 * Comprehensive species data including:
 *   - Latin binomial nomenclature
 *   - Hawaiian name (with diacriticals where standard)
 *   - Common English name (local Lanai / Hawaii usage)
 *   - DLNR harvest regulations (HAR 13-95, HAR 13-89, HAR 13-30)
 *   - Season open/closed dates
 *   - Size limits, bag limits, gear restrictions
 *   - Lanai-specific notes (Manele-Hulopo'e MLCD, zone affinity)
 *
 * Sources:
 *   - Hawaii DLNR DAR Fishing Regulations (May 2025)
 *   - HAR Title 13, Chapters 89, 90, 95
 *   - NOAA Fisheries Hawaii Fish Measurement Guide (2024)
 *   - Federal Register: MHI Kona Crab ACL 2024-2026
 *
 * IMPORTANT: This module is informational. Regulations change.
 * Users should verify current rules at:
 *   https://dlnr.hawaii.gov/dar/fishing/fishing-regulations/
 *
 * @module data/species
 */

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const SPECIES_CATEGORY = {
  FISH: 'fish',
  CRUSTACEAN: 'crustacean',
  MOLLUSK: 'mollusk',
  ECHINODERM: 'echinoderm',
  ALGAE: 'algae',
};

export const HARVEST_METHOD = {
  SPEAR: 'spear',
  POLE_AND_LINE: 'pole_and_line',
  NET: 'net',
  HAND: 'hand',
  TRAP: 'trap',
  THROW_NET: 'throw_net',
  STICK: 'stick',
};

export const SEASON_STATUS = {
  OPEN: 'open',
  CLOSED: 'closed',
  RESTRICTED: 'restricted',
};

// ---------------------------------------------------------------------------
// Helper: Check if a species is currently in season
// ---------------------------------------------------------------------------

/**
 * Determine if a species is in open season on a given date.
 * @param {Object} species - Species object from SPECIES array
 * @param {Date} [date=new Date()] - Date to check
 * @returns {{ status: string, label: string, nextChange: Date|null }}
 */
export function getSeasonStatus(species, date = new Date()) {
  const month = date.getMonth(); // 0-indexed

  if (!species.closedMonths || species.closedMonths.length === 0) {
    return { status: SEASON_STATUS.OPEN, label: 'Open year-round', nextChange: null };
  }

  const isClosed = species.closedMonths.includes(month);

  if (isClosed) {
    // Find next open month
    let nextOpenMonth = month;
    for (let i = 1; i <= 12; i++) {
      const checkMonth = (month + i) % 12;
      if (!species.closedMonths.includes(checkMonth)) {
        nextOpenMonth = checkMonth;
        break;
      }
    }
    const nextOpen = new Date(date.getFullYear(), nextOpenMonth, 1);
    if (nextOpen <= date) nextOpen.setFullYear(nextOpen.getFullYear() + 1);

    return {
      status: SEASON_STATUS.CLOSED,
      label: `Closed ${species.closedSeasonLabel}`,
      nextChange: nextOpen,
    };
  }

  // Find next closed month
  let nextClosedMonth = month;
  for (let i = 1; i <= 12; i++) {
    const checkMonth = (month + i) % 12;
    if (species.closedMonths.includes(checkMonth)) {
      nextClosedMonth = checkMonth;
      break;
    }
  }
  const nextClosed = new Date(date.getFullYear(), nextClosedMonth, 1);
  if (nextClosed <= date) nextClosed.setFullYear(nextClosed.getFullYear() + 1);

  return {
    status: SEASON_STATUS.OPEN,
    label: `Open (closes ${species.closedSeasonLabel})`,
    nextChange: nextClosed,
  };
}

/**
 * Get all species currently in season.
 * @param {Date} [date=new Date()]
 * @returns {Object[]} Array of species objects that are currently harvestable
 */
export function getInSeasonSpecies(date = new Date()) {
  return SPECIES.filter(s => {
    const { status } = getSeasonStatus(s, date);
    return status !== SEASON_STATUS.CLOSED;
  });
}

/**
 * Get species grouped by category.
 * @returns {Object} Map of category -> species[]
 */
export function getSpeciesByCategory() {
  return SPECIES.reduce((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});
}

/**
 * Compute a season-based score modifier for scoring integration.
 * Returns a multiplier (0-1) reflecting how many target species are in season.
 *
 * @param {Date} [date=new Date()]
 * @param {string} [activity='spearfishing'] - 'spearfishing' | 'lobster' | 'all'
 * @returns {{ modifier: number, openCount: number, totalCount: number, closedSpecies: string[] }}
 */
export function getSeasonScoreModifier(date = new Date(), activity = 'all') {
  let pool = SPECIES;

  if (activity === 'spearfishing') {
    pool = SPECIES.filter(s =>
      s.category === SPECIES_CATEGORY.FISH &&
      s.harvestMethods.includes(HARVEST_METHOD.SPEAR)
    );
  } else if (activity === 'lobster') {
    pool = SPECIES.filter(s =>
      s.id.startsWith('lobster_') || s.id === 'kona_crab'
    );
  }

  const closed = [];
  const open = [];

  pool.forEach(s => {
    const { status } = getSeasonStatus(s, date);
    if (status === SEASON_STATUS.CLOSED) {
      closed.push(s.hawaiianName || s.commonName);
    } else {
      open.push(s);
    }
  });

  return {
    modifier: pool.length > 0 ? open.length / pool.length : 1,
    openCount: open.length,
    totalCount: pool.length,
    closedSpecies: closed,
  };
}

// ---------------------------------------------------------------------------
// Species Database
// ---------------------------------------------------------------------------

/**
 * Month constants (0-indexed to match JS Date.getMonth())
 */
const JAN = 0, FEB = 1, MAR = 2, APR = 3, MAY = 4, JUN = 5,
      JUL = 6, AUG = 7, SEP = 8, OCT = 9, NOV = 10, DEC = 11;

export const SPECIES = [
  // =========================================================================
  // CRUSTACEANS
  // =========================================================================
  {
    id: 'lobster_spiny',
    category: SPECIES_CATEGORY.CRUSTACEAN,
    latinName: 'Panulirus marginatus',
    hawaiianName: 'Ula',
    commonName: 'Hawaiian Spiny Lobster',
    family: 'Palinuridae',
    description: 'Endemic Hawaiian spiny lobster. Nocturnal; hides in reef crevices by day. Primary target for Lanai skin-diving lobster hunters.',
    closedMonths: [MAY, JUN, JUL, AUG],
    closedSeasonLabel: 'May-Aug',
    sizeLimit: '3.25" carapace length',
    sizeLimitInches: 3.25,
    sizeMeasurement: 'Carapace length: straight line from between rostral horns to midpoint of rear carapace edge',
    bagLimit: null,
    bagLimitNote: 'No recreational bag limit specified in HAR; check current regs',
    genderRestriction: 'All females prohibited from harvest',
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Hand harvest only. No spears, hooks, nets, or poisons. Must be landed whole (not mutilated).',
    lanaiNotes: 'Abundant around south and west shore reef structures. Night dives off Kaumalapau and Hulopo\'e perimeter (outside MLCD) are prime. Cannot harvest inside Manele-Hulopo\'e MLCD.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'lobster_spiny_green',
    category: SPECIES_CATEGORY.CRUSTACEAN,
    latinName: 'Panulirus penicillatus',
    hawaiianName: 'Ula',
    commonName: 'Banded Spiny Lobster',
    family: 'Palinuridae',
    description: 'Green/banded spiny lobster found in shallower surge zones. Less common than P. marginatus around Lanai.',
    closedMonths: [MAY, JUN, JUL, AUG],
    closedSeasonLabel: 'May-Aug',
    sizeLimit: '3.25" carapace length',
    sizeLimitInches: 3.25,
    sizeMeasurement: 'Carapace length: straight line from between rostral horns to midpoint of rear carapace edge',
    bagLimit: null,
    bagLimitNote: 'No recreational bag limit specified in HAR; check current regs',
    genderRestriction: 'All females prohibited from harvest',
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Hand harvest only. No spears, hooks, nets, or poisons. Must be landed whole.',
    lanaiNotes: 'Found in shallow surge zones and tide pools. Less common than P. marginatus.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'lobster_slipper',
    category: SPECIES_CATEGORY.CRUSTACEAN,
    latinName: 'Scyllarides squammosus',
    hawaiianName: 'Ula pāpapa',
    commonName: 'Ridgeback Slipper Lobster',
    family: 'Scyllaridae',
    description: 'Slipper lobster (shovel-nosed). Flattened body; hides under ledges. Considered excellent eating.',
    closedMonths: [MAY, JUN, JUL, AUG],
    closedSeasonLabel: 'May-Aug',
    sizeLimit: '2.75" tail width',
    sizeLimitInches: 2.75,
    sizeMeasurement: 'Tail width: measured at widest point between 1st and 2nd abdominal segments',
    bagLimit: null,
    bagLimitNote: 'No recreational bag limit specified; check current regs',
    genderRestriction: 'Egg-bearing (berried) females prohibited',
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Hand harvest only. Must be landed whole.',
    lanaiNotes: 'Found under ledges on south and west shores. Less common than spiny lobster.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'lobster_slipper_haanii',
    category: SPECIES_CATEGORY.CRUSTACEAN,
    latinName: 'Scyllarides haanii',
    hawaiianName: 'Ula pāpapa',
    commonName: "Haan's Slipper Lobster",
    family: 'Scyllaridae',
    description: 'Second species of slipper lobster in Hawaiian waters. Same regulations as S. squammosus.',
    closedMonths: [MAY, JUN, JUL, AUG],
    closedSeasonLabel: 'May-Aug',
    sizeLimit: '2.75" tail width',
    sizeLimitInches: 2.75,
    sizeMeasurement: 'Tail width between 1st and 2nd abdominal segments',
    bagLimit: null,
    genderRestriction: 'Egg-bearing (berried) females prohibited',
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Hand harvest only. Must be landed whole.',
    lanaiNotes: 'Less common around Lanai. Same regs as ridgeback slipper.',
    habitatZones: ['south_shore', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'kona_crab',
    category: SPECIES_CATEGORY.CRUSTACEAN,
    latinName: 'Ranina ranina',
    hawaiianName: 'Pāpaʻi Kualoa',
    commonName: 'Kona Crab (Spanner Crab)',
    family: 'Raninidae',
    description: 'Distinctive red crab that buries in sandy bottom. Prized delicacy. Federal ACL of 30,802 lb/yr (2024-2026).',
    closedMonths: [MAY, JUN, JUL, AUG, SEP],
    closedSeasonLabel: 'May-Sep',
    sizeLimit: '4" carapace length',
    sizeLimitInches: 4,
    sizeMeasurement: 'Carapace length',
    bagLimit: null,
    bagLimitNote: 'Subject to federal annual catch limit (ACL). Check current status.',
    genderRestriction: 'Egg-bearing females prohibited (non-berried females OK as of 2024 rule change)',
    harvestMethods: [HARVEST_METHOD.HAND, HARVEST_METHOD.NET],
    gearRestrictions: 'No spearing. Loop nets permitted.',
    lanaiNotes: 'Sandy bottom areas off south and west shores. Not common in reef zones.',
    habitatZones: ['south_shore', 'southwest'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'samoan_crab',
    category: SPECIES_CATEGORY.CRUSTACEAN,
    latinName: 'Scylla serrata',
    hawaiianName: 'Pāpaʻi',
    commonName: 'Samoan Crab (Mud Crab)',
    family: 'Portunidae',
    description: 'Large mud/mangrove crab. Found in brackish and nearshore areas.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '6" carapace width',
    sizeLimitInches: 6,
    sizeMeasurement: 'Carapace width at widest point',
    bagLimit: 3,
    bagLimitNote: '3 per person per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.HAND, HARVEST_METHOD.TRAP, HARVEST_METHOD.NET],
    gearRestrictions: null,
    lanaiNotes: 'Uncommon around Lanai due to limited brackish habitat.',
    habitatZones: [],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },

  // =========================================================================
  // FISH - Surgeonfish / Tangs (Acanthuridae)
  // =========================================================================
  {
    id: 'kole',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Ctenochaetus strigosus',
    hawaiianName: 'Kole',
    commonName: 'Goldring Surgeonfish',
    family: 'Acanthuridae',
    description: 'Small brown surgeonfish with gold ring around eye. Important herbivore. Regulated since 2024 due to overfishing concerns.',
    closedMonths: [MAR, APR, MAY, JUN],
    closedSeasonLabel: 'Mar-Jun',
    sizeLimit: '5" fork length',
    sizeLimitInches: 5,
    sizeMeasurement: 'Fork length',
    bagLimit: 20,
    bagLimitNote: '20 per person per day (Jul-Feb only)',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Common on all reef zones. Good eating grilled/fried. Low ciguatera risk at this size.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },
  {
    id: 'manini',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Acanthurus triostegus',
    hawaiianName: 'Manini',
    commonName: 'Convict Tang',
    family: 'Acanthuridae',
    description: 'Striped surgeonfish found in schools on shallow reefs. Minimum size increased to 6" in 2024.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '6" fork length',
    sizeLimitInches: 6,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    bagLimitNote: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET, HARVEST_METHOD.THROW_NET],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Abundant in shallow reef flats, especially south shore.',
    habitatZones: ['south_shore', 'southwest', 'west', 'east'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
  {
    id: 'kala',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Naso unicornis',
    hawaiianName: 'Kala',
    commonName: 'Bluespine Unicornfish',
    family: 'Acanthuridae',
    description: 'Large unicornfish with prominent horn. Critically overfished (SPR ~3%). New noncommercial bag limit since 2024.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '14" fork length',
    sizeLimitInches: 14,
    sizeMeasurement: 'Fork length',
    bagLimit: 4,
    bagLimitNote: '4 per person per day (noncommercial). Commercial: requires Kala Fishing Permit, daily limit 50, ACL 10,000 lb/yr',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found along reef drop-offs. Strong-tasting; traditional preparation involves drying.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'moderate',
  },
  {
    id: 'opelu_kala',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Naso hexacanthus',
    hawaiianName: 'ʻŌpelu kala',
    commonName: 'Sleek Unicornfish',
    family: 'Acanthuridae',
    description: 'Deeper-water unicornfish without the prominent horn of N. unicornis.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '16" fork length',
    sizeLimitInches: 16,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Occasionally seen off deeper reef edges.',
    habitatZones: ['south_shore', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },

  // =========================================================================
  // FISH - Parrotfish (Scaridae)
  // =========================================================================
  {
    id: 'uhu_palenose',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Scarus psittacus',
    hawaiianName: 'Uhu',
    commonName: 'Palenose Parrotfish',
    family: 'Scaridae',
    description: 'Small-bodied parrotfish. 10" minimum size (distinct from large-bodied uhu at 14").',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '10" fork length',
    sizeLimitInches: 10,
    sizeMeasurement: 'Fork length',
    bagLimit: 2,
    bagLimitNote: '2 total all uhu species per person per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing. No night spearing of any uhu.',
    lanaiNotes: 'Common on Lanai reefs. Important herbivore; practice restraint.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },
  {
    id: 'uhu_redlip',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Scarus rubroviolaceus',
    hawaiianName: 'Uhu pālukaluka',
    commonName: 'Ember Parrotfish (Redlip)',
    family: 'Scaridae',
    description: 'Large-bodied parrotfish. Terminal-phase males (uhu ʻeleʻele) are PROHIBITED from harvest.',
    closedMonths: [MAR, APR, MAY],
    closedSeasonLabel: 'Mar-May (uhu ʻahuʻula/pālukaluka only)',
    sizeLimit: '14" fork length (Jun-Feb); slot 14-20" for regulated period',
    sizeLimitInches: 14,
    sizeMeasurement: 'Fork length',
    bagLimit: 1,
    bagLimitNote: '1 per person per day (Jun-Feb). Zero during Mar-May closure. Terminal-phase males (uhu ʻeleʻele) ALWAYS prohibited.',
    genderRestriction: 'Terminal-phase males (blue, uhu ʻeleʻele) prohibited year-round',
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing. No night spearing.',
    lanaiNotes: 'The large blue terminal-phase males are ALWAYS off limits. Critically overfished (SPR 2.3%).',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },
  {
    id: 'uhu_spectacled',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Chlorurus perspicillatus',
    hawaiianName: 'Uhu uliuli',
    commonName: 'Spectacled Parrotfish',
    family: 'Scaridae',
    description: 'Endemic Hawaiian parrotfish. Terminal-phase males PROHIBITED from harvest.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '14" fork length',
    sizeLimitInches: 14,
    sizeMeasurement: 'Fork length',
    bagLimit: 2,
    bagLimitNote: '2 total all uhu species. Terminal-phase (uhu uliuli) ALWAYS prohibited.',
    genderRestriction: 'Terminal-phase males (uhu uliuli) prohibited year-round',
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing. No night spearing.',
    lanaiNotes: 'Endemic to Hawaii. Terminal-phase males always prohibited.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },
  {
    id: 'uhu_bullethead',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Chlorurus spilurus',
    hawaiianName: 'Uhu',
    commonName: 'Bullethead Parrotfish',
    family: 'Scaridae',
    description: 'Common large-bodied parrotfish on Hawaiian reefs.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '14" fork length',
    sizeLimitInches: 14,
    sizeMeasurement: 'Fork length',
    bagLimit: 2,
    bagLimitNote: '2 total all uhu species per person per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing. No night spearing.',
    lanaiNotes: 'Common on Lanai reefs.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },
  {
    id: 'uhu_stareye',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Calotomus carolinus',
    hawaiianName: 'Uhu',
    commonName: 'Stareye Parrotfish',
    family: 'Scaridae',
    description: 'Smaller parrotfish species found in shallow reef areas.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '10" fork length',
    sizeLimitInches: 10,
    sizeMeasurement: 'Fork length',
    bagLimit: 2,
    bagLimitNote: '2 total all uhu species per person per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing. No night spearing.',
    lanaiNotes: 'Found in shallow reef flats.',
    habitatZones: ['south_shore', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
  },

  // =========================================================================
  // FISH - Goatfish (Mullidae)
  // =========================================================================
  {
    id: 'kumu',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Parupeneus porphyreus',
    hawaiianName: 'Kūmū',
    commonName: 'Whitesaddle Goatfish',
    family: 'Mullidae',
    description: 'Endemic Hawaiian goatfish. Red body with white saddle mark. Considered the best-eating goatfish. Prized in Hawaiian culture.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '10" fork length',
    sizeLimitInches: 10,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    bagLimitNote: 'No statewide bag limit (Maui island: 12" min, 1/day limit; verify if applies to Lanai as Maui County)',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found around sandy patches near reef. Endemic to Hawaii. Premium table fish.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'moano',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Parupeneus multifasciatus',
    hawaiianName: 'Moano',
    commonName: 'Manybar Goatfish',
    family: 'Mullidae',
    description: 'Colorful goatfish with multiple vertical bars. Common on reef.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Common on Lanai reefs. Good eating.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
  {
    id: 'moano_kea',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Parupeneus cyclostomus',
    hawaiianName: 'Moano kea',
    commonName: 'Blue Goatfish (Yellowsaddle)',
    family: 'Mullidae',
    description: 'Blue/yellow goatfish. Regulated with 12" minimum.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '12" fork length',
    sizeLimitInches: 12,
    sizeMeasurement: 'Fork length',
    bagLimit: 2,
    bagLimitNote: '2 per person per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found near reef drop-offs.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'weke_a',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Mulloidichthys flavolineatus',
    hawaiianName: 'Wekeʻā',
    commonName: 'Yellowstripe Goatfish',
    family: 'Mullidae',
    description: 'Silvery goatfish with yellow lateral stripe. Schools over sand.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '7" fork length',
    sizeLimitInches: 7,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.THROW_NET, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Common in sandy areas near reefs. Juveniles (ʻoama) are a popular bait and food fish.',
    habitatZones: ['south_shore', 'southwest', 'west', 'east'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
  {
    id: 'munu',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Parupeneus pleurostigma',
    hawaiianName: 'Munu',
    commonName: 'Sidespot Goatfish',
    family: 'Mullidae',
    description: 'Goatfish with distinctive dark spot on side.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '8" fork length',
    sizeLimitInches: 8,
    sizeMeasurement: 'Fork length',
    bagLimit: 2,
    bagLimitNote: '2 per person per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found on reef edges.',
    habitatZones: ['south_shore', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
  {
    id: 'weke_nono',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Mulloidichthys dentata',
    hawaiianName: 'Weke nono',
    commonName: 'Yellowfin Goatfish',
    family: 'Mullidae',
    description: 'Known for causing nightmares if eaten in certain seasons (hence "nono" = nightmares). Larger than wekeʻā.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Locals caution against eating the head due to toxins that may cause hallucinations/nightmares.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'moderate',
  },

  // =========================================================================
  // FISH - Jacks / Trevally (Carangidae)
  // =========================================================================
  {
    id: 'ulua',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Caranx ignobilis',
    hawaiianName: 'Ulua aukea',
    commonName: 'Giant Trevally (White Ulua)',
    family: 'Carangidae',
    description: 'The apex reef predator of Hawaii. Trophy species. "Ulua" denotes jacks over ~10 lbs.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '10" fork length (home use); 16" for sale',
    sizeLimitInches: 10,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    bagLimitNote: 'Combined bag limit of 20 fish/day for moi + mullet + all ulua species (in some managed areas)',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Encountered patrolling reef edges on all shores. Large specimens >40 lbs carry higher ciguatera risk.',
    habitatZones: ['south_shore', 'southwest', 'west', 'northwest', 'north', 'east'],
    nightDive: false,
    ciguateraRisk: 'moderate',
    edibility: 'good',
  },
  {
    id: 'omilu',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Caranx melampygus',
    hawaiianName: 'ʻŌmilu',
    commonName: 'Bluefin Trevally',
    family: 'Carangidae',
    description: 'Blue-finned jack. Aggressive reef predator. Excellent sport and table fish when small.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '10" fork length (home use); 16" for sale',
    sizeLimitInches: 10,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    bagLimitNote: 'Included in ulua group bag limits where applicable',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Common around reef edges and drop-offs. Medium ciguatera risk for large individuals.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'moderate',
    edibility: 'good',
  },
  {
    id: 'papio',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Caranx spp.',
    hawaiianName: 'Pāpio',
    commonName: 'Juvenile Jack/Trevally',
    family: 'Carangidae',
    description: 'Juvenile jacks of various species. Under ~10 lbs. Excellent eating with lower ciguatera risk than adults.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '10" fork length',
    sizeLimitInches: 10,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.THROW_NET],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Common in shallower reef areas. Popular target for throw-netters and spearos.',
    habitatZones: ['south_shore', 'southwest', 'west', 'east'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'excellent',
  },

  // =========================================================================
  // FISH - Snappers (Lutjanidae)
  // =========================================================================
  {
    id: 'uku',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Aprion virescens',
    hawaiianName: 'Uku',
    commonName: 'Gray Snapper (Green Jobfish)',
    family: 'Lutjanidae',
    description: 'Excellent table fish found near reef edges and deeper structure.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found near reef drop-offs. Excellent sashimi fish.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'excellent',
  },
  {
    id: 'toau',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Lutjanus fulvus',
    hawaiianName: 'Toʻau',
    commonName: 'Blacktail Snapper',
    family: 'Lutjanidae',
    description: 'Introduced species. Encouraged to harvest to reduce pressure on native reef fish.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Invasive. Harvest encouraged. Good eating.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'good',
    invasive: true,
  },
  {
    id: 'taape',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Lutjanus kasmira',
    hawaiianName: 'Taʻape',
    commonName: 'Bluestripe Snapper',
    family: 'Lutjanidae',
    description: 'Introduced species from Marquesas. Very abundant. Harvest encouraged.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.NET],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Invasive. Extremely abundant on Lanai reefs. Harvest strongly encouraged. Decent eating, somewhat bony.',
    habitatZones: ['south_shore', 'southwest', 'west', 'northwest', 'north', 'east'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'moderate',
    invasive: true,
  },

  // =========================================================================
  // FISH - Groupers (Serranidae)
  // =========================================================================
  {
    id: 'roi',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Cephalopholis argus',
    hawaiianName: 'Roi',
    commonName: 'Peacock Grouper',
    family: 'Serranidae',
    description: 'Introduced invasive grouper. Eats ~140 reef fish per year. Harvest strongly encouraged but carries significant ciguatera risk.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Invasive. Harvest encouraged. HIGH ciguatera risk, especially larger specimens. Many locals do not eat roi. Some tournaments promote harvest for reef health.',
    habitatZones: ['south_shore', 'southwest', 'west', 'northwest'],
    nightDive: false,
    ciguateraRisk: 'high',
    edibility: 'risky',
    invasive: true,
  },

  // =========================================================================
  // FISH - Threadfin (Polynemidae)
  // =========================================================================
  {
    id: 'moi',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Polydactylus sexfilis',
    hawaiianName: 'Moi',
    commonName: 'Pacific Threadfin (Sixfinger)',
    family: 'Polynemidae',
    description: 'Historically reserved for Hawaiian royalty (aliʻi). Sandy bottom nearshore fish. Spawning closure Jun-Aug.',
    closedMonths: [JUN, JUL, AUG],
    closedSeasonLabel: 'Jun-Aug',
    sizeLimit: '11" fork length',
    sizeLimitInches: 11,
    sizeMeasurement: 'Fork length',
    bagLimit: 15,
    bagLimitNote: '15 moi within a combined 20-fish daily limit for moi + mullet + ulua',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.THROW_NET],
    gearRestrictions: 'Typically caught by pole/line or throw net off sandy shores',
    lanaiNotes: 'Found off sandy beaches. Historically significant species (fish of kings).',
    habitatZones: ['south_shore', 'east'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },

  // =========================================================================
  // FISH - Mullet (Mugilidae)
  // =========================================================================
  {
    id: 'ama_ama',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Mugil cephalus',
    hawaiianName: 'ʻAmaʻama',
    commonName: 'Striped Mullet',
    family: 'Mugilidae',
    description: 'Culturally significant species raised in Hawaiian fishponds (loko iʻa). Winter spawning closure.',
    closedMonths: [DEC, JAN, FEB, MAR],
    closedSeasonLabel: 'Dec-Mar',
    sizeLimit: '11" fork length',
    sizeLimitInches: 11,
    sizeMeasurement: 'Fork length',
    bagLimit: 10,
    bagLimitNote: '10 mullet within a combined 20-fish daily limit for moi + mullet + ulua',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.THROW_NET, HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.NET],
    gearRestrictions: null,
    lanaiNotes: 'Not a spearfishing target. Found in nearshore sandy/muddy areas.',
    habitatZones: ['south_shore', 'east'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },

  // =========================================================================
  // FISH - Emperor (Lethrinidae)
  // =========================================================================
  {
    id: 'mu',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Monotaxis grandoculis',
    hawaiianName: 'Mū',
    commonName: 'Bigeye Emperor',
    family: 'Lethrinidae',
    description: 'Large-eyed emperor fish. Wary and difficult to approach. Prized table fish with molar-like teeth for crushing shells.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found near reef rubble and sand patches. Very wary; challenging spearfishing target.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'low',
    edibility: 'excellent',
  },

  // =========================================================================
  // FISH - Flagtail (Kuhliidae)
  // =========================================================================
  {
    id: 'aholehole',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Kuhlia sandvicensis',
    hawaiianName: 'Āholehole',
    commonName: 'Hawaiian Flagtail',
    family: 'Kuhliidae',
    description: 'Endemic Hawaiian flagtail. Silvery schooling fish found near surge zones and tidepools.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '5" fork length',
    sizeLimitInches: 5,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.POLE_AND_LINE, HARVEST_METHOD.THROW_NET],
    gearRestrictions: null,
    lanaiNotes: 'Found in surge zones and around rocky shoreline.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },

  // =========================================================================
  // FISH - Milkfish (Chanidae)
  // =========================================================================
  {
    id: 'awa',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Chanos chanos',
    hawaiianName: 'Awa',
    commonName: 'Milkfish',
    family: 'Chanidae',
    description: 'Traditionally raised in Hawaiian fishponds. Fast, silvery schooling fish.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '9" fork length',
    sizeLimitInches: 9,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.NET, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: null,
    lanaiNotes: 'Occasionally encountered nearshore. Not a primary spearfishing target.',
    habitatZones: [],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },

  // =========================================================================
  // FISH - Bonefish (Albulidae)
  // =========================================================================
  {
    id: 'oio',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Albula glossodonta',
    hawaiianName: 'ʻŌʻio',
    commonName: 'Bonefish',
    family: 'Albulidae',
    description: 'Prized game fish on shallow flats. Extremely bony but valued culturally.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: '14" fork length',
    sizeLimitInches: 14,
    sizeMeasurement: 'Fork length',
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'Typically catch-and-release sport fishing',
    lanaiNotes: 'Found on shallow sand flats. Not a spearfishing target.',
    habitatZones: ['east'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'poor',
  },

  // =========================================================================
  // FISH - Wrasse (Labridae)
  // =========================================================================
  {
    id: 'laenihi',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Iniistius pavo',
    hawaiianName: 'Laenihi',
    commonName: 'Peacock Wrasse (Nabeta)',
    family: 'Labridae',
    description: 'Also called nabeta (Japanese). Buries in sand when threatened. Widely considered one of the best-eating nearshore fish in Hawaii.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found over sandy bottom near reef edges. Premium table fish. Dives into sand to escape.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },

  // =========================================================================
  // FISH - Squirrelfish/Soldierfish (Holocentridae)
  // =========================================================================
  {
    id: 'menpachi',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Myripristis berndti',
    hawaiianName: 'Menpachi',
    commonName: 'Bigscale Soldierfish',
    family: 'Holocentridae',
    description: 'Nocturnal reef fish with large red eyes. Hides in caves and crevices by day. Excellent eating fried whole.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Found in reef caves and under ledges. Excellent for night spearfishing (freedive).',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'alaihi',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Sargocentron xantherythrum',
    hawaiianName: 'ʻAlāʻihi',
    commonName: 'Hawaiian Squirrelfish',
    family: 'Holocentridae',
    description: 'Endemic Hawaiian squirrelfish. Red and white striped. Nocturnal.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing',
    lanaiNotes: 'Endemic to Hawaii. Found in reef crevices.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'good',
  },

  // =========================================================================
  // FISH - Scorpionfish (Scorpaenidae)
  // =========================================================================
  {
    id: 'nohu',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Scorpaenopsis cacopsis',
    hawaiianName: 'Nohu',
    commonName: 'Titan Scorpionfish',
    family: 'Scorpaenidae',
    description: 'Extremely well-camouflaged ambush predator. VENOMOUS dorsal spines. Excellent eating when cleaned carefully.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: 'No SCUBA spearfishing. Handle with extreme care: venomous spines.',
    lanaiNotes: 'Found on reef rubble, extremely cryptic. Handle with extreme care. Delicious but dangerous to handle.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },

  // =========================================================================
  // FISH - Needlefish (Belonidae)
  // =========================================================================
  {
    id: 'aha',
    category: SPECIES_CATEGORY.FISH,
    latinName: 'Platybelone argalus',
    hawaiianName: 'ʻAha',
    commonName: 'Keeltail Needlefish',
    family: 'Belonidae',
    description: 'Long, slender surface predator. Can be dangerous at night (attracted to lights and may jump).',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.SPEAR, HARVEST_METHOD.POLE_AND_LINE],
    gearRestrictions: null,
    lanaiNotes: 'Surface predator. Caution during night dives with lights.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'moderate',
  },

  // =========================================================================
  // MOLLUSKS
  // =========================================================================
  {
    id: 'hee',
    category: SPECIES_CATEGORY.MOLLUSK,
    latinName: 'Octopus cyanea',
    hawaiianName: 'Heʻe',
    commonName: 'Day Octopus',
    family: 'Octopodidae',
    description: 'Primary octopus species harvested in Hawaii. Diurnal. Color-changing master of camouflage.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    bagLimitNote: 'Some managed areas limit to 2/day by hand/stick only',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.HAND, HARVEST_METHOD.SPEAR, HARVEST_METHOD.STICK],
    gearRestrictions: 'In some managed areas: hand harvest or stick (max 2 ft) only',
    lanaiNotes: 'Found on reef flats, especially south shore. Traditional Hawaiian harvest by hand or short stick. Cannot take inside MLCD.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },
  {
    id: 'hee_ornate',
    category: SPECIES_CATEGORY.MOLLUSK,
    latinName: 'Callistoctopus ornatus',
    hawaiianName: 'Heʻe',
    commonName: 'Ornate Octopus (Night Octopus)',
    family: 'Octopodidae',
    description: 'Nocturnal octopus species. Smaller than day octopus.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.HAND, HARVEST_METHOD.SPEAR],
    gearRestrictions: null,
    lanaiNotes: 'Active at night on reef flats.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: true,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
  {
    id: 'opihi',
    category: SPECIES_CATEGORY.MOLLUSK,
    latinName: 'Cellana spp.',
    hawaiianName: 'ʻOpihi',
    commonName: 'Hawaiian Limpet',
    family: 'Nacellidae',
    description: 'Three species: C. exarata (black foot/makaiauli), C. sandwicensis (yellowfoot/ālinalina), C. talcosa (kneecap/koʻele). Culturally significant shoreline harvest. Dangerous to collect (wave surge).',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    bagLimitNote: 'Some managed areas limit to 20 total opihi + pipipi + kūpeʻe combined per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Hand pick only. Dangerous: wave surge zones.',
    lanaiNotes: 'Found on exposed rocky shoreline. Collecting is dangerous due to wave action. Culturally important but populations declining.',
    habitatZones: ['south_shore', 'southwest', 'west', 'northwest', 'north', 'east'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'excellent',
  },

  // =========================================================================
  // ECHINODERMS
  // =========================================================================
  {
    id: 'wana',
    category: SPECIES_CATEGORY.ECHINODERM,
    latinName: 'Echinothrix diadema',
    hawaiianName: 'Wana',
    commonName: 'Banded Sea Urchin',
    family: 'Diadematidae',
    description: 'Long-spined urchin. Gonads (uni) are edible. Venomous spines.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    bagLimitNote: 'Some managed areas: 5 per species per day. Prohibited in MLCDs.',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Prohibited to take any sea urchin in MLCDs. Handle with care: venomous spines.',
    lanaiNotes: 'Cannot harvest inside Manele-Hulopo\'e MLCD. Found on reef throughout island. Uni (gonads) considered a delicacy.',
    habitatZones: ['south_shore', 'southwest', 'west'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
  {
    id: 'haukeuke',
    category: SPECIES_CATEGORY.ECHINODERM,
    latinName: 'Colobocentrotus atratus',
    hawaiianName: 'Hāʻukeʻuke',
    commonName: 'Shingle Urchin (Helmet Urchin)',
    family: 'Echinometridae',
    description: 'Flat-spined urchin adapted to high wave-energy zones. Traditional food item.',
    closedMonths: [],
    closedSeasonLabel: null,
    sizeLimit: null,
    sizeLimitInches: null,
    sizeMeasurement: null,
    bagLimit: null,
    bagLimitNote: 'Some managed areas: 5 per species per day',
    genderRestriction: null,
    harvestMethods: [HARVEST_METHOD.HAND],
    gearRestrictions: 'Prohibited in MLCDs',
    lanaiNotes: 'Found on wave-exposed rocky shoreline.',
    habitatZones: ['south_shore', 'southwest', 'west', 'northwest'],
    nightDive: false,
    ciguateraRisk: 'none',
    edibility: 'good',
  },
];

// ---------------------------------------------------------------------------
// Lanai-specific: Manele-Hulopo'e MLCD boundaries
// ---------------------------------------------------------------------------

export const MANELE_HULOPOE_MLCD = {
  name: 'Mānele-Hulopoʻe Marine Life Conservation District',
  established: 1976,
  acreage: 309,
  subzones: {
    A: {
      name: 'Subzone A (Hulopoʻe Bay)',
      description: 'Kaluakoʻi Point to Flat Rock to Puʻu Pehe Rock. Strictest protections.',
      restrictions: [
        'No fishing, taking, or injuring any marine life (except finfish or ʻaʻama crab by pole-and-line from shoreline only)',
        'No vessels (except manually-propelled Hawaiian outrigger canoes, no anchoring)',
        'No taking sand, coral, or geological specimens',
      ],
    },
    B: {
      name: 'Subzone B (Mānele Bay)',
      description: 'Puʻu Pehe Rock to Kalaeokahano Point. Includes Mānele Boat Harbor.',
      restrictions: [
        'Pole-and-line from shoreline for finfish and ʻaʻama crab only',
        'No spearfishing',
        'No taking of invertebrates (except ʻaʻama crab by hand)',
        'Legal gear while on vessel transiting harbor channel permitted but gear may not be in water',
      ],
    },
  },
  permittedGear: [
    'Pole-and-line (shoreline only)',
    'One knife',
    'One hand net (frame max 3 ft diameter)',
  ],
  note: 'First Cathedrals dive site is just outside the western MLCD boundary near Puʻu Pehe Rock.',
};

// ---------------------------------------------------------------------------
// Utility: Get species relevant to a specific zone
// ---------------------------------------------------------------------------

/**
 * Get species commonly found in a specific zone.
 * @param {string} zoneId - Zone ID from zones.js
 * @returns {Object[]} Array of species objects
 */
export function getSpeciesForZone(zoneId) {
  return SPECIES.filter(s => s.habitatZones.includes(zoneId));
}

/**
 * Get species that are both in season AND found in a given zone.
 * @param {string} zoneId
 * @param {Date} [date=new Date()]
 * @returns {Object[]}
 */
export function getHarvestableSpeciesForZone(zoneId, date = new Date()) {
  return SPECIES.filter(s => {
    if (!s.habitatZones.includes(zoneId)) return false;
    const { status } = getSeasonStatus(s, date);
    return status !== SEASON_STATUS.CLOSED;
  });
}

/**
 * Check if any lobster species are in season.
 * @param {Date} [date=new Date()]
 * @returns {{ inSeason: boolean, species: Object[], closedUntil: Date|null }}
 */
export function getLobsterSeasonStatus(date = new Date()) {
  const lobsters = SPECIES.filter(s => s.id.startsWith('lobster_'));
  const open = lobsters.filter(s => getSeasonStatus(s, date).status !== SEASON_STATUS.CLOSED);
  const closedInfo = lobsters.length > 0 ? getSeasonStatus(lobsters[0], date) : null;

  return {
    inSeason: open.length > 0,
    species: open,
    closedUntil: open.length === 0 && closedInfo ? closedInfo.nextChange : null,
  };
}
