import { AudioSettings } from '../types';

interface ExtendedOscillatorNode extends OscillatorNode {
  isOctave?: boolean;
}

class AudioEngine {
  public ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  
  // Dynamics & EQ
  private compressorNode: DynamicsCompressorNode | null = null;
  private eqLow: BiquadFilterNode | null = null;
  private eqMid: BiquadFilterNode | null = null;
  private eqHigh: BiquadFilterNode | null = null;
  
  // Color
  private filterNode: BiquadFilterNode | null = null;
  private driveNode: WaveShaperNode | null = null;
  
  // Effects Nodes
  private phaserInput: GainNode | null = null;
  private phaserOutput: GainNode | null = null;
  private phaserDry: GainNode | null = null;
  private phaserWet: GainNode | null = null;
  private phaserFilters: BiquadFilterNode[] = [];
  private phaserLFO: OscillatorNode | null = null;
  private phaserLFOGain: GainNode | null = null;

  private tremoloNode: GainNode | null = null;
  private tremoloLFO: OscillatorNode | null = null;
  private tremoloLFOGain: GainNode | null = null;

  private convolverNode: ConvolverNode | null = null;
  private reverbGainNode: GainNode | null = null;

  private chorusDelayNode: DelayNode | null = null;
  private chorusGainNode: GainNode | null = null;
  private chorusLFO: OscillatorNode | null = null;
  private chorusLFOGain: GainNode | null = null;

  private delayNode: DelayNode | null = null;
  private delayFeedbackNode: GainNode | null = null;
  private delayOutputGain: GainNode | null = null;

  private vibratoLFO: OscillatorNode | null = null;
  private vibratoGain: GainNode | null = null;

  private activeNodes: Map<string, { 
    sources: AudioNode[]; 
    gain: GainNode; 
    panner: StereoPannerNode; 
    startTime: number;
    baseFreq: number;
    isReleasing: boolean; 
  }> = new Map();

  private pluckBuffer: AudioBuffer | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  private settings: AudioSettings = {
    volume: 0.85,
    distortion: 0.05,
    eqBass: 0,
    eqMid: 0,
    eqTreble: 0,
    compressorThreshold: -20,
    compressorRatio: 4,
    tone: 0.5,
    filterResonance: 0,
    filterEnvAmount: 0,
    attack: 0.01,
    release: 0.2,
    sustain: 1.0,
    glideTime: 0.05,
    velocitySensitivity: 0.5,
    isMonophonic: false,
    waveform: 'sawtooth',
    subLevel: 0.0,
    noiseLevel: 0.1,
    phaserMix: 0,
    phaserRate: 1.0,
    tremoloDepth: 0,
    tremoloRate: 4.0,
    chorus: 0.0,
    reverb: 0.15,
    vibrato: 0.0,
    delayMix: 0.0,
    delayTime: 0.3,
    delayFeedback: 0.3,
    stereoWidth: 0.5,
    octavePedal: false,
    octaveShift: false,
    showNotes: false,
    vibrationIntensity: 1.5,
    theme: 'vintage',
    stringCount: 6,
    fretCount: 12,
  };

  public init() {
    if (this.ctx) return;
    
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    this.ctx = new AudioContextClass({ latencyHint: 'interactive' });

    // --- Buffers ---
    const bufferSize = this.ctx.sampleRate * 0.02; 
    this.pluckBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const pData = this.pluckBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      pData[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }

    const noiseLen = this.ctx.sampleRate * 1.0; 
    this.noiseBuffer = this.ctx.createBuffer(1, noiseLen, this.ctx.sampleRate);
    const nData = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) {
      nData[i] = (Math.random() * 2 - 1) * 0.5;
    }

    // --- Nodes Initialization ---
    this.masterGain = this.ctx.createGain();
    this.compressorNode = this.ctx.createDynamicsCompressor();
    
    // EQ Chain
    this.eqLow = this.ctx.createBiquadFilter();
    this.eqLow.type = 'lowshelf';
    this.eqLow.frequency.value = 200;

