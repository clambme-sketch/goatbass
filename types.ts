export interface AudioSettings {
  // Mixer
  volume: number;
  
  // Pre-Amp / EQ
  distortion: number; // Drive
  eqBass: number; // dB -10 to +10
  eqMid: number; // dB -10 to +10
  eqTreble: number; // dB -10 to +10

  // Dynamics (Compressor)
  compressorThreshold: number; // dB -60 to 0
  compressorRatio: number; // 1 to 20

  // Filter
  tone: number; // Cutoff
  filterResonance: number; // Q factor
  filterEnvAmount: number; // Hz to modulate cutoff by velocity/envelope

  // Envelope / Performance
  attack: number;
  release: number;
  sustain: number; // 0-1
  glideTime: number; // Portamento time in seconds
  velocitySensitivity: number; // 0-1
  isMonophonic: boolean; // True = 1 note per string (Real bass), False = Polyphonic (Tapping/Pad)
  
  // Sources
  waveform: 'sawtooth' | 'square' | 'triangle';
  subLevel: number; // Sub Osc Volume
  noiseLevel: number; // String Noise Volume

  // Effects
  phaserMix: number; // 0-1
  phaserRate: number; // Hz
  tremoloDepth: number; // 0-1
  tremoloRate: number; // Hz
  
  chorus: number; // Mix
  reverb: number; // Mix
  vibrato: number; // Depth
  delayMix: number; // Mix
  delayTime: number; // Seconds
  delayFeedback: number; // 0-0.9
  stereoWidth: number; // 0-1
  octavePedal: boolean; 
  octaveShift: boolean;

  // System
  showNotes: boolean;
  vibrationIntensity: number; 
  theme: 'classic' | 'flux' | 'terminal' | 'vintage' | 'neon' | 'crystal'; 
  stringCount: number;
  fretCount: number;
}

export interface ActiveTouch {
  id: number;
  stringIndex: number;
  startX: number;
  currentX: number;
  freq: number;
  noteId: string; 
}

export type PresetName = 'Modern' | 'Jazz' | 'Precision' | 'Synth' | 'Upright' | 'Soloist' | 'Dub' | 'Fuzz' | 'Ethereal' | 'Psychedelic';