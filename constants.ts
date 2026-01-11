// Master pool of strings from High to Low
// 8-string range: F3 down to F#0
const STRING_POOL = [
  { name: 'F', note: 'F3', freq: 174.61 },
  { name: 'C', note: 'C3', freq: 130.81 },
  { name: 'G', note: 'G2', freq: 98.00 },
  { name: 'D', note: 'D2', freq: 73.42 },
  { name: 'A', note: 'A1', freq: 55.00 },
  { name: 'E', note: 'E1', freq: 41.20 },
  { name: 'B', note: 'B0', freq: 30.87 },
  { name: 'F#', note: 'F#0', freq: 23.12 },
];

export const getTuning = (count: number) => {
  // 4 strings: G, D, A, E (Standard)
  // 5 strings: G, D, A, E, B (Low B)
  // 6 strings: C, G, D, A, E, B (High C, Low B)
  // 7 strings: F, C, G, D, A, E, B (High F, Low B)
  // 8 strings: F, C, G, D, A, E, B, F# (High F, Low F#)
  
  const clamped = Math.max(4, Math.min(8, count));
  
  switch (clamped) {
      case 4: return STRING_POOL.slice(2, 6);
      case 5: return STRING_POOL.slice(2, 7);
      case 6: return STRING_POOL.slice(1, 7);
      case 7: return STRING_POOL.slice(0, 7);
      case 8: return STRING_POOL.slice(0, 8);
      default: return STRING_POOL.slice(0, 7);
  }
};

// Default constants for fallback
export const DEFAULT_TUNING = getTuning(7);
export const DEFAULT_FRET_COUNT = 12;

export const MARKERS = [3, 5, 7, 9, 12, 15];

export const NUT_WIDTH_PERCENT = 8; // The "open string" zone percentage