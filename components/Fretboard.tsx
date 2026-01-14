import React, { useRef, useState, useCallback, useEffect, useMemo } from 'react';
import { MARKERS, NUT_WIDTH_PERCENT, getTuning } from '../constants';
import { audioEngine } from '../services/AudioEngine';
import { AudioSettings } from '../types';

interface FretboardProps {
  isMenuOpen: boolean;
  settings: AudioSettings;
}

interface TouchData {
  touchId: number;
  stringIndex: number;
  freq: number;
  noteId: string;
  startOffset: number;
  velocity: number;
  xPercent: number; // Store visual X position
  // Auto-tune / Glide tracking
  lastMove: number;
  isTuned: boolean;
  rawSemitones: number;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
let noteCounter = 0; // Global counter to ensure unique IDs across rapid taps
const MOUSE_ID = 88888; // Unique ID for mouse interactions

export const Fretboard: React.FC<FretboardProps> = ({ isMenuOpen, settings }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const theme = settings.theme;
  const isFlux = theme === 'flux';
  const isTerminal = theme === 'terminal';
  const isVintage = theme === 'vintage';
  const isNeon = theme === 'neon';
  const isCrystal = theme === 'crystal';
  
  // Memoized Configuration
  const currentTuning = useMemo(() => getTuning(settings.stringCount), [settings.stringCount]);
  const semitoneRange = settings.fretCount;

  // State Refs
  const touchesRef = useRef<Map<number, TouchData>>(new Map());
  // We keep track of what SHOULD be playing. 
  // Key = unique identifier for the note (e.g., 'string-0' for mono, 'touch-123' for poly)
  const activeNoteIdsRef = useRef<Map<string, { touchId: number, freq: number, stringIndex: number }>>(new Map());
  const isMouseDownRef = useRef(false);
  
  const animationFrameRef = useRef<number>(0);
  const gameLoopRef = useRef<number>(0);
  const isMenuOpenRef = useRef(isMenuOpen);

  useEffect(() => {
    isMenuOpenRef.current = isMenuOpen;
  }, [isMenuOpen]);

  // Visual State
  const [visualTouches, setVisualTouches] = useState<Map<number, TouchData>>(new Map());
  const [vibratingStrings, setVibratingStrings] = useState<Set<number>>(new Set());

  // --- Visual Sync ---
  const scheduleVisualUpdate = useCallback(() => {
    if (animationFrameRef.current) return;
    
    animationFrameRef.current = requestAnimationFrame(() => {
      setVisualTouches(new Map(touchesRef.current));
      
      const vibrating = new Set<number>();
      touchesRef.current.forEach((t) => vibrating.add(t.stringIndex));
      setVibratingStrings(vibrating);
      
      animationFrameRef.current = 0;
    });
  }, []);

  // --- Helpers ---
  const generateNoteId = (touchId: number, stringIndex: number) => {
    noteCounter = (noteCounter + 1) % 10000;
    return `n-${touchId}-${stringIndex}-${Date.now()}-${noteCounter}`;
  };

  const getVerticalPadding = () => window.innerWidth >= 768 ? 56 : 40; 

  const getRawStringPos = (clientY: number, rect: DOMRect, tuningLength: number) => {
    const padding = getVerticalPadding();
    const playableHeight = rect.height - (padding * 2);
    if (playableHeight <= 0) return 0;
    const stringHeight = playableHeight / tuningLength;
    const relativeY = clientY - rect.top;
    const adjustedY = relativeY - padding;
    return adjustedY / stringHeight;
  };

  const getStringIndexFromY = (clientY: number, rect: DOMRect) => {
    const rawPos = getRawStringPos(clientY, rect, currentTuning.length);
    const index = Math.floor(rawPos);
    return Math.max(0, Math.min(currentTuning.length - 1, index));
  };
  
  const calculateRawSemitones = (clientX: number, rect: DOMRect) => {
    const relativeX = clientX - rect.left;
    const width = rect.width;
    const percentage = (relativeX / width) * 100;
    if (percentage < NUT_WIDTH_PERCENT) return -999;
    const playablePercent = (percentage - NUT_WIDTH_PERCENT) / (100 - NUT_WIDTH_PERCENT);
    const rawSemitones = playablePercent * semitoneRange;
    return rawSemitones;
  };

  const calculateFreqFromSemitones = useCallback((stringIndex: number, semitones: number) => {
    const baseFreq = currentTuning[stringIndex]?.freq || 440;
    if (semitones === -999) return baseFreq;
    return baseFreq * Math.pow(2, semitones / 12);
  }, [currentTuning]);

  const estimateVelocity = (input: React.Touch | Touch | number | any, sensitivity: number) => {
      let rawForce = 1.0;
      
      if (typeof input === 'number') {
        rawForce = input; // Direct force passed (e.g. mouse default)
      } else {
        if (input.force !== undefined && input.force > 0) {
            rawForce = input.force;
        } else if (input.webkitForce !== undefined && input.webkitForce > 0) {
            rawForce = input.webkitForce; 
            if (rawForce > 1) rawForce = 1;
        } else if (input.radiusX !== undefined || input.webkitRadiusX !== undefined) {
            const rX = input.radiusX || input.webkitRadiusX || 15;
            const rY = input.radiusY || input.webkitRadiusY || 15;
            const avgRadius = (rX + rY) / 2;
            const minR = 8;
            const maxR = 40;
            const normalized = Math.max(0, Math.min(1, (avgRadius - minR) / (maxR - minR)));
            rawForce = 0.3 + (0.7 * normalized);
        }
      }
      const scaledVelocity = (rawForce * sensitivity) + (1.0 - sensitivity);
      return Math.max(0.4, Math.min(1.0, scaledVelocity));
  };

  // --- Shared Input Processing Logic ---
  const processInput = (id: number, clientX: number, clientY: number, forceInput: number | Touch, rect: DOMRect) => {
    const now = Date.now();
    const stringIndex = getStringIndexFromY(clientY, rect);
    const rawSemitones = calculateRawSemitones(clientX, rect);
    const relativeX = clientX - rect.left;
    const xPercent = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));

