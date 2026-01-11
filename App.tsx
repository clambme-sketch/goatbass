import React, { useState, useEffect } from 'react';
import { Fretboard } from './components/Fretboard';
import { Controls } from './components/Controls';
import { AudioSettings } from './types';
import { audioEngine } from './services/AudioEngine';

const App: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [isReady, setIsReady] = useState(false); // Animation trigger
  
  const [settings, setSettings] = useState<AudioSettings>({
    volume: 0.85,
    tone: 0.5,
    distortion: 0.05,
    eqBass: 0, eqMid: 0, eqTreble: 0,
    compressorThreshold: -20, compressorRatio: 4,
    chorus: 0.0,
    reverb: 0.15,
    vibrato: 0.0,
    phaserMix: 0, phaserRate: 1.0,
    tremoloDepth: 0, tremoloRate: 4.0,
    delayMix: 0, delayTime: 0.3, delayFeedback: 0.3,
    sustain: 1.0, 
    stereoWidth: 0.5,
    subLevel: 0.0,
    noiseLevel: 0.1,
    waveform: 'sawtooth',
    filterResonance: 0, filterEnvAmount: 0,
    attack: 0.01,
    release: 0.2,
    glideTime: 0.05,
    showNotes: false,
    octavePedal: false,
    octaveShift: false,
    vibrationIntensity: 1.5,
    velocitySensitivity: 0.5, 
    isMonophonic: false,
    theme: 'vintage', // Default Theme
    stringCount: 6, // 6 Strings: B to C
    fretCount: 12
  });

  useEffect(() => {
    const preventDefault = (e: Event) => e.preventDefault();
    document.addEventListener('gesturestart', preventDefault);
    document.addEventListener('gesturechange', preventDefault);
    document.addEventListener('gestureend', preventDefault);

    // Initial fade in
    setTimeout(() => setIsReady(true), 100);

    return () => {
      document.removeEventListener('gesturestart', preventDefault);
      document.removeEventListener('gesturechange', preventDefault);
      document.removeEventListener('gestureend', preventDefault);
    };
  }, []);

  const handleStart = () => {
    audioEngine.init();
    audioEngine.resume();
    setHasStarted(true);
  };

  const theme = settings.theme;
  const isFlux = theme === 'flux';
  const isTerminal = theme === 'terminal';
  const isVintage = theme === 'vintage';
  const isNeon = theme === 'neon';
  const isCrystal = theme === 'crystal';

  // Dynamic Backgrounds for Main App
  let bgStyle = {};
  if (isFlux) bgStyle = { background: 'radial-gradient(circle at center, #1e293b 0%, #020617 100%)' };
  else if (isTerminal) bgStyle = { backgroundColor: '#000000', backgroundImage: 'radial-gradient(rgba(0, 50, 0, 0.2) 2px, transparent 2px)', backgroundSize: '30px 30px' };
  else if (isVintage) bgStyle = { backgroundColor: '#1a0f0f', backgroundImage: 'radial-gradient(circle at 50% 50%, #3e2b26 0%, #1a0f0f 100%)' };
  else if (isNeon) bgStyle = { backgroundColor: '#0f0518' };
  else if (isCrystal) bgStyle = { background: 'linear-gradient(135deg, #fdfbf7 0%, #eef2f6 100%)' };
  else bgStyle = { backgroundColor: '#111' };

  return (
    <div className="relative w-full h-full overflow-hidden select-none touch-none font-sans" style={bgStyle}>
      
      {/* HUD / Menu Toggle */}
      <div className={`absolute top-6 right-8 z-50 transition-all duration-500 ${hasStarted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <button 
          className={`p-4 rounded-full shadow-2xl backdrop-blur-md transition-all duration-300 group hover:scale-105 active:scale-95 ${
              isFlux ? 'bg-cyan-950/30 border border-cyan-500/50 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.2)]' 
              : isTerminal ? 'bg-black border-2 border-green-700 text-green-500 hover:bg-green-900/50 rounded-none'
              : isVintage ? 'bg-[#3b2b20] border-2 border-[#8b6b4b] text-[#e3caa5] shadow-[0_4px_10px_rgba(0,0,0,0.5)]'
              : isNeon ? 'bg-black/50 border-2 border-fuchsia-500 text-fuchsia-400 shadow-[0_0_15px_#d946ef]'
              : isCrystal ? 'bg-white/80 border border-white text-indigo-500 shadow-lg hover:bg-white hover:text-indigo-600'
              : 'bg-white/5 border border-white/10 text-white hover:bg-white/10'
          }`}
          onClick={() => setIsMenuOpen(true)}
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={isTerminal ? 2.5 : 1.5} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      {/* Main Interface */}
      <div className={`transition-opacity duration-1000 ${hasStarted ? 'opacity-100' : 'opacity-0 scale-95'}`}>
         <Fretboard isMenuOpen={isMenuOpen} settings={settings} />
      </div>

      {/* Controls Overlay */}
      <Controls 
        isOpen={isMenuOpen} 
        onClose={() => setIsMenuOpen(false)} 
        settings={settings}
        setSettings={setSettings}
      />

      {/* Cinematic Splash Screen */}
      {!hasStarted && (
        <div className={`absolute inset-0 z-[100] flex flex-col items-center justify-center transition-all duration-1000 ease-in-out ${
            !isReady ? 'opacity-0 scale-105' : 'opacity-100 scale-100'
        } ${
            isFlux ? 'bg-[#020617]' 
            : isTerminal ? 'bg-black' 
            : isVintage ? 'bg-[#18100c]' 
            : isNeon ? 'bg-[#0a000f]'
            : isCrystal ? 'bg-slate-50'
            : 'bg-[#0a0a0a]'
        }`}>
           
           {/* Dynamic Splash Background FX */}
           {isFlux && <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(6,182,212,0.15),_transparent_70%)] animate-pulse"></div>}
           {isVintage && (
               <>
                 <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-30 mix-blend-overlay"></div>
                 <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2a1d15]/50 to-[#0f0b08] pointer-events-none"></div>
               </>
           )}
           {isTerminal && <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,0,0.03)_1px,transparent_1px)] bg-[length:100%_4px]"></div>}
           {isNeon && <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,_rgba(217,70,239,0.15),_transparent_60%)]"></div>}
           {isCrystal && <div className="absolute inset-0 bg-[conic-gradient(at_top_right,_rgba(199,210,254,0.3)_0%,_transparent_50%),conic-gradient(at_bottom_left,_rgba(221,214,254,0.3)_0%,_transparent_50%)]"></div>}

           <div className="relative z-10 flex flex-col items-center gap-12 max-w-4xl p-8">
              
              {/* Logo / Title Area */}
              <div className="space-y-4 text-center">
                {isTerminal ? (
                    <div className="flex flex-col gap-2">
                        <h1 className="text-5xl md:text-7xl font-mono font-bold text-green-500 glitch-text" style={{ textShadow: '2px 2px 0px #003300' }}>
                           &gt; FRETLESS_V6
                        </h1>
                        <p className="text-green-800 font-mono text-sm uppercase tracking-widest animate-pulse">System Ready...</p>
                    </div>
                ) : isCrystal ? (
                    <div className="relative p-12">
                         <div className="absolute inset-0 bg-gradient-to-tr from-indigo-200 to-purple-200 blur-3xl opacity-30 rounded-full"></div>
                         <h1 className="relative text-6xl md:text-9xl font-thin tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-slate-700 to-slate-400 drop-shadow-sm">
                            Prism
                        </h1>
                        <p className="relative text-indigo-400 font-light tracking-[0.5em] text-sm mt-4 uppercase">Audio Synthesis Unit</p>
                    </div>
                ) : (
                    <div className="relative">
                        <h1 className={`text-6xl md:text-9xl font-black tracking-tighter leading-none ${
                            isFlux ? 'text-transparent bg-clip-text bg-gradient-to-b from-cyan-100 to-cyan-600 drop-shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                            : isVintage ? 'text-[#b8860b] font-serif tracking-tight drop-shadow-xl italic'
                            : isNeon ? 'text-transparent bg-clip-text bg-gradient-to-b from-fuchsia-200 to-purple-600 drop-shadow-[0_0_20px_rgba(232,121,249,0.8)]'
                            : 'text-white drop-shadow-2xl'
                        }`}>
                            {isVintage ? 'Goat Bass' : 'FRETLESS'}
                        </h1>
                        <div className={`text-center font-bold uppercase tracking-[0.8em] md:tracking-[1.2em] text-[10px] md:text-sm mt-4 ${
                             isFlux ? 'text-cyan-400' 
                             : isVintage ? 'text-[#8b6b4b] font-serif' 
                             : isNeon ? 'text-fuchsia-400 drop-shadow-[0_0_5px_rgba(217,70,239,0.6)]'
                             : 'text-stone-500'
                        }`}>
                            Synth Bass Emulator
                        </div>
                    </div>
                )}
              </div>
              
              {/* Interactive Start Button */}
              <button 
                onClick={handleStart}
                className={`group relative px-16 py-5 overflow-hidden transition-all duration-500 ease-out transform hover:scale-105 active:scale-95 ${
                    isFlux ? 'rounded-full border border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/50 shadow-[0_0_30px_rgba(6,182,212,0.2)]' 
                    : isTerminal ? 'border-2 border-green-600 bg-black hover:bg-green-900/20 shadow-[0_0_15px_rgba(34,197,94,0.2)]'
                    : isVintage ? 'rounded border-2 border-[#8b6b4b] bg-[#2a1d15] hover:border-[#b8860b] shadow-[0_10px_30px_rgba(0,0,0,0.5)]'
                    : isNeon ? 'rounded-full border-2 border-fuchsia-500 bg-black hover:bg-fuchsia-900/40 shadow-[0_0_20px_#d946ef]'
                    : isCrystal ? 'rounded-full border border-white bg-white/50 hover:bg-white shadow-lg backdrop-blur-md'
                    : 'rounded-full border border-white/20 bg-white/5 hover:bg-white/10 backdrop-blur-lg'
                }`}
              >
                 {/* Button Glow FX */}
                 <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 ${
                     isFlux ? 'bg-gradient-to-r from-transparent via-cyan-500/10 to-transparent'
                     : isVintage ? 'bg-gradient-to-t from-[#e3caa5]/10 to-transparent'
                     : isNeon ? 'bg-gradient-to-r from-fuchsia-500/20 to-purple-500/20'
                     : isCrystal ? 'bg-gradient-to-r from-indigo-100 via-purple-100 to-indigo-100'
                     : 'bg-white/5'
                 }`}></div>

                 <span className={`relative z-10 text-base md:text-lg font-bold tracking-widest uppercase flex items-center gap-4 ${
                     isFlux ? 'text-cyan-300' 
                     : isTerminal ? 'text-green-500' 
                     : isVintage ? 'text-[#e3caa5] font-serif'
                     : isNeon ? 'text-fuchsia-200'
                     : isCrystal ? 'text-slate-500 group-hover:text-indigo-500'
                     : 'text-white'
                 }`}>
                    {isTerminal ? 'INITIALIZE' : isCrystal ? 'Activate' : 'PLUG IN'}
                    <svg className="w-5 h-5 transition-transform group-hover:translate-x-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                 </span>
              </button>
          </div>
          
          {/* Footer Info */}
          <div className={`absolute bottom-8 text-[10px] uppercase tracking-widest font-medium ${isCrystal ? 'text-slate-400' : 'text-white/20'}`}>
              V7.1 Audio Engine • Low Latency
          </div>
        </div>
      )}
    </div>
  );
};

export default App;