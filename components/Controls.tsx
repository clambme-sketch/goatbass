import React, { useState, useRef } from 'react';
import { AudioSettings, PresetName } from '../types';
import { audioEngine } from '../services/AudioEngine';

interface ControlsProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AudioSettings;
  setSettings: React.Dispatch<React.SetStateAction<AudioSettings>>;
}

// Default values for audio parameters to reset to before applying a preset.
const DEFAULT_PATCH_STATE: Partial<AudioSettings> = {
    // Mixer / Preamp
    volume: 0.85, distortion: 0, stereoWidth: 0.5,
    eqBass: 0, eqMid: 0, eqTreble: 0,
    compressorThreshold: -20, compressorRatio: 4,
    
    // Synthesis
    waveform: 'sawtooth', subLevel: 0, noiseLevel: 0,
    tone: 0.5, filterResonance: 0, filterEnvAmount: 0,
    attack: 0.01, release: 0.2, sustain: 1.0, glideTime: 0.05,
    velocitySensitivity: 0.5,
    octavePedal: false, octaveShift: false,
    isMonophonic: false,

    // Effects
    phaserMix: 0, phaserRate: 1,
    tremoloDepth: 0, tremoloRate: 4,
    chorus: 0, reverb: 0, vibrato: 0,
    delayMix: 0, delayTime: 0.3, delayFeedback: 0.3,
};

const PRESETS: Record<PresetName, Partial<AudioSettings>> = {
  'Modern': {
    waveform: 'sawtooth',
    tone: 0.85,
    filterResonance: 0.2,
    filterEnvAmount: 0.3,
    distortion: 0.15,
    compressorThreshold: -25, compressorRatio: 4,
    eqBass: 2, eqMid: -2, eqTreble: 4,
    chorus: 0.1, reverb: 0.15, delayMix: 0,
    glideTime: 0.05,
    sustain: 1.0,
    subLevel: 0.2,
    attack: 0.01, release: 0.3,
  },
  'Jazz': {
    waveform: 'sawtooth',
    tone: 0.4,
    filterResonance: 0.0,
    distortion: 0.05,
    compressorThreshold: -15, compressorRatio: 2,
    eqBass: 4, eqMid: 2, eqTreble: -5,
    chorus: 0.2, reverb: 0.2,
    glideTime: 0.1,
    sustain: 0.8,
    attack: 0.03, release: 0.4,
  },
  'Precision': {
    waveform: 'square',
    tone: 0.5,
    distortion: 0.1,
    compressorThreshold: -20, compressorRatio: 8,
    eqBass: 3, eqMid: 4, eqTreble: 0,
    reverb: 0.1,
    sustain: 0.4, // Foam mute
    glideTime: 0.02,
    attack: 0.02, release: 0.15,
    stereoWidth: 0.1,
  },
  'Synth': {
    waveform: 'sawtooth',
    tone: 0.3,
    filterResonance: 0.5,
    filterEnvAmount: 0.6,
    distortion: 0.15,
    compressorThreshold: -25, compressorRatio: 5,
    eqBass: 4, eqMid: 1, eqTreble: 3,
    chorus: 0.3, reverb: 0.2, delayMix: 0,
    sustain: 0.9,
    subLevel: 0.8,
    attack: 0.01, release: 0.2,
    glideTime: 0.08,
    octavePedal: true,
  },
  'Upright': {
    waveform: 'triangle',
    tone: 0.2,
    distortion: 0.05,
    compressorThreshold: -10, compressorRatio: 2,
    eqBass: 5, eqMid: -2, eqTreble: -10,
    reverb: 0.3,
    sustain: 0.15,
    glideTime: 0.15,
    noiseLevel: 0.3,
    attack: 0.06, release: 0.3,
  },
  'Soloist': {
    waveform: 'sawtooth',
    tone: 0.75,
    filterResonance: 0.4,
    distortion: 0.1,
    compressorThreshold: -20, compressorRatio: 4,
    chorus: 0.4, reverb: 0.6, delayMix: 0.25,
    vibrato: 0.4,
    glideTime: 0.08,
    sustain: 1.0,
    attack: 0.04, release: 0.5,
  },
  'Dub': {
    waveform: 'triangle',
    tone: 0.1,
    distortion: 0.05,
    compressorThreshold: -20, compressorRatio: 10,
    eqBass: 10, eqMid: -5, eqTreble: -10,
    reverb: 0.2, delayMix: 0.4, delayTime: 0.6, delayFeedback: 0.5,
    sustain: 0.8,
    subLevel: 1.0,
    attack: 0.02, release: 0.2,
  },
  'Fuzz': {
    waveform: 'square',
    tone: 0.8,
    distortion: 0.8,
    compressorThreshold: -40, compressorRatio: 12,
    eqBass: 2, eqMid: 5, eqTreble: 2,
    reverb: 0.1,
    sustain: 1.0,
    attack: 0.01, release: 0.3,
  },
  'Ethereal': {
    waveform: 'sawtooth',
    tone: 0.6,
    filterResonance: 0.1,
    distortion: 0.0,
    compressorThreshold: -20, compressorRatio: 2,
    chorus: 0.6, reverb: 0.7, delayMix: 0.5, delayTime: 0.8, delayFeedback: 0.7,
    eqBass: -2, eqMid: 0, eqTreble: 5,
    attack: 0.2, release: 2.0, sustain: 1.0,
    vibrato: 0.2,
    stereoWidth: 1.0
  },
  'Psychedelic': {
      waveform: 'sawtooth',
      tone: 0.7,
      phaserMix: 0.7, phaserRate: 0.5,
      tremoloDepth: 0.6, tremoloRate: 4,
      distortion: 0.3,
      reverb: 0.5, delayMix: 0.3,
      glideTime: 0.1,
      attack: 0.05, release: 0.5
  }
};