    const existing = touchesRef.current.get(id);

    if (!existing) {
        // --- NEW INPUT ---
        let startOffset = 0;
        if (rawSemitones !== -999) {
            const nearestSemitone = Math.ceil(rawSemitones);
            startOffset = nearestSemitone - rawSemitones;
        }
        const finalSemitones = rawSemitones === -999 ? -999 : rawSemitones + startOffset;
        const freq = calculateFreqFromSemitones(stringIndex, finalSemitones);
        
        const noteId = generateNoteId(id, stringIndex); 

        touchesRef.current.set(id, { 
            touchId: id, 
            stringIndex, 
            freq, 
            noteId, 
            startOffset, 
            velocity: estimateVelocity(forceInput, settings.velocitySensitivity), 
            xPercent,
            lastMove: now,
            isTuned: false,
            rawSemitones
        });
    } 
    else {
        // --- UPDATE EXISTING ---
        const delta = Math.abs(rawSemitones - existing.rawSemitones);
        const alpha = delta > 0.1 ? 1.0 : 0.5; 
        const smoothedSemitones = (rawSemitones * alpha) + (existing.rawSemitones * (1 - alpha));
        const rawPosition = getRawStringPos(clientY, rect, currentTuning.length);
        let newStringIndex = existing.stringIndex;

        if (rawPosition > existing.stringIndex + 1.25) newStringIndex = Math.floor(rawPosition);
        else if (rawPosition < existing.stringIndex - 0.25) newStringIndex = Math.floor(rawPosition);
        newStringIndex = Math.max(0, Math.min(currentTuning.length - 1, newStringIndex));

        if (existing.stringIndex !== newStringIndex) {
            // String Change
            let newStartOffset = 0;
            if (smoothedSemitones !== -999) {
                    const nearestSemitone = Math.ceil(smoothedSemitones);
                    newStartOffset = nearestSemitone - smoothedSemitones;
            }
            const finalSemitones = smoothedSemitones === -999 ? -999 : smoothedSemitones + newStartOffset;
            const freq = calculateFreqFromSemitones(newStringIndex, finalSemitones);
            
            existing.stringIndex = newStringIndex;
            existing.freq = freq;
            existing.startOffset = newStartOffset;
            existing.rawSemitones = smoothedSemitones;
            existing.lastMove = now;
            existing.isTuned = false;
            existing.xPercent = xPercent;
        } else {
            // Slide
            const finalSemitones = smoothedSemitones === -999 ? -999 : smoothedSemitones + existing.startOffset;
            const freq = calculateFreqFromSemitones(newStringIndex, finalSemitones);
            
            if (Math.abs(existing.freq - freq) > 0.01) {
                existing.freq = freq;
            }
            existing.rawSemitones = smoothedSemitones;
            existing.xPercent = xPercent;
            existing.lastMove = now;
            existing.isTuned = false;
        }
    }
  };

  // --- Core Audio Logic: Reconciliation ---
  const syncAudioEngine = useCallback(() => {
    
    // 1. Calculate Wanted Notes
    const wantedNotes = new Map<string, TouchData>();

    if (settings.isMonophonic) {
        // For each string, find the "winner"
        for (let i = 0; i < currentTuning.length; i++) {
            let winner: TouchData | null = null;
            for (const touch of touchesRef.current.values()) {
                if (touch.stringIndex === i) {
                     if (!winner) {
                         winner = touch;
                     } else {
                         // Higher pitch wins
                         const winnerSemi = winner.rawSemitones === -999 ? -1 : winner.rawSemitones;
                         const touchSemi = touch.rawSemitones === -999 ? -1 : touch.rawSemitones;
                         if (touchSemi > winnerSemi) winner = touch;
                     }
                }
            }
            if (winner) {
                wantedNotes.set(`string-${i}`, winner);
            }
        }
    } else {
        // Polyphonic
        touchesRef.current.forEach((t) => {
             wantedNotes.set(`touch-${t.touchId}`, t);
        });
    }

    // 2. Stop unwanted notes
    for (const [activeKey, activeData] of activeNoteIdsRef.current.entries()) {
        if (!wantedNotes.has(activeKey)) {
            audioEngine.stopNote(activeKey);
            activeNoteIdsRef.current.delete(activeKey);
        }
    }

    // 3. Start or Update wanted notes
    for (const [wantedKey, data] of wantedNotes.entries()) {
        const activeData = activeNoteIdsRef.current.get(wantedKey);
        
        if (activeData) {
             if (activeData.touchId !== data.touchId || activeData.stringIndex !== data.stringIndex) {
                 audioEngine.startNote(wantedKey, data.freq, data.velocity, data.stringIndex);
                 activeNoteIdsRef.current.set(wantedKey, { touchId: data.touchId, freq: data.freq, stringIndex: data.stringIndex });
             } else {
                 if (Math.abs(activeData.freq - data.freq) > 0.01) {
                     audioEngine.updateNotePitch(wantedKey, data.freq);
                     activeData.freq = data.freq;
                 }
                 if (!audioEngine.isNotePlaying(wantedKey)) {
                      audioEngine.startNote(wantedKey, data.freq, data.velocity, data.stringIndex);
                 }
             }
        } else {
            audioEngine.startNote(wantedKey, data.freq, data.velocity, data.stringIndex);
            activeNoteIdsRef.current.set(wantedKey, { touchId: data.touchId, freq: data.freq, stringIndex: data.stringIndex });
        }
    }

  }, [settings.isMonophonic, currentTuning]);

  // --- Unmount Cleanup ---
  useEffect(() => {
      return () => {
          activeNoteIdsRef.current.forEach((_, key) => audioEngine.stopNote(key));
          activeNoteIdsRef.current.clear();
          if (gameLoopRef.current) cancelAnimationFrame(gameLoopRef.current);
      };
  }, []);

  // --- Game Loop ---
  useEffect(() => {
    const loop = () => {
        if (!isMenuOpenRef.current) {
            syncAudioEngine();
            audioEngine.checkState();

            // Auto-Tune Logic
            const now = Date.now();
            const TUNE_DELAY = 60; 
            touchesRef.current.forEach((data) => {
                if (!data.isTuned && (now - data.lastMove > TUNE_DELAY)) {
                    if (data.rawSemitones !== -999) {
                        const nearestSemitone = Math.ceil(data.rawSemitones);
                        const targetFreq = calculateFreqFromSemitones(data.stringIndex, nearestSemitone);
                        const newOffset = nearestSemitone - data.rawSemitones;
                        if (Math.abs(data.freq - targetFreq) > 0.001) {
                            data.freq = targetFreq;
                            data.startOffset = newOffset;
                        }
                        data.isTuned = true;
                    }
                }
            });

            scheduleVisualUpdate();
        }
        gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);

  }, [scheduleVisualUpdate, calculateFreqFromSemitones, syncAudioEngine]);

  // --- Event Listeners ---
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // --- Touch Handlers ---
    const handleNativeTouch = (e: TouchEvent) => {
        if (isMenuOpenRef.current) return;
        if (e.cancelable) e.preventDefault(); // Prevents mouse emulation and scrolling
        
        audioEngine.resume();
        const rect = el.getBoundingClientRect();
        const activeIds = new Set<number>();

        // 1. Process Active Touches
        for (let i = 0; i < e.touches.length; i++) {
            const touch = e.touches[i];
            activeIds.add(touch.identifier);
            processInput(touch.identifier, touch.clientX, touch.clientY, touch, rect);
        }

        // 2. Cleanup Dead Touches (Exclude Mouse ID)
        for (const [id] of touchesRef.current.entries()) {
            if (!activeIds.has(id) && id !== MOUSE_ID) {
                touchesRef.current.delete(id);
            }
        }
    };

    // --- Mouse Handlers ---
    const handleMouseDown = (e: MouseEvent) => {
        if (isMenuOpenRef.current) return;
        isMouseDownRef.current = true;
        audioEngine.resume();
        const rect = el.getBoundingClientRect();
        processInput(MOUSE_ID, e.clientX, e.clientY, 0.8, rect); // Default velocity 0.8
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isMouseDownRef.current || isMenuOpenRef.current) return;
        const rect = el.getBoundingClientRect();
        processInput(MOUSE_ID, e.clientX, e.clientY, 0.8, rect);
    };

    const handleMouseUp = (e: MouseEvent) => {
        if (isMouseDownRef.current) {
            isMouseDownRef.current = false;
            touchesRef.current.delete(MOUSE_ID);
        }
    };

    const handleMouseLeave = (e: MouseEvent) => {
        if (isMouseDownRef.current) {
            isMouseDownRef.current = false;
            touchesRef.current.delete(MOUSE_ID);
        }
    };

    // Attach Listeners
    el.addEventListener('touchstart', handleNativeTouch, { passive: false });
    el.addEventListener('touchmove', handleNativeTouch, { passive: false });
    el.addEventListener('touchend', handleNativeTouch, { passive: false });
    el.addEventListener('touchcancel', handleNativeTouch, { passive: false });
    
    el.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove); // Window for better drag handling
    window.addEventListener('mouseup', handleMouseUp);
    el.addEventListener('mouseleave', handleMouseLeave);

    return () => {
        el.removeEventListener('touchstart', handleNativeTouch);
        el.removeEventListener('touchmove', handleNativeTouch);
        el.removeEventListener('touchend', handleNativeTouch);
        el.removeEventListener('touchcancel', handleNativeTouch);

        el.removeEventListener('mousedown', handleMouseDown);
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
        el.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [settings.velocitySensitivity, currentTuning, semitoneRange, calculateFreqFromSemitones]);


  // --- Render Assets ---
  const fretLines = Array.from({ length: Math.floor(semitoneRange) }, (_, i) => i + 1);
  const getNoteIndex = (noteStr: string) => {
    const match = noteStr.match(/([A-G]#?)/);
    return match ? NOTES.indexOf(match[0]) : 0;
  };

  // --- THEME CONFIGURATION ---
  let containerStyle: React.CSSProperties = {};
  let fretLineClass: string = '';
  
  if (isFlux) {
      containerStyle = {
        background: '#09090b',
        backgroundImage: `
            radial-gradient(circle at 50% 120%, rgba(6,182,212,0.1) 0%, transparent 60%),
            linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)
        `,
        backgroundSize: '100% 100%, 40px 40px, 40px 40px'
      };
      fretLineClass = 'w-[1px] bg-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.6)]';
  } else if (isTerminal) {
      containerStyle = {
          backgroundColor: '#050505',
          backgroundImage: `
              radial-gradient(circle at center, rgba(34,197,94,0.05) 0%, transparent 80%),
              linear-gradient(rgba(34, 197, 94, 0.1) 1px, transparent 1px), 
              linear-gradient(90deg, rgba(34, 197, 94, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '100% 100%, 50px 50px, 50px 50px'
      };
      fretLineClass = 'w-[1px] bg-green-500/40';
  } else if (isVintage) {
      // Light Maple configuration with horizontal grain
      containerStyle = {
          backgroundColor: '#dcb280', // Lighter maple base
          backgroundImage: `
            radial-gradient(circle at 50% 50%, rgba(255,255,255,0.1) 0%, rgba(60,40,20,0.2) 100%),
            url("https://www.transparenttextures.com/patterns/wood-pattern.png"),
            repeating-linear-gradient(180deg, 
                rgba(120, 90, 60, 0.1) 0px, 
                rgba(120, 90, 60, 0.1) 1px, 
                transparent 1px, 
                transparent 4px
            ),
            repeating-linear-gradient(180.5deg, 
                rgba(100, 70, 40, 0.08) 0px, 
                rgba(100, 70, 40, 0.08) 2px, 
                transparent 3px, 
                transparent 16px
            ),
             linear-gradient(180deg, 
                transparent 0%, 
                rgba(60,40,20,0.05) 30%, 
                transparent 60%, 
                rgba(60,40,20,0.05) 100%
            )
          `,
          backgroundSize: '100% 100%, auto, 100% 100%, 100% 100%, 100% 100%, 100% 100%',
          boxShadow: 'inset 0 0 60px rgba(60,40,20,0.4)'
      };
      fretLineClass = 'w-[2px] bg-[#8d6e63] opacity-70 shadow-[0_1px_0_rgba(255,255,255,0.3)]'; 
  } else if (isNeon) {
      // Neon: Dark purple background with distinct grid
      containerStyle = {
          backgroundColor: '#0f0518',
          backgroundImage: `
              linear-gradient(0deg, transparent 24%, rgba(232, 121, 249, 0.1) 25%, rgba(232, 121, 249, 0.1) 26%, transparent 27%, transparent 74%, rgba(232, 121, 249, 0.1) 75%, rgba(232, 121, 249, 0.1) 76%, transparent 77%, transparent),
              linear-gradient(90deg, transparent 24%, rgba(232, 121, 249, 0.1) 25%, rgba(232, 121, 249, 0.1) 26%, transparent 27%, transparent 74%, rgba(232, 121, 249, 0.1) 75%, rgba(232, 121, 249, 0.1) 76%, transparent 77%, transparent)
          `,
          backgroundSize: '50px 50px',
          boxShadow: 'inset 0 0 100px rgba(88, 28, 135, 0.5)'
      };
      fretLineClass = 'w-[1px] bg-fuchsia-600 shadow-[0_0_10px_#d946ef]';
  } else if (isCrystal) {
      // Crystal: Light, airy, glass-like
      containerStyle = {
          background: 'linear-gradient(to bottom, #f8fafc 0%, #e2e8f0 100%)',
          backgroundImage: `
            radial-gradient(circle at 20% 50%, rgba(99, 102, 241, 0.05) 0%, transparent 40%),
            radial-gradient(circle at 80% 30%, rgba(167, 139, 250, 0.05) 0%, transparent 40%)
          `,
          boxShadow: 'inset 0 0 60px rgba(255,255,255,0.8)'
      };
      fretLineClass = 'w-[1px] bg-slate-300 shadow-[0_1px_0_white]';
  } else {
      // Classic
      containerStyle = {
        backgroundColor: '#111',
        backgroundImage: `
            linear-gradient(160deg, rgba(255,255,255,0.03) 0%, transparent 40%),
            radial-gradient(circle at 50% 0%, rgba(50,50,50,0.3) 0%, transparent 70%)
        `,
        boxShadow: 'inset 0 0 150px rgba(0,0,0,0.9)'
      };
      fretLineClass = 'w-[1px] bg-white/20 shadow-[0_1px_0_rgba(255,255,255,0.05)]';
  }

  // Define unique Nut styles per theme
  const getNutStyle = () => {
      if (isFlux) {
          return {
              container: 'border-r border-cyan-500/30 shadow-[0_0_40px_rgba(6,182,212,0.15)] z-20 backdrop-blur-sm',
              style: { background: 'linear-gradient(90deg, rgba(2,6,23,0.95) 0%, rgba(15,23,42,0.9) 100%)' }
          };
      }
      if (isTerminal) {
          return {
              container: 'bg-[#000] border-r-4 border-green-900 z-20',
              style: { backgroundImage: 'repeating-linear-gradient(45deg, #000 0px, #000 2px, #112211 2px, #112211 4px)' }
          };
      }
      if (isVintage) {
          return {
              container: 'z-20 border-r border-[#998]',
              style: { 
                  background: 'linear-gradient(to right, #e6dec5 0%, #fdfbf7 40%, #fdfbf7 60%, #e6dec5 100%)',
                  boxShadow: 'inset -1px 0 2px rgba(0,0,0,0.1), 2px 0 5px rgba(0,0,0,0.2)',
              }
          };
      }
      if (isNeon) {
          return {
              container: 'z-20 border-r-2 border-fuchsia-500 shadow-[0_0_20px_#d946ef]',
              style: { backgroundColor: '#2e1065' }
          }
      }
      if (isCrystal) {
          return {
              container: 'z-20 border-r border-white/50 bg-white/80 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.05)]',
              style: { 
                  background: 'linear-gradient(to right, rgba(255,255,255,0.9), rgba(241,245,249,0.9))'
              }
          }
      }
      // Classic
      return {
          container: 'z-20 border-r border-[#222]',
          style: { 
              backgroundColor: '#1a1a1a',
              backgroundImage: `
                  linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 20%, transparent 80%, rgba(255,255,255,0.05) 100%),
                  linear-gradient(90deg, #151515 0%, #2a2a2a 20%, #151515 100%)
              `,
              boxShadow: '5px 0 20px rgba(0,0,0,0.8)'
          }
      };
  };

  const nutConfig = getNutStyle();
  const verticalPadding = 'py-10 md:py-14';

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full cursor-crosshair touch-none select-none overflow-hidden"
      style={{ 
        ...containerStyle,
        touchAction: 'none',
        WebkitUserSelect: 'none',
        '--vibration-amp': `${settings.vibrationIntensity}px`,
      } as React.CSSProperties}
    >
      {/* Nut Area */}
      <div 
        className={`absolute top-0 bottom-0 left-0 flex flex-col justify-between ${nutConfig.container}`}
        style={{ width: `${NUT_WIDTH_PERCENT}%`, ...nutConfig.style }}
      >
         {/* Theme Specific Decorative Layers for Nut */}
         {isFlux && <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-cyan-400 shadow-[0_0_15px_cyan] opacity-60"></div>}
         {isTerminal && <div className="absolute inset-y-0 right-1 w-[2px] bg-green-900"></div>}
         {isVintage && <div className="absolute inset-y-0 right-0 w-[1px] bg-[#ffffff] opacity-20 mix-blend-overlay"></div>}
         {isCrystal && <div className="absolute inset-y-0 right-0 w-[1px] bg-white shadow-[0_0_5px_white]"></div>}

        {/* Nut Slots and Labels */}
        <div className={`absolute inset-0 flex flex-col justify-between ${verticalPadding} z-10`}>
            {currentTuning.map((stringData, i) => {
                 // Calculate Visual Thickness:
                 // Top string (i=0) is High Pitch (Thin).
                 // Bottom string (i=Max) is Low Pitch (Thick).
                 const thickness = 3.0 + (i * 0.8);
                 
                 const grooveHeight = thickness + 4; 

                 return (
                    <div key={i} className="relative w-full flex items-center h-full">
                        
                        {/* FLUX THEME */}
                        {isFlux && (
                            <>
                                <div className="absolute bottom-1/2 mb-2 left-1/2 -translate-x-1/2 text-[9px] font-mono text-cyan-200 tracking-[0.2em] bg-cyan-950/90 px-2 py-0.5 border border-cyan-500/40 rounded skew-x-12 shadow-[0_0_15px_rgba(6,182,212,0.3)] whitespace-nowrap z-40 backdrop-blur-md">
                                    {stringData.name}
                                </div>
                                <div className="w-full flex justify-end px-2">
                                     <div className="w-full h-1 bg-cyan-900 shadow-[0_0_8px_cyan] rounded-full"></div>
                                </div>
                            </>
                        )}

                        {/* TERMINAL THEME */}
                        {isTerminal && (
                             <>
                                <div className="absolute bottom-1/2 mb-1.5 left-1 text-[8px] font-mono font-bold text-green-500 bg-black/90 px-1 border border-green-800 whitespace-nowrap z-40">
                                    &gt; {stringData.name}_
                                </div>
                                <div className="w-full flex justify-end pr-1">
                                    <div className="w-3 h-3 bg-[#0a0a0a] border border-green-900 flex items-center justify-center">
                                        <div className="w-1 h-1 bg-green-600 rounded-full animate-pulse"></div>
                                    </div>
                                </div>
                             </>
                        )}

                        {/* NEON THEME */}
                        {isNeon && (
                            <>
                                <div className="absolute bottom-1/2 mb-1 left-2 text-[10px] font-bold text-fuchsia-500 tracking-widest drop-shadow-[0_0_5px_#d946ef] z-40">
                                    {stringData.name}
                                </div>
                                {/* Neon glowing slot */}
                                <div className="w-full flex justify-end">
                                    <div className="w-full h-[2px] bg-fuchsia-600 shadow-[0_0_10px_#d946ef]"></div>
                                </div>
                            </>
                        )}

                        {/* CRYSTAL THEME */}
                        {isCrystal && (
                            <>
                                <div className="absolute bottom-1/2 mb-2 left-1 text-[9px] font-bold text-indigo-900 tracking-wider z-40 bg-white/70 px-1.5 rounded shadow-sm backdrop-blur-sm">
                                    {stringData.name}
                                </div>
                                <div className="w-full flex justify-end">
                                    <div className="w-full h-[3px] bg-slate-200 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] rounded-full"></div>
                                </div>
                            </>
                        )}

                        {/* VINTAGE THEME */}
                        {isVintage && (
                            <>
                                 <span 
                                    className="absolute left-1.5 font-serif font-bold text-[8px] text-[#5e4b35] opacity-80 tracking-widest z-20"
                                    style={{ top: '25%', transform: 'translateY(-50%)' }}
                                 >
                                    {stringData.name}
                                 </span>
                                 <div 
                                    className="absolute w-full left-0 z-10 bg-[#3a2817] shadow-[inset_0_1px_3px_rgba(0,0,0,0.6)]"
                                    style={{ 
                                        height: `${grooveHeight}px`,
                                        borderRadius: '1px',
                                        opacity: 0.9,
                                        borderBottom: '1px solid rgba(255,255,255,0.2)'
                                    }}
                                 ></div>
                            </>
                        )}

                        {/* CLASSIC THEME */}
                        {!isFlux && !isTerminal && !isVintage && !isNeon && !isCrystal && (
                            <>
                                 <div className="absolute left-2 font-sans font-bold text-[8px] text-stone-500 tracking-wider z-20" style={{ top: '20%' }}>
                                    {stringData.name}
                                 </div>
                                 <div 
                                    className="absolute w-full left-0 z-10 bg-[#000] shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]"
                                    style={{ 
                                        height: `${grooveHeight}px`,
                                        opacity: 0.8
                                    }}
                                 ></div>
                            </>
                        )}
                    </div>
                 );
            })}
        </div>
      </div>

      {/* Fret Lines & Markers */}
      <div className="absolute top-0 bottom-0 right-0 left-0 pointer-events-none z-0">
        {fretLines.map((semitone) => {
          const percent = NUT_WIDTH_PERCENT + ((100 - NUT_WIDTH_PERCENT) * (semitone / semitoneRange));
          if (percent > 100) return null;
          return (
            <div key={`line-${semitone}`} className="absolute top-0 bottom-0 flex flex-col items-center" style={{ left: `${percent}%` }}>
              <div className={`h-full ${fretLineClass}`}></div>
            </div>
          );
        })}
        
        {/* Markers */}
        {MARKERS.map((fretNumber) => {
           if (fretNumber > semitoneRange) return null;

           const pos = fretNumber - 0.5;
           const percent = NUT_WIDTH_PERCENT + ((100 - NUT_WIDTH_PERCENT) * (pos / semitoneRange));
           if (percent > 100) return null;
           const isOctave = fretNumber === 12;

           const MarkerDot = () => {
             if (isFlux) return <div className="w-2 h-2 rotate-45 bg-cyan-300 shadow-[0_0_10px_cyan,inset_0_0_4px_white]"></div>;
             if (isTerminal) return <div className="w-2 h-2 bg-green-500 border border-green-900 shadow-[0_0_5px_lime]"></div>;
             if (isNeon) return <div className="w-3 h-3 border-2 border-fuchsia-500 bg-transparent shadow-[0_0_10px_#d946ef] rounded-full"></div>;
             if (isCrystal) return (
                 <div className="w-3 h-3 rounded-full bg-indigo-100 border border-indigo-200 shadow-[0_2px_5px_rgba(0,0,0,0.1)] flex items-center justify-center">
                     <div className="w-1 h-1 bg-indigo-400 rounded-full opacity-60"></div>
                 </div>
             );
             if (isVintage) {
                 return (
                    <div 
                        className="w-5 h-5 rounded-full border border-black/50 shadow-[inset_0_2px_4px_rgba(255,255,255,0.4),0_1px_2px_rgba(0,0,0,0.5)]"
                        style={{
                            background: 'radial-gradient(circle at 30% 30%, #e0f7fa, #4db6ac 40%, #880e4f 80%, #1a237e 100%)',
                            backgroundSize: '150% 150%',
                        }}
                    ></div>
                 );
             } 
             return <div className="w-3 h-3 rounded-full bg-stone-400 shadow-[inset_0_1px_2px_rgba(255,255,255,0.5),0_1px_2px_black]"></div>; 
           };

           return (
             <React.Fragment key={`marker-${fretNumber}`}>
                 <div className="absolute top-1/2 left-0 -translate-y-1/2 flex flex-col gap-10 items-center opacity-80" style={{ left: `${percent}%`, transform: 'translate(-50%, -50%)' }}>
                      {isOctave ? <><MarkerDot /><MarkerDot /></> : <MarkerDot />}
                 </div>

                 {/* Fret Number */}
                 <div className="absolute bottom-3 md:bottom-4 flex justify-center w-full" style={{ left: `${percent}%`, transform: 'translateX(-50%)' }}>
                    <span className={`text-[10px] font-bold tracking-tighter opacity-50 ${
                        isFlux ? 'text-cyan-600 font-mono' 
                        : isTerminal ? 'text-green-800 font-mono' 
                        : isVintage ? 'text-[#3e2723] font-serif italic' 
                        : isNeon ? 'text-fuchsia-500 drop-shadow-[0_0_5px_#d946ef]'
                        : isCrystal ? 'text-indigo-400 font-sans'
                        : 'text-stone-600 font-mono'
                    }`}>
                        {fretNumber}
                    </span>
                 </div>
             </React.Fragment>
           );
        })}
      </div>

      {/* Strings (Z-Index 30 - Above Nut Z-20) */}
      <div className={`absolute inset-0 flex flex-col justify-between pointer-events-none ${verticalPadding} z-30`}>
        {currentTuning.map((stringData, index) => {
          // Thickness Calculation:
          // Top string (i=0) is High Pitch (Thin).
          // Bottom string (i=Max) is Low Pitch (Thick).
          const thickness = 3.0 + (index * 0.8);
          
          const isVibrating = vibratingStrings.has(index);
          
          return (
            <div key={stringData.name} className="relative w-full flex items-center h-full group">
              <div className={`w-full relative flex items-center justify-center ${isVibrating ? 'animate-vibrate' : ''}`}>
                
                {isFlux ? (
                    <>
                        <div className={`absolute w-full bg-cyan-400/30 blur-md transition-opacity duration-75 ${isVibrating ? 'opacity-100' : 'opacity-0'}`} style={{ height: `${thickness * 6}px` }}></div>
                        <div 
                            className="w-full"
                            style={{ 
                                height: `${thickness}px`,
                                background: 'linear-gradient(180deg, #fff 0%, #06b6d4 40%, #0891b2 60%, #164e63 100%)',
                                boxShadow: isVibrating ? '0 0 12px #22d3ee' : '0 2px 6px rgba(0,0,0,0.6)',
                                borderRadius: '1px'
                            }}
                        ></div>
                    </>
                ) : isNeon ? (
                    <>
                        <div className={`absolute w-full bg-purple-500/50 blur-md transition-opacity duration-75 ${isVibrating ? 'opacity-100' : 'opacity-0'}`} style={{ height: `${thickness * 8}px` }}></div>
                        <div 
                            className="w-full"
                            style={{ 
                                height: `${Math.max(2, thickness - 1)}px`,
                                background: '#fff',
                                boxShadow: '0 0 5px #e879f9, 0 0 10px #d946ef',
                                borderRadius: '10px'
                            }}
                        ></div>
                    </>
                ) : isCrystal ? (
                    <>
                        {/* Shadow for depth on light background */}
                        <div className="absolute top-2 w-full bg-indigo-900/10 blur-[1px]" style={{ height: `${thickness + 2}px` }}></div>
                        <div 
                            className="w-full relative"
                            style={{ 
                                height: `${thickness + 2}px`,
                                background: 'linear-gradient(180deg, #fff 0%, #cbd5e1 50%, #94a3b8 100%)', // Silver look
                                boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                                borderRadius: '2px'
                            }}
                        ></div>
                    </>
                ) : isTerminal ? (
                    <>
                         <div 
                            className="w-full"
                            style={{ 
                                height: `${Math.max(1, thickness - 2)}px`,
                                background: isVibrating ? '#4ade80' : '#15803d',
                                boxShadow: isVibrating ? '0 0 8px #22c55e' : 'none',
                                opacity: 1
                            }}
                        ></div>
                    </>
                ) : (
                    <>
                         <div 
                            className="absolute bg-black/60 blur-[3px]" 
                            style={{ 
                                height: `${thickness * 1.5}px`, 
                                top: `${thickness + 6}px`,
                                left: `${NUT_WIDTH_PERCENT}%`,
                                right: '0'
                            }}
                        ></div>

                        <div 
                            className="w-full relative"
                            style={{ 
                                height: `${thickness}px`,
                                background: `
                                    repeating-linear-gradient(90deg, 
                                        ${isVintage ? 'rgba(140,140,140,1)' : 'rgba(220,220,220,1)'} 0px, 
                                        ${isVintage ? 'rgba(80,80,80,1)' : 'rgba(100,100,100,1)'} 1px, 
                                        ${isVintage ? 'rgba(40,40,40,1)' : 'rgba(30,30,30,1)'} 2px
                                    ),
                                    linear-gradient(180deg, rgba(255,255,255,0.6) 0%, rgba(0,0,0,0.8) 100%)
                                `,
                                backgroundBlendMode: 'multiply',
                                borderRadius: '2px',
                                boxShadow: isVintage ? '0 1px 3px rgba(0,0,0,0.6)' : '0 1px 2px rgba(0,0,0,0.8)',
                            }}
                        >
                            <div className="absolute inset-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
                        </div>
                    </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Note Helper Overlay */}
      {settings.showNotes && (
         <div className={`absolute inset-0 pointer-events-none z-40 flex flex-col justify-between ${verticalPadding}`}>
           {currentTuning.map((stringData, stringIndex) => {
             const baseNoteIdx = getNoteIndex(stringData.note);
             
             return (
                <div key={`notes-${stringIndex}`} className="relative w-full h-full">
                    {Array.from({ length: semitoneRange }).map((_, i) => {
                        const s = i + 1;
                        const noteIdx = (baseNoteIdx + s) % 12;
                        const noteName = NOTES[noteIdx];
                        
                        if (noteName.includes('#')) return null;

                        const visualPos = s - 0.5;
                        const percent = NUT_WIDTH_PERCENT + ((100 - NUT_WIDTH_PERCENT) * (visualPos / semitoneRange));
                        
                        if (percent > 100) return null;

                        return (
                            <div 
                              key={`note-${stringIndex}-${s}`}
                              className="absolute top-1/2 -translate-y-1/2 flex items-center justify-center -translate-x-1/2"
                              style={{ left: `${percent}%` }}
                            >
                                <span className={`text-[10px] md:text-xs font-bold px-1.5 py-0.5 rounded shadow-sm backdrop-blur-sm ${
                                    isFlux 
                                    ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/50' 
                                    : isTerminal 
                                    ? 'bg-black text-green-500 border border-green-700'
                                    : isVintage
                                    ? 'bg-[#f5f5f0]/90 text-[#3d2e1e] border border-[#d6a86d] shadow-black/20 font-serif'
                                    : isNeon
                                    ? 'bg-purple-900/90 text-white border border-fuchsia-500 shadow-[0_0_10px_#d946ef]'
                                    : isCrystal
                                    ? 'bg-white/80 text-indigo-700 border border-white shadow-sm'
                                    : 'bg-white/90 text-black border border-stone-300'
                                }`}>
                                    {noteName}
                                </span>
                            </div>
                        );
                    })}
                </div>
             );
           })}
         </div>
      )}

      {/* Vibration Animation Injection */}
      <style>{`
        ${Array.from(visualTouches.values()).map((t: TouchData) => `
            .group:nth-child(${t.stringIndex + 1}) .animate-vibrate {
                animation-duration: ${0.08 - (t.velocity * 0.04)}s !important;
                --vibration-amp: ${settings.vibrationIntensity * (0.5 + t.velocity)}px !important;
            }
        `).join('\n')}
      
        @keyframes vibrate {
          0% { transform: translateY(0); }
          25% { transform: translateY(calc(var(--vibration-amp) * -1)); }
          50% { transform: translateY(0); }
          75% { transform: translateY(var(--vibration-amp)); }
          100% { transform: translateY(0); }
        }
        .animate-vibrate { animation: vibrate 0.06s infinite linear; }
      `}</style>
    </div>
  );
};