    this.eqMid = this.ctx.createBiquadFilter();
    this.eqMid.type = 'peaking';
    this.eqMid.frequency.value = 800;
    this.eqMid.Q.value = 1.0;

    this.eqHigh = this.ctx.createBiquadFilter();
    this.eqHigh.type = 'highshelf';
    this.eqHigh.frequency.value = 3000;

    this.filterNode = this.ctx.createBiquadFilter(); 
    this.driveNode = this.ctx.createWaveShaper();
    
    // -- PHASER SETUP --
    this.phaserInput = this.ctx.createGain();
    this.phaserOutput = this.ctx.createGain();
    this.phaserDry = this.ctx.createGain();
    this.phaserWet = this.ctx.createGain();
    this.phaserLFO = this.ctx.createOscillator();
    this.phaserLFOGain = this.ctx.createGain();
    
    // Create 4-stage allpass chain
    for(let i=0; i<4; i++) {
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'allpass';
        filter.frequency.value = 1000;
        this.phaserFilters.push(filter);
    }
    // Chain filters
    for(let i=0; i<this.phaserFilters.length - 1; i++) {
        this.phaserFilters[i].connect(this.phaserFilters[i+1]);
    }

    this.phaserInput.connect(this.phaserDry);
    this.phaserInput.connect(this.phaserFilters[0]);
    this.phaserFilters[this.phaserFilters.length - 1].connect(this.phaserWet);
    this.phaserDry.connect(this.phaserOutput);
    this.phaserWet.connect(this.phaserOutput);
    
    // Phaser LFO
    this.phaserLFO.frequency.value = 1.0;
    this.phaserLFOGain.gain.value = 600; // Modulation depth (Hz)
    this.phaserLFO.connect(this.phaserLFOGain);
    this.phaserFilters.forEach(f => this.phaserLFOGain?.connect(f.frequency));
    this.phaserLFO.start();


    // -- TREMOLO SETUP --
    this.tremoloNode = this.ctx.createGain();
    this.tremoloLFO = this.ctx.createOscillator();
    this.tremoloLFOGain = this.ctx.createGain();
    this.tremoloLFO.type = 'sine';
    this.tremoloLFO.frequency.value = 4.0;
    this.tremoloLFOGain.gain.value = 0; // Starts off
    this.tremoloLFO.connect(this.tremoloLFOGain);
    this.tremoloLFOGain.connect(this.tremoloNode.gain);
    this.tremoloLFO.start();


    // -- MODULATION (Chorus) --
    this.chorusDelayNode = this.ctx.createDelay();
    this.chorusDelayNode.delayTime.value = 0.03;
    this.chorusGainNode = this.ctx.createGain();
    this.chorusLFO = this.ctx.createOscillator();
    this.chorusLFOGain = this.ctx.createGain();
    this.chorusLFO.frequency.value = 1.5;
    this.chorusLFOGain.gain.value = 0.002;
    this.chorusLFO.connect(this.chorusLFOGain);
    this.chorusLFOGain.connect(this.chorusDelayNode.delayTime);
    this.chorusLFO.start();

    // -- DELAY --
    this.delayNode = this.ctx.createDelay(5.0);
    this.delayFeedbackNode = this.ctx.createGain();
    this.delayOutputGain = this.ctx.createGain();
    this.delayNode.connect(this.delayFeedbackNode);
    this.delayFeedbackNode.connect(this.delayNode);
    this.delayNode.connect(this.delayOutputGain);

    // -- VIBRATO (Pitch) --
    this.vibratoLFO = this.ctx.createOscillator();
    this.vibratoLFO.frequency.value = 5.0;
    this.vibratoGain = this.ctx.createGain();
    this.vibratoGain.gain.value = 0;
    this.vibratoLFO.connect(this.vibratoGain);
    this.vibratoLFO.start();