type Tab = 'preamp' | 'synthesis' | 'effects' | 'system';

export const Controls: React.FC<ControlsProps> = ({ isOpen, onClose, settings, setSettings }) => {
  const [activeTab, setActiveTab] = useState<Tab>('preamp');
  
  if (!isOpen) return null;

  const theme = settings.theme;
  const isFlux = theme === 'flux';
  const isTerminal = theme === 'terminal';
  const isVintage = theme === 'vintage';
  const isNeon = theme === 'neon';
  const isCrystal = theme === 'crystal';

  const updateSetting = (key: keyof AudioSettings, value: number | string | boolean) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    audioEngine.updateSettings(newSettings);
  };

  const loadPreset = (name: PresetName) => {
    const preset = PRESETS[name];
    const newSettings = { 
        ...settings, 
        ...DEFAULT_PATCH_STATE, 
        ...preset 
    };
    setSettings(newSettings);
    audioEngine.updateSettings(newSettings);
  };

  // --- UI Components ---

  const Slider = ({ label, value, min, max, step, onChange, unit = '', vertical = false }: any) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const percentage = ((value - min) / (max - min)) * 100;

    const handlePointerDown = (e: React.PointerEvent) => {
        e.preventDefault(); 
        const node = trackRef.current;
        if (node) {
            node.setPointerCapture(e.pointerId);
            calculateAndOnChange(e);
        }
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        const node = trackRef.current;
        if (node && node.hasPointerCapture(e.pointerId)) {
             e.preventDefault();
             calculateAndOnChange(e);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        const node = trackRef.current;
        if (node && node.hasPointerCapture(e.pointerId)) {
             node.releasePointerCapture(e.pointerId);
        }
    };

    const calculateAndOnChange = (e: React.PointerEvent) => {
         const node = trackRef.current;
         if (!node) return;
         const rect = node.getBoundingClientRect();
         
         let percent = 0;
         if (vertical) {
             // Bottom is 0%, Top is 100%
             // y goes down (increases) from top. 
             // rect.height is at bottom relative to top.
             // distance from bottom = rect.height - (e.clientY - rect.top)
             const relativeY = e.clientY - rect.top;
             const fromBottom = rect.height - relativeY;
             percent = Math.max(0, Math.min(1, fromBottom / rect.height));
         } else {
             // Left is 0%, Right is 100%
             const relativeX = e.clientX - rect.left;
             percent = Math.max(0, Math.min(1, relativeX / rect.width));
         }

         let newValue = min + (percent * (max - min));
         if (step) {
             newValue = Math.round(newValue / step) * step;
         }
         // Clamp
         newValue = Math.max(min, Math.min(max, newValue));

         onChange({ target: { value: newValue } });
    };

    const containerProps = {
        ref: trackRef,
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        // Ensure browser doesn't scroll while dragging
        style: { touchAction: 'none' } as React.CSSProperties
    };

    // Modern / Flux Look
    if (isFlux) {
        return (
            <div className={`relative group ${vertical ? 'h-40 w-12 mx-auto' : 'w-full py-2'}`}>
                {!vertical && (
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-[10px] font-bold text-cyan-200 uppercase tracking-widest truncate mr-2 drop-shadow-sm">{label}</label>
                        <span className="text-[10px] font-mono text-cyan-400 drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">{typeof value === 'number' && unit === '%' ? Math.round(value * 100) : value}{unit}</span>
                    </div>
                )}
                <div 
                    {...containerProps}
                    className={`relative bg-slate-900 border border-slate-700 rounded-full shadow-inner cursor-pointer ${vertical ? 'h-full w-2 mx-auto' : 'h-2 w-full'}`}
                >
                    <div className={`absolute bg-cyan-500 shadow-[0_0_10px_cyan] rounded-full pointer-events-none ${vertical ? 'bottom-0 w-full' : 'h-full'}`} style={vertical ? { height: `${percentage}%` } : { width: `${percentage}%` }}></div>
                    <div 
                        className={`absolute w-4 h-4 bg-cyan-950 border border-cyan-400 rounded-full shadow-[0_0_15px_rgba(6,182,212,0.8)] pointer-events-none hover:scale-125 transition-transform
                            ${vertical ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2'}
                        `}
                        style={vertical ? { bottom: `calc(${percentage}% - 8px)` } : { left: `calc(${percentage}% - 8px)` }}
                    >
                        <div className="absolute inset-0 bg-cyan-400 opacity-20 rounded-full animate-pulse"></div>
                    </div>
                </div>
                {vertical && <div className="text-[9px] text-center mt-3 text-cyan-400 font-bold tracking-wider">{label}</div>}
            </div>
        );
    } 

    // Neon Look
    if (isNeon) {
        return (
            <div className={`relative group ${vertical ? 'h-40 w-12 mx-auto' : 'w-full py-2'}`}>
                {!vertical && (
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-[10px] font-bold text-fuchsia-400 uppercase tracking-widest truncate mr-2 drop-shadow-[0_0_2px_rgba(232,121,249,0.8)]">{label}</label>
                        <span className="text-[10px] font-mono text-purple-200 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">{typeof value === 'number' && unit === '%' ? Math.round(value * 100) : value}{unit}</span>
                    </div>
                )}
                <div 
                    {...containerProps}
                    className={`relative bg-purple-950 border border-fuchsia-900 rounded shadow-inner cursor-pointer ${vertical ? 'h-full w-2 mx-auto' : 'h-2 w-full'}`}
                >
                    <div className={`absolute bg-gradient-to-r from-fuchsia-600 to-purple-600 shadow-[0_0_8px_#d946ef] rounded pointer-events-none ${vertical ? 'bottom-0 w-full bg-gradient-to-t' : 'h-full'}`} style={vertical ? { height: `${percentage}%` } : { width: `${percentage}%` }}></div>
                    <div 
                        className={`absolute w-4 h-4 bg-black border-2 border-fuchsia-500 rounded-sm shadow-[0_0_10px_#d946ef] pointer-events-none rotate-45 hover:scale-125 transition-transform
                            ${vertical ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2'}
                        `}
                        style={vertical ? { bottom: `calc(${percentage}% - 8px)` } : { left: `calc(${percentage}% - 8px)` }}
                    ></div>
                </div>
                {vertical && <div className="text-[9px] text-center mt-3 text-fuchsia-400 font-bold tracking-wider">{label}</div>}
            </div>
        );
    }

    // Crystal Look (Light Mode)
    if (isCrystal) {
        return (
             <div className={`relative group ${vertical ? 'h-40 w-12 mx-auto' : 'w-full py-2'}`}>
                {!vertical && (
                    <div className="flex justify-between items-end mb-2">
                        <label className="text-[10px] font-bold text-slate-600 uppercase tracking-widest truncate mr-2">{label}</label>
                        <span className="text-[10px] font-mono font-bold text-indigo-700">{typeof value === 'number' && unit === '%' ? Math.round(value * 100) : value}{unit}</span>
                    </div>
                )}
                <div 
                    {...containerProps}
                    className={`relative bg-slate-200/60 rounded-full shadow-[inset_0_1px_3px_rgba(0,0,0,0.1)] backdrop-blur-sm cursor-pointer ${vertical ? 'h-full w-2 mx-auto' : 'h-2 w-full'}`}
                >
                    <div className={`absolute bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full pointer-events-none ${vertical ? 'bottom-0 w-full bg-gradient-to-t' : 'h-full'}`} style={vertical ? { height: `${percentage}%` } : { width: `${percentage}%` }}></div>
                    <div 
                        className={`absolute w-4 h-4 bg-white border border-white shadow-[0_2px_5px_rgba(0,0,0,0.15)] rounded-full pointer-events-none hover:scale-125 transition-transform flex items-center justify-center
                            ${vertical ? 'left-1/2 -translate-x-1/2' : 'top-1/2 -translate-y-1/2'}
                        `}
                        style={vertical ? { bottom: `calc(${percentage}% - 8px)` } : { left: `calc(${percentage}% - 8px)` }}
                    >
                         <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                    </div>
                </div>
                {vertical && <div className="text-[9px] text-center mt-3 text-slate-600 font-bold tracking-wider">{label}</div>}
            </div>
        )
    }
    
    // Default / Vintage Look
    return (
        <div className={`relative ${vertical ? 'flex flex-col items-center h-48' : 'space-y-2'}`}>
             {!vertical && <div className="flex justify-between items-center px-1">
                <label className={`text-[10px] font-black uppercase tracking-widest ${isVintage ? 'text-[#3d2e1e] font-serif drop-shadow-sm' : 'text-stone-400'}`}>{label}</label>
                <span className={`text-[10px] font-mono font-bold ${isVintage ? 'text-[#3d2e1e]' : 'text-stone-500'}`}>{typeof value === 'number' && unit === '%' ? Math.round(value * 100) : value}{unit}</span>
            </div>}
            
            <div 
                {...containerProps}
                className={`relative rounded shadow-inner border-b border-white/5 cursor-pointer ${
                vertical 
                ? 'h-full w-4' 
                : 'h-3 w-full'
            } ${isVintage ? 'bg-[#000] border-[#333] shadow-[0_1px_1px_rgba(255,255,255,0.2)]' : 'bg-[#080808] border-stone-800'}`}>
                
                <div 
                    className={`absolute rounded-sm shadow-[0_4px_6px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.2)] flex items-center justify-center pointer-events-none 
                    ${isVintage 
                        ? 'bg-gradient-to-b from-[#4a3b2a] to-[#1e160e] border border-[#1e160e] shadow-[0_2px_5px_rgba(0,0,0,0.8)]' 
                        : 'bg-gradient-to-b from-stone-500 to-stone-800 border border-black'}
                    ${vertical ? 'left-[-12px] right-[-12px] h-8' : 'top-[-10px] bottom-[-10px] w-8'}
                    `}
                    style={vertical ? { bottom: `calc(${percentage}% - 16px)` } : { left: `calc(${percentage}% - 16px)` }}
                >
                    <div className={`flex ${vertical ? 'flex-col gap-0.5 w-full items-center' : 'gap-0.5 h-full justify-center'}`}>
                        {isVintage && <div className="absolute inset-0 bg-white/5 rounded-sm"></div>}
                        <div className={`${vertical ? 'w-full h-px' : 'h-full w-px'} bg-black/40`}></div>
                        <div className={`${vertical ? 'w-full h-px' : 'h-full w-px'} bg-black/40`}></div>
                        <div className={`${vertical ? 'w-full h-px' : 'h-full w-px'} bg-white/20`}></div>
                    </div>
                </div>
            </div>
            {vertical && <label className={`mt-3 text-[9px] font-black uppercase tracking-widest font-serif ${isVintage ? 'text-[#3d2e1e]' : 'text-stone-500'}`}>{label}</label>}
        </div>
    );
  };

  const ToggleBtn = ({ label, active, onClick }: any) => {
      let activeClass = '';
      if (isFlux) {
          activeClass = active ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_15px_cyan]' : 'bg-slate-900 text-slate-500 border-slate-800';
      } else if (isVintage) {
          activeClass = active ? 'bg-[#f7e7ce] text-[#3d2e1e] border-[#b08d55] shadow-[0_0_10px_#f7e7ce,inset_0_0_5px_white]' : 'bg-[#3b2b20] text-[#a89078] border-[#5c4b3a]';
      } else if (isNeon) {
          activeClass = active ? 'bg-fuchsia-700 text-white border-fuchsia-400 shadow-[0_0_15px_#d946ef]' : 'bg-black text-fuchsia-900 border-fuchsia-900/50';
      } else if (isCrystal) {
          activeClass = active ? 'bg-white text-indigo-700 border-white shadow-[0_2px_10px_rgba(0,0,0,0.1)]' : 'bg-slate-100 text-slate-500 border-transparent';
      } else {
          activeClass = active ? 'bg-white text-black border-white shadow-[0_0_10px_white]' : 'bg-[#222] text-stone-500 border-stone-700';
      }

      return (
          <button onClick={onClick} className={`p-4 rounded border text-[10px] font-bold uppercase tracking-wider transition-all duration-200 active:scale-95 ${activeClass}`}>
              {label}
              {active && <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>}
          </button>
      )
  };

  const TabButton = ({ id, label }: { id: Tab, label: string }) => {
      const isActive = activeTab === id;
      let style = '';

      if (isFlux) {
          style = isActive ? 'text-cyan-400 border-b-2 border-cyan-400 bg-cyan-950/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]' : 'text-slate-500 border-b-2 border-transparent hover:text-slate-300';
      } else if (isVintage) {
          style = isActive ? 'text-[#2a1d12] border-b-2 border-[#b08d55] bg-gradient-to-b from-[#e6dcc3] to-[#d1c4a7] shadow-sm' : 'text-[#5c4b3a] border-transparent hover:text-[#3d2e1e] hover:bg-[#d1c4a7]/50';
      } else if (isNeon) {
          style = isActive ? 'text-fuchsia-300 border-b-2 border-fuchsia-500 bg-fuchsia-900/20 shadow-[0_0_15px_rgba(217,70,239,0.3)]' : 'text-purple-700 border-transparent hover:text-fuchsia-500';
      } else if (isCrystal) {
          style = isActive ? 'text-indigo-600 border-b-2 border-indigo-400 bg-white/40' : 'text-slate-400 border-b-2 border-transparent hover:text-slate-600';
      } else {
          style = isActive ? 'text-white border-b-2 border-white bg-white/10' : 'text-stone-500 border-transparent hover:text-stone-300 bg-black/20';
      }
      
      return (
        <button 
            onClick={() => setActiveTab(id)}
            className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest transition-all ${style}`}
        >
            {label}
        </button>
      );
  }

  // --- LAYOUT ---

  let containerClass = '';
  if (isFlux) containerClass = 'bg-slate-950/80 backdrop-blur-2xl border border-cyan-500/20 text-slate-200 shadow-[0_0_50px_rgba(0,0,0,0.5)]';
  else if (isTerminal) containerClass = 'bg-black/95 border-2 border-green-900 text-green-500 shadow-[0_0_30px_rgba(0,50,0,0.5)]';
  else if (isVintage) containerClass = 'bg-[#d8cba8] border-[12px] border-[#5c4033] shadow-[0_20px_60px_rgba(0,0,0,0.7)] text-[#3d2e1e]';
  else if (isNeon) containerClass = 'bg-black/90 border-2 border-fuchsia-600 text-fuchsia-200 shadow-[0_0_40px_rgba(217,70,239,0.4)]';
  else if (isCrystal) containerClass = 'bg-slate-50/95 backdrop-blur-2xl border border-white/60 text-slate-700 shadow-[0_20px_60px_rgba(0,0,0,0.1),inset_0_0_0_1px_rgba(255,255,255,0.8)]';
  else containerClass = 'bg-[#151515] border-t border-white/10 shadow-2xl text-stone-200';

  const vintagePattern = isVintage ? {
      backgroundImage: `
        repeating-linear-gradient(45deg, rgba(160, 130, 80, 0.15) 2px, transparent 2px, transparent 4px),
        repeating-linear-gradient(-45deg, rgba(160, 130, 80, 0.15) 2px, transparent 2px, transparent 4px),
        linear-gradient(to bottom, #d8cba8, #cfc098)
      `
  } : {};

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-2 md:p-12 bg-black/70 backdrop-blur-sm transition-opacity duration-300">
      <div 
        className={`w-full max-w-5xl h-[95vh] md:max-h-[850px] flex flex-col overflow-hidden ${!isTerminal ? 'rounded-xl' : ''} ${containerClass}`}
        style={vintagePattern}
      >
        
        {/* HEADER */}
        <div className={`p-5 flex justify-between items-center shrink-0 
            ${isVintage ? 'bg-[#3b2b20] border-b-4 border-[#5c4033] shadow-md' 
            : isNeon ? 'bg-purple-950/50 border-b border-fuchsia-600'
            : isCrystal ? 'bg-white/60 border-b border-white/60'
            : 'bg-black/20 border-b border-white/5'}`}>
             <div className="flex items-center gap-3">
                 <div className={`w-3 h-3 rounded-full animate-pulse 
                    ${isFlux ? 'bg-cyan-500' 
                    : isTerminal ? 'bg-green-500' 
                    : isVintage ? 'bg-[#ff0000] shadow-[0_0_10px_red]' 
                    : isNeon ? 'bg-fuchsia-500 shadow-[0_0_10px_#d946ef]'
                    : isCrystal ? 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                    : 'bg-red-500'}`}></div>
                 <h2 className={`text-xl font-black tracking-[0.2em] uppercase 
                    ${isVintage ? 'text-[#e6dcc3] font-serif tracking-widest' 
                    : isNeon ? 'text-transparent bg-clip-text bg-gradient-to-r from-fuchsia-400 to-purple-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.8)]'
                    : isCrystal ? 'text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-violet-500'
                    : ''}`}>
                    {isFlux ? 'System // Config' : isTerminal ? 'ROOT_ACCESS' : isVintage ? 'Amplifier Unit' : isCrystal ? 'Prism Core' : isNeon ? 'CYBER_CORE' : 'Rack Unit'}
                 </h2>
             </div>
             <button onClick={onClose} className={`p-2 opacity-60 hover:opacity-100 hover:scale-110 transition-transform ${isVintage ? 'text-[#e6dcc3]' : ''}`}><svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>

        {/* TABS */}
        <div className={`flex shrink-0 ${isVintage ? 'bg-[#c5b595] border-b border-[#a89878]' : ''}`}>
            <TabButton id="preamp" label="Pre-Amp" />
            <TabButton id="synthesis" label="Synthesis" />
            <TabButton id="effects" label="Effects" />
            <TabButton id="system" label="System" />
        </div>

        {/* SCROLLABLE CONTENT AREA */}
        <div className={`flex-1 overflow-y-auto p-6 md:p-10 ${isVintage ? "bg-black/5" : ''}`}>
            
            {/* --- TAB: PRE-AMP (Tone, EQ, Drive) --- */}
            {activeTab === 'preamp' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Master & Drive */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <div className="space-y-8">
                            <div className="space-y-6">
                                <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-4 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Input Stage</h3>
                                <Slider label="Master Volume" value={settings.volume} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('volume', parseFloat(e.target.value))} />
                                <Slider label="Tube Gain" value={settings.distortion} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('distortion', parseFloat(e.target.value))} />
                                <Slider label="Stereo Width" value={settings.stereoWidth} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('stereoWidth', parseFloat(e.target.value))} />
                            </div>
                            {/* Compressor Mini */}
                             <div className={`p-6 rounded-lg border ${isVintage ? 'bg-[#e0d6c2] border-[#a89878] shadow-inner' : isCrystal ? 'border-white bg-white/60 shadow-sm' : isNeon ? 'border-fuchsia-900 bg-purple-900/20' : 'bg-white/5 border-white/5'}`}>
                                <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-6 text-center ${isVintage ? 'text-[#3d2e1e] opacity-40' : isCrystal ? 'text-slate-500 opacity-80' : 'opacity-40'}`}>Dynamics</h3>
                                <div className="grid grid-cols-2 gap-8">
                                    <Slider label="Threshold" value={settings.compressorThreshold} min={-60} max={0} step={1} unit="dB" onChange={(e: any) => updateSetting('compressorThreshold', parseFloat(e.target.value))} />
                                    <Slider label="Ratio" value={settings.compressorRatio} min={1} max={20} step={0.5} unit=":1" onChange={(e: any) => updateSetting('compressorRatio', parseFloat(e.target.value))} />
                                </div>
                            </div>
                        </div>

                        {/* 3-Band EQ Graphic */}
                        <div className={`p-6 rounded-xl border h-full flex flex-col ${isVintage ? 'bg-[#e0d6c2] border-[#a89878] shadow-inner' : isCrystal ? 'border-white bg-white/60 shadow-sm' : isNeon ? 'border-fuchsia-900 bg-purple-900/20' : 'bg-black/40 border-white/10'}`}>
                            <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-6 text-center ${isVintage ? 'text-[#3d2e1e] opacity-60' : isCrystal ? 'text-slate-500 opacity-80' : 'opacity-60'}`}>Tone Stack</h3>
                            <div className="flex-1 flex justify-between items-center px-4 md:px-8 gap-4">
                                <Slider vertical label="Bass" value={settings.eqBass} min={-10} max={10} step={1} unit="dB" onChange={(e: any) => updateSetting('eqBass', parseFloat(e.target.value))} />
                                <Slider vertical label="Middle" value={settings.eqMid} min={-10} max={10} step={1} unit="dB" onChange={(e: any) => updateSetting('eqMid', parseFloat(e.target.value))} />
                                <Slider vertical label="Treble" value={settings.eqTreble} min={-10} max={10} step={1} unit="dB" onChange={(e: any) => updateSetting('eqTreble', parseFloat(e.target.value))} />
                            </div>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-6">
                         <ToggleBtn label="Octave Pedal" active={settings.octavePedal} onClick={() => updateSetting('octavePedal', !settings.octavePedal)} />
                         <ToggleBtn label="Shift +12" active={settings.octaveShift} onClick={() => updateSetting('octaveShift', !settings.octaveShift)} />
                    </div>
                </div>
            )}

            {/* --- TAB: SYNTHESIS (Wave, Filter, Envelope) --- */}
            {activeTab === 'synthesis' && (
                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                     {/* Oscillator */}
                     <div>
                        <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-4 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Oscillator Core</h3>
                        <div className="flex gap-4 mb-8">
                            {['sawtooth', 'square', 'triangle'].map(wf => (
                                <button 
                                    key={wf} 
                                    onClick={() => updateSetting('waveform', wf)}
                                    className={`flex-1 py-6 text-xs font-black uppercase rounded-lg border-2 transition-all shadow-lg active:scale-95 ${
                                        settings.waveform === wf 
                                        ? (isFlux ? 'bg-cyan-600 text-white border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)]' 
                                            : isVintage ? 'bg-[#8b6b4b] text-[#1e160e] border-[#5c4033]' 
                                            : isNeon ? 'bg-fuchsia-600 border-fuchsia-400 text-white shadow-[0_0_15px_#d946ef]'
                                            : isCrystal ? 'bg-white text-indigo-600 border-white shadow-md'
                                            : 'bg-stone-200 text-black border-white')
                                        : (isFlux ? 'bg-slate-900 text-slate-500 border-slate-800' 
                                            : isVintage ? 'bg-[#3b2b20] text-[#8b6b4b] border-[#5c4033]' 
                                            : isNeon ? 'bg-black text-fuchsia-900 border-fuchsia-900/50'
                                            : isCrystal ? 'bg-slate-100 text-slate-400 border-transparent'
                                            : 'bg-[#111] text-stone-600 border-stone-800')
                                    }`}
                                >
                                    {wf}
                                </button>
                            ))}
                        </div>
                        <div className="grid grid-cols-2 gap-12">
                             <Slider label="Sub Osc Mix" value={settings.subLevel} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('subLevel', parseFloat(e.target.value))} />
                             <Slider label="Fret Noise" value={settings.noiseLevel} min={0} max={0.5} step={0.01} unit="%" onChange={(e: any) => updateSetting('noiseLevel', parseFloat(e.target.value))} />
                        </div>
                     </div>

                     <div className={`h-px w-full ${isVintage ? 'bg-[#5c4033] opacity-20' : isCrystal ? 'bg-slate-300' : 'bg-current opacity-10'}`}></div>

                     {/* Filter */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                        <div className="space-y-6">
                            <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-4 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Filter (VCF)</h3>
                            <Slider label="Cutoff" value={settings.tone} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('tone', parseFloat(e.target.value))} />
                            <Slider label="Resonance" value={settings.filterResonance} min={0} max={0.9} step={0.01} unit="%" onChange={(e: any) => updateSetting('filterResonance', parseFloat(e.target.value))} />
                            <Slider label="Envelope Depth" value={settings.filterEnvAmount} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('filterEnvAmount', parseFloat(e.target.value))} />
                        </div>

                        <div className="space-y-6">
                             <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-4 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Envelope (VCA)</h3>
                             <div className="grid grid-cols-2 gap-6">
                                <Slider label="Attack" value={settings.attack} min={0.001} max={0.2} step={0.001} onChange={(e: any) => updateSetting('attack', parseFloat(e.target.value))} />
                                <Slider label="Release" value={settings.release} min={0.05} max={3.0} step={0.05} onChange={(e: any) => updateSetting('release', parseFloat(e.target.value))} />
                             </div>
                             <Slider label="Sustain" value={settings.sustain} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('sustain', parseFloat(e.target.value))} />
                             <Slider label="Glide" value={settings.glideTime} min={0} max={0.5} step={0.01} unit="s" onChange={(e: any) => updateSetting('glideTime', parseFloat(e.target.value))} />
                        </div>
                     </div>
                </div>
            )}

            {/* --- TAB: EFFECTS (Mod, Delay, Reverb) --- */}
            {activeTab === 'effects' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Modulation I */}
                        <div className={`p-5 rounded-xl border space-y-6 ${isVintage ? 'bg-[#e0d6c2] border-[#a89878] shadow-inner' : isCrystal ? 'border-white bg-white/60 shadow-sm' : isNeon ? 'border-fuchsia-900 bg-purple-900/20' : 'bg-black/30 border-white/10'}`}>
                             <h3 className={`text-xs font-black uppercase tracking-[0.2em] text-center mb-2 ${isVintage ? 'text-[#3d2e1e] opacity-50' : isCrystal ? 'text-slate-500 opacity-80' : 'opacity-50'}`}>Modulation I</h3>
                             <Slider label="Chorus" value={settings.chorus} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('chorus', parseFloat(e.target.value))} />
                             <Slider label="Vibrato" value={settings.vibrato} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('vibrato', parseFloat(e.target.value))} />
                        </div>

                        {/* Modulation II (New Pedals) */}
                        <div className={`p-5 rounded-xl border space-y-6 ${isVintage ? 'bg-[#e0d6c2] border-[#a89878] shadow-inner' : isCrystal ? 'border-white bg-white/60 shadow-sm' : isNeon ? 'border-fuchsia-900 bg-purple-900/20' : 'bg-black/30 border-white/10'}`}>
                             <h3 className={`text-xs font-black uppercase tracking-[0.2em] text-center mb-2 ${isVintage ? 'text-[#3d2e1e] opacity-50' : isCrystal ? 'text-slate-500 opacity-80' : 'opacity-50'}`}>Modulation II</h3>
                             {/* Phaser */}
                             <div className={`space-y-4 border-b pb-4 ${isVintage ? 'border-[#a89878]' : isCrystal ? 'border-slate-300/50' : 'border-white/10'}`}>
                                <Slider label="Phaser Mix" value={settings.phaserMix} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('phaserMix', parseFloat(e.target.value))} />
                                <Slider label="Rate" value={settings.phaserRate} min={0.1} max={5} step={0.1} unit="Hz" onChange={(e: any) => updateSetting('phaserRate', parseFloat(e.target.value))} />
                             </div>
                             {/* Tremolo */}
                             <div className="space-y-4 pt-2">
                                <Slider label="Tremolo Depth" value={settings.tremoloDepth} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('tremoloDepth', parseFloat(e.target.value))} />
                                <Slider label="Rate" value={settings.tremoloRate} min={0.5} max={10} step={0.1} unit="Hz" onChange={(e: any) => updateSetting('tremoloRate', parseFloat(e.target.value))} />
                             </div>
                        </div>

                        {/* Space & Time */}
                        <div className={`p-5 rounded-xl border space-y-6 ${isVintage ? 'bg-[#e0d6c2] border-[#a89878] shadow-inner' : isCrystal ? 'border-white bg-white/60 shadow-sm' : isNeon ? 'border-fuchsia-900 bg-purple-900/20' : 'bg-black/30 border-white/10'}`}>
                             <h3 className={`text-xs font-black uppercase tracking-[0.2em] text-center mb-2 ${isVintage ? 'text-[#3d2e1e] opacity-50' : isCrystal ? 'text-slate-500 opacity-80' : 'opacity-50'}`}>Time & Space</h3>
                             <Slider label="Delay Mix" value={settings.delayMix} min={0} max={0.8} step={0.01} unit="%" onChange={(e: any) => updateSetting('delayMix', parseFloat(e.target.value))} />
                             <Slider label="Time" value={settings.delayTime} min={0.05} max={1.0} step={0.01} unit="s" onChange={(e: any) => updateSetting('delayTime', parseFloat(e.target.value))} />
                             <Slider label="Reverb" value={settings.reverb} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('reverb', parseFloat(e.target.value))} />
                        </div>
                    </div>
                </div>
            )}

            {/* --- TAB: SYSTEM (Presets, Strings, Visuals) --- */}
            {activeTab === 'system' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div>
                        <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-6 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Preset Library</h3>
                        <div className="grid grid-cols-2 gap-3">
                            {(Object.keys(PRESETS) as PresetName[]).map(name => (
                                <button
                                    key={name}
                                    onClick={() => loadPreset(name)}
                                    className={`py-4 px-4 text-xs font-bold uppercase border transition-all truncate rounded-md active:scale-95 ${
                                        isFlux 
                                        ? 'bg-slate-800/50 hover:bg-cyan-900/30 border-white/5 hover:border-cyan-500/50 text-slate-400 hover:text-cyan-300' 
                                        : isVintage
                                        ? 'bg-[#3b2b20] border-[#5c4033] text-[#a89078] hover:bg-[#5c4033] hover:text-[#f7e7ce] shadow-sm'
                                        : isNeon
                                        ? 'bg-black border-fuchsia-900 text-fuchsia-500 hover:bg-fuchsia-900/40 hover:text-fuchsia-300 hover:border-fuchsia-500'
                                        : isCrystal
                                        ? 'bg-white border-white/50 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 shadow-sm'
                                        : 'bg-[#222] border-stone-700 text-stone-400 hover:bg-[#333] hover:text-white'
                                    }`}
                                >
                                    {name}
                                </button>
                            ))}
                        </div>
                        
                        <div className="mt-10 space-y-6">
                            <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-4 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Visual Theme</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <button onClick={() => updateSetting('theme', 'classic')} className="p-4 border border-white/10 rounded-lg bg-[#111] hover:border-white/30 text-stone-300 transition-colors">Classic</button>
                                <button onClick={() => updateSetting('theme', 'vintage')} className="p-4 border border-[#5c4033] rounded-lg bg-[#3b2b20] text-[#f7e7ce] hover:border-[#8b6b4b] transition-colors shadow-md">Vintage</button>
                                <button onClick={() => updateSetting('theme', 'flux')} className="p-4 border border-cyan-500/30 rounded-lg bg-slate-900 text-cyan-400 hover:bg-cyan-900/20 transition-colors">Flux</button>
                                <button onClick={() => updateSetting('theme', 'terminal')} className="p-4 border border-green-900 rounded-lg bg-black text-green-500 hover:bg-green-900/20 transition-colors">Terminal</button>
                                <button onClick={() => updateSetting('theme', 'neon')} className="p-4 border border-fuchsia-600 rounded-lg bg-black text-fuchsia-400 hover:bg-fuchsia-900/40 hover:shadow-[0_0_15px_#d946ef] transition-all">Neon</button>
                                <button onClick={() => updateSetting('theme', 'crystal')} className="p-4 border border-white rounded-lg bg-slate-100 text-slate-600 hover:bg-white hover:text-indigo-500 shadow-[inset_0_1px_4px_rgba(0,0,0,0.05)] transition-colors">Crystal</button>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-8">
                        <h3 className={`text-xs font-black uppercase tracking-[0.3em] mb-6 border-b pb-2 ${isVintage ? 'border-[#5c4033] text-[#3d2e1e] opacity-40' : isCrystal ? 'border-slate-300 text-slate-500 opacity-80' : 'border-current opacity-40'}`}>Instrument Setup</h3>
                        <ToggleBtn label={settings.isMonophonic ? "Monophonic (Real Bass)" : "Polyphonic (Tapping)"} active={settings.isMonophonic} onClick={() => updateSetting('isMonophonic', !settings.isMonophonic)} />
                        
                        <Slider label="String Count" value={settings.stringCount} min={4} max={8} step={1} onChange={(e: any) => updateSetting('stringCount', parseInt(e.target.value))} />
                        <Slider label="Fret Range" value={settings.fretCount} min={10} max={14} step={1} onChange={(e: any) => updateSetting('fretCount', parseInt(e.target.value))} />
                        <Slider label="Haptic Feedback" value={settings.vibrationIntensity} min={0} max={5} step={0.1} unit="px" onChange={(e: any) => updateSetting('vibrationIntensity', parseFloat(e.target.value))} />
                        <Slider label="Velocity Sens" value={settings.velocitySensitivity} min={0} max={1} step={0.01} unit="%" onChange={(e: any) => updateSetting('velocitySensitivity', parseFloat(e.target.value))} />
                        <ToggleBtn label="Show Note Names" active={settings.showNotes} onClick={() => updateSetting('showNotes', !settings.showNotes)} />
                    </div>
                </div>
            )}

        </div>
      </div>
    </div>
  );
};