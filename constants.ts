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
  // 4 strings: E, A, D, G (Standard) - Reversed from Pool
  // 5 strings: B, E, A, D, G (Low B)
  // 6 strings: B, E, A, D, G, C (Low B, High C)
  
  const clamped = Math.max(4, Math.min(8, count));
  
  // Slice from pool (High -> Low). 
  // We reverse to get Low -> High (Top -> Bottom on screen) to match player perspective (Low string closest to head)
  switch (clamped) {
      case 4: return STRING_POOL.slice(2, 6).reverse(); // G, D, A, E -> E, A, D, G
      case 5: return STRING_POOL.slice(2, 7).reverse(); // G, D, A, E, B -> B, E, A, D, G
      case 6: return STRING_POOL.slice(1, 7).reverse(); // C, G, D, A, E, B -> B, E, A, D, G, C
      case 7: return STRING_POOL.slice(0, 7).reverse();
      case 8: return STRING_POOL.slice(0, 8).reverse();
      default: return STRING_POOL.slice(1, 7).reverse();
  }
};

// Default constants for fallback
export const DEFAULT_TUNING = getTuning(6);
export const DEFAULT_FRET_COUNT = 12;

export const MARKERS = [3, 5, 7, 9, 12, 15];

export const NUT_WIDTH_PERCENT = 8; // The "open string" zone percentage