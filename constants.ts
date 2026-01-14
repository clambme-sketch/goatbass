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
  // Configuration: Chart/Tablature Perspective
  // Index 0 (Top of Screen) = Highest Pitch (Thinnest String)
  // Index N (Bottom of Screen) = Lowest Pitch (Thickest String)
  
  const clamped = Math.max(4, Math.min(8, count));
  
  // We slice from the pool (High -> Low).
  // Index 0 will be the highest note in the set.
  // Last Index will be the lowest note (B or E).
  switch (clamped) {
      case 4: return STRING_POOL.slice(2, 6); // G, D, A, E
      case 5: return STRING_POOL.slice(2, 7); // G, D, A, E, B
      case 6: return STRING_POOL.slice(1, 7); // C, G, D, A, E, B
      case 7: return STRING_POOL.slice(0, 7);
      case 8: return STRING_POOL.slice(0, 8);
      default: return STRING_POOL.slice(1, 7);
  }
};

// Default constants for fallback
export const DEFAULT_TUNING = getTuning(6);
export const DEFAULT_FRET_COUNT = 12;

export const MARKERS = [3, 5, 7, 9, 12, 15];

export const NUT_WIDTH_PERCENT = 8; // The "open string" zone percentage