    // -- REVERB --
    this.convolverNode = this.ctx.createConvolver();
    this.reverbGainNode = this.ctx.createGain();
    this.convolverNode.buffer = this.createImpulseResponse(1.5, 2.5);

    // -- COMPRESSOR --
    this.compressorNode.knee.value = 10;
    this.compressorNode.attack.value = 0.005;
    this.compressorNode.release.value = 0.05;

    this.driveNode.curve = this.makeDistortionCurve(0);
    this.driveNode.oversample = '4x';
    this.filterNode.type = 'lowpass';

    // --- SIGNAL CHAIN ---
    // 1. Core Chain: Drive -> Filter -> EQ -> Phaser -> Tremolo
    this.driveNode.connect(this.filterNode);
    this.filterNode.connect(this.eqLow);
    this.eqLow.connect(this.eqMid);
    this.eqMid.connect(this.eqHigh);
    
    // Connect EQ to Phaser
    this.eqHigh.connect(this.phaserInput!);

    // Connect Phaser to Tremolo
    this.phaserOutput!.connect(this.tremoloNode);

    // 2. Tremolo Output is the "Main" signal for effects distribution
    const mainSignal = this.tremoloNode;

    // A. To Compressor (Main Path)
    mainSignal.connect(this.compressorNode);

    // B. To Effects Sends
    // Chorus
    mainSignal.connect(this.chorusDelayNode);
    this.chorusDelayNode.connect(this.chorusGainNode);
    this.chorusGainNode.connect(this.compressorNode); // Join before compressor

    // Delay
    mainSignal.connect(this.delayNode);
    this.delayOutputGain.connect(this.compressorNode);

    // Reverb (Post Compressor or Pre? Let's do Pre to compress the tail, or Post to keep tail dynamic. 
    // Usually Send -> Return. Let's send from MainSignal, return to Master directly to avoid pumping.)
    mainSignal.connect(this.convolverNode);
    this.convolverNode.connect(this.reverbGainNode);
    this.reverbGainNode.connect(this.masterGain);

    // 3. Compressor -> Master
    this.compressorNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);
    
    this.updateSettings(this.settings);
  }

  private createImpulseResponse(duration: number, decay: number) {
    if (!this.ctx) return null;
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
        const n = i / length; 
        const gain = Math.pow(1 - n, decay); 
        left[i] = (Math.random() * 2 - 1) * gain;
        right[i] = (Math.random() * 2 - 1) * gain;
    }
    return impulse;
  }

  public checkState() {
      if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume().catch(() => {});
      }
  }

  public resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public updateSettings(newSettings: Partial<AudioSettings>) {
    this.settings = { ...this.settings, ...newSettings };
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Master
    if (this.masterGain) this.masterGain.gain.setTargetAtTime(this.settings.volume, now, 0.02);
    
    // Compressor
    if (this.compressorNode) {
        this.compressorNode.threshold.setTargetAtTime(this.settings.compressorThreshold, now, 0.1);
        this.compressorNode.ratio.setTargetAtTime(this.settings.compressorRatio, now, 0.1);
    }

    // Phaser
    if (this.phaserWet && this.phaserDry) {
        this.phaserWet.gain.setTargetAtTime(this.settings.phaserMix, now, 0.1);
        this.phaserDry.gain.setTargetAtTime(1 - (this.settings.phaserMix * 0.5), now, 0.1); // Compensate
    }
    if (this.phaserLFO) {
        this.phaserLFO.frequency.setTargetAtTime(this.settings.phaserRate, now, 0.1);
    }

    // Tremolo
    if (this.tremoloNode) {
        // Base gain is 1 - depth/2. Modulation adds depth/2.
        // Simplified: Oscillator output is -1 to 1. 
        // We want gain to oscillate between 1 and (1-depth).
        // If depth is 1: 0 to 1.
        // We set LFO gain to depth/2. 
        // We set TremoloNode gain to 1 - (depth/2).
        const depth = this.settings.tremoloDepth;
        if (this.tremoloLFOGain) this.tremoloLFOGain.gain.setTargetAtTime(depth * 0.5, now, 0.1);
        this.tremoloNode.gain.setTargetAtTime(1 - (depth * 0.5), now, 0.1);
    }
    if (this.tremoloLFO) {
        this.tremoloLFO.frequency.setTargetAtTime(this.settings.tremoloRate, now, 0.1);
    }

    // Filter
    if (this.filterNode) {
        const minFreq = 100;
        const maxFreq = 8000;
        const cutoff = minFreq + (maxFreq - minFreq) * (this.settings.tone * this.settings.tone);
        this.filterNode.frequency.setTargetAtTime(cutoff, now, 0.05);
        this.filterNode.Q.setTargetAtTime(this.settings.filterResonance * 20, now, 0.05);
    }

    // EQ
    if (this.eqLow) this.eqLow.gain.setTargetAtTime(this.settings.eqBass, now, 0.1);
    if (this.eqMid) this.eqMid.gain.setTargetAtTime(this.settings.eqMid, now, 0.1);
    if (this.eqHigh) this.eqHigh.gain.setTargetAtTime(this.settings.eqTreble, now, 0.1);

    // Drive
    if (this.driveNode) this.driveNode.curve = this.makeDistortionCurve(this.settings.distortion * 100);
    
    // Effects
    if (this.reverbGainNode) this.reverbGainNode.gain.setTargetAtTime(this.settings.reverb, now, 0.05);
    if (this.chorusGainNode) this.chorusGainNode.gain.setTargetAtTime(this.settings.chorus, now, 0.05);
    if (this.vibratoGain) this.vibratoGain.gain.setTargetAtTime(this.settings.vibrato * 50, now, 0.05);

    // Delay
    if (this.delayNode) this.delayNode.delayTime.setTargetAtTime(this.settings.delayTime, now, 0.1);
    if (this.delayFeedbackNode) this.delayFeedbackNode.gain.setTargetAtTime(this.settings.delayFeedback, now, 0.1);
    if (this.delayOutputGain) this.delayOutputGain.gain.setTargetAtTime(this.settings.delayMix, now, 0.1);
  }

  private makeDistortionCurve(amount: number) {
    const k = typeof amount === 'number' ? amount : 50;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    if (amount === 0) {
      for (let i = 0; i < n_samples; ++i) curve[i] = (i * 2) / n_samples - 1;
      return curve;
    }
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public isNotePlaying(noteId: string): boolean {
    const node = this.activeNodes.get(noteId);
    // Note is considered playing ONLY if it exists AND is not currently fading out
    return !!node && !node.isReleasing;
  }

  public startNote(noteId: string, frequency: number, velocity: number = 1.0, stringIndex: number = 3) {
    if (!this.ctx) return;
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    
    // Cleanup old nodes safely
    if (this.activeNodes.has(noteId)) {
      this.killNoteImmediate(noteId);
    }

    const now = this.ctx.currentTime;
    const playFreq = this.settings.octaveShift ? frequency * 2 : frequency;
    
    const sources: AudioNode[] = [];

    // Stereo Pan
    const totalStrings = this.settings.stringCount;
    const normalizedPos = totalStrings > 1 ? stringIndex / (totalStrings - 1) : 0.5;
    const panVal = (1 - (normalizedPos * 2)) * this.settings.stereoWidth;

    const notePanner = this.ctx.createStereoPanner();
    notePanner.pan.value = panVal;

    // --- Signal Chain Construction ---
    const noteGain = this.ctx.createGain();
    noteGain.gain.setValueAtTime(0, now);
    
    const driveBoost = 1.0 + (velocity > 0.7 ? (velocity - 0.7) * 0.8 : 0); 
    const volumeCurve = 0.1 + (0.9 * velocity * velocity); 
    const targetGain = volumeCurve * driveBoost;
    
    const attackEnd = now + Math.max(0.005, this.settings.attack);
    noteGain.gain.linearRampToValueAtTime(targetGain, attackEnd);

    if (this.settings.sustain < 1.0) {
       const minDecay = 0.1;
       const maxDecay = 10.0;
       const decayDuration = minDecay + (maxDecay - minDecay) * (this.settings.sustain * this.settings.sustain);
       noteGain.gain.exponentialRampToValueAtTime(0.001, attackEnd + decayDuration);
    }

    noteGain.connect(notePanner);
    notePanner.connect(this.driveNode!); 

    // --- Sources ---

    // Body Osc
    const bodyOsc = this.ctx.createOscillator() as ExtendedOscillatorNode;
    bodyOsc.isOctave = false;
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(playFreq, now); 
    const bodyGain = this.ctx.createGain();
    bodyGain.gain.value = 0.5 + (0.5 * velocity); 
    
    bodyOsc.connect(bodyGain);
    bodyGain.connect(noteGain);
    sources.push(bodyOsc);
    bodyOsc.start(now);

    if (this.vibratoGain) this.vibratoGain.connect(bodyOsc.detune);

    // Sub Osc
    if (this.settings.subLevel > 0.01) {
        const subOsc = this.ctx.createOscillator() as ExtendedOscillatorNode;
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(playFreq * 0.5, now);
        const subGain = this.ctx.createGain();
        subGain.gain.value = this.settings.subLevel * 0.6 * velocity; 
        subOsc.connect(subGain);
        subGain.connect(noteGain);
        sources.push(subOsc);
        subOsc.start(now);
    }

    // Character Osc
    const charOsc = this.ctx.createOscillator() as ExtendedOscillatorNode;
    charOsc.isOctave = false;
    charOsc.type = this.settings.waveform; 
    charOsc.frequency.setValueAtTime(playFreq, now);
    
    const charFilter = this.ctx.createBiquadFilter();
    charFilter.type = 'lowpass';
    charFilter.Q.value = this.settings.filterResonance * 10; 
    
    const baseCutoff = playFreq * (1.5 + this.settings.tone);
    const envAmt = this.settings.filterEnvAmount * 2000;
    
    const filterStart = baseCutoff + (envAmt * velocity); 
    const filterEnd = baseCutoff; 
    
    charFilter.frequency.setValueAtTime(filterStart, now);
    charFilter.frequency.exponentialRampToValueAtTime(Math.max(20, filterEnd), now + this.settings.attack + 0.2);

    const charGain = this.ctx.createGain();
    charGain.gain.value = 0.2 + (0.8 * Math.pow(velocity, 2)); 

    charOsc.connect(charFilter);
    charFilter.connect(charGain);
    charGain.connect(noteGain);
    sources.push(charOsc);
    charOsc.start(now);

    if (this.vibratoGain) this.vibratoGain.connect(charOsc.detune);

    // Noise
    if (this.noiseBuffer && this.settings.noiseLevel > 0.01) {
        const noiseSource = this.ctx.createBufferSource();
        noiseSource.buffer = this.noiseBuffer;
        noiseSource.loop = true;
        
        const noiseFilter = this.ctx.createBiquadFilter();
        noiseFilter.type = 'bandpass';
        noiseFilter.frequency.value = 2000 + (Math.random() * 1000);
        noiseFilter.Q.value = 1.0;

        const noiseGain = this.ctx.createGain();
        noiseGain.gain.value = this.settings.noiseLevel * 0.1 * velocity;
        noiseGain.gain.setValueAtTime(noiseGain.gain.value, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

        noiseSource.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(noteGain);
        sources.push(noiseSource);
        noiseSource.start(now);
    }

    // Pluck
    if (this.pluckBuffer) {
        const pluckSource = this.ctx.createBufferSource();
        pluckSource.buffer = this.pluckBuffer;
        const pluckFilter = this.ctx.createBiquadFilter();
        pluckFilter.type = 'lowpass';
        pluckFilter.frequency.value = 3000;
        const pluckGain = this.ctx.createGain();
        pluckGain.gain.value = 0.5 * Math.pow(velocity, 2);
        
        pluckSource.connect(pluckFilter);
        pluckFilter.connect(pluckGain);
        pluckGain.connect(noteGain);
        sources.push(pluckSource);
        pluckSource.start(now);
    }

    // Octave Pedal
    if (this.settings.octavePedal) {
      const octOsc = this.ctx.createOscillator() as ExtendedOscillatorNode;
      octOsc.isOctave = true;
      octOsc.type = 'triangle'; 
      octOsc.frequency.setValueAtTime(playFreq * 2, now);
      const octGain = this.ctx.createGain();
      octGain.gain.value = 0.5 * velocity; 
      octOsc.connect(octGain);
      octGain.connect(noteGain);
      sources.push(octOsc);
      octOsc.start(now);
      if (this.vibratoGain) this.vibratoGain.connect(octOsc.detune);
    }

    this.activeNodes.set(noteId, { 
        sources, 
        gain: noteGain, 
        panner: notePanner, 
        startTime: now,
        baseFreq: playFreq,
        isReleasing: false 
    });
  }

  public updateNotePitch(noteId: string, frequency: number) {
    if (!this.ctx) return;
    const node = this.activeNodes.get(noteId);
    if (node && !node.isReleasing) { // Do not update pitch if note is fading out
      const now = this.ctx.currentTime;
      const playFreq = this.settings.octaveShift ? frequency * 2 : frequency;
      const glide = this.settings.glideTime;
      
      node.sources.forEach(source => {
          if (source instanceof OscillatorNode) {
              const osc = source as ExtendedOscillatorNode;
              if (osc.isOctave === true) {
                  osc.frequency.setTargetAtTime(playFreq * 2, now, glide);
              } else {
                  osc.frequency.setTargetAtTime(playFreq, now, glide);
              }
          }
      });
      node.baseFreq = playFreq;
    }
  }

  public stopNote(noteId: string) {
    if (!this.ctx) return;
    const node = this.activeNodes.get(noteId);
    if (node && !node.isReleasing) {
      // Mark as releasing immediately so isNotePlaying returns false
      node.isReleasing = true;
      
      const now = this.ctx.currentTime;
      const release = Math.max(0.05, this.settings.release);

      node.gain.gain.cancelScheduledValues(now);
      node.gain.gain.setValueAtTime(node.gain.gain.value, now);
      node.gain.gain.exponentialRampToValueAtTime(0.001, now + release);

      node.sources.forEach(source => {
          if (source instanceof OscillatorNode || source instanceof AudioBufferSourceNode) {
              source.stop(now + release + 0.1);
              if (source instanceof OscillatorNode && this.vibratoGain) {
                  try { this.vibratoGain.disconnect(source.detune); } catch (e) {}
              }
          }
      });

      window.setTimeout(() => {
          // Double check it wasn't re-used/re-started (though IDs should be unique)
          if (this.activeNodes.get(noteId) === node) {
             node.sources.forEach(s => s.disconnect());
             node.gain.disconnect();
             node.panner.disconnect();
             this.activeNodes.delete(noteId);
          }
      }, (release + 0.2) * 1000);
    }
  }

  public killNoteImmediate(noteId: string) {
    if (!this.ctx) return;
    const node = this.activeNodes.get(noteId);
    if (node) {
        this.activeNodes.delete(noteId);
        const now = this.ctx.currentTime;
        node.gain.gain.setTargetAtTime(0, now, 0.01);
        node.sources.forEach(source => {
            if (source instanceof OscillatorNode) {
                source.stop(now + 0.05);
                if (this.vibratoGain) {
                    try { this.vibratoGain.disconnect(source.detune); } catch(e) {}
                }
            }
        });
        setTimeout(() => {
             node.gain.disconnect();
             node.panner.disconnect();
             node.sources.forEach(s => s.disconnect());
        }, 100);
    }
  }
}

export const audioEngine = new AudioEngine();