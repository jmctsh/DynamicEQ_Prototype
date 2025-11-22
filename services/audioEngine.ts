
import { EqBand, FilterType } from '../types';

class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private analyserInput: AnalyserNode | null = null;
  private analyserOutput: AnalyserNode | null = null;
  private sourceNode: AudioBufferSourceNode | OscillatorNode | MediaStreamAudioSourceNode | null = null;
  private filters: Map<string, BiquadFilterNode> = new Map();
  private noiseBuffer: AudioBuffer | null = null;
  
  // File Playback State
  private fileBuffer: AudioBuffer | null = null;
  private playbackStartTime: number = 0;
  private playbackOffset: number = 0;

  constructor() {
    // Initialize context lazily
  }

  private initContext() {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.context.destination);

      this.analyserInput = this.context.createAnalyser();
      this.analyserInput.fftSize = 2048;
      this.analyserInput.smoothingTimeConstant = 0.85;

      this.analyserOutput = this.context.createAnalyser();
      this.analyserOutput.fftSize = 2048;
      this.analyserOutput.smoothingTimeConstant = 0.85;
      this.analyserOutput.connect(this.masterGain);

      // Create noise buffer
      const bufferSize = this.context.sampleRate * 2; // 2 seconds
      this.noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
      const output = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
    }
  }

  public async loadAudioFile(file: File): Promise<void> {
    this.initContext();
    if (!this.context) return;

    const arrayBuffer = await file.arrayBuffer();
    this.fileBuffer = await this.context.decodeAudioData(arrayBuffer);
    this.playbackOffset = 0; // Reset playback position
  }

  public async start(sourceType: 'noise' | 'oscillator' | 'mic' | 'file' = 'noise') {
    this.initContext();
    if (!this.context || !this.masterGain || !this.analyserInput || !this.analyserOutput) return;

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.stop(); // Stop existing source

    if (sourceType === 'mic') {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.sourceNode = this.context.createMediaStreamSource(stream);
      } catch (e) {
        console.error("Mic permission denied", e);
        return;
      }
    } else if (sourceType === 'noise' && this.noiseBuffer) {
      const noise = this.context.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;
      this.sourceNode = noise;
      (this.sourceNode as AudioBufferSourceNode).start();
    } else if (sourceType === 'file' && this.fileBuffer) {
       const source = this.context.createBufferSource();
       source.buffer = this.fileBuffer;
       // Simple loop for prototype, or just play once
       source.loop = true; 
       this.sourceNode = source;
       (this.sourceNode as AudioBufferSourceNode).start(0, this.playbackOffset % this.fileBuffer.duration);
       this.playbackStartTime = this.context.currentTime;
    } else {
       // Oscillator
       const osc = this.context.createOscillator();
       osc.type = 'sawtooth';
       osc.frequency.value = 100;
       this.sourceNode = osc;
       (this.sourceNode as OscillatorNode).start();
    }

    if (this.sourceNode) {
      // Connect Source -> Input Analyser -> (Filter Chain handled by updateFilters)
      this.sourceNode.connect(this.analyserInput);
      // Initially connect input to output if no filters
      this.analyserInput.connect(this.analyserOutput);
    }
  }

  public stop() {
    if (this.sourceNode) {
      if ('stop' in this.sourceNode) {
        try { (this.sourceNode as any).stop(); } catch (e) {}
      }
      this.sourceNode.disconnect();
      this.sourceNode = null;

      // Save offset if file was playing
      if (this.context) {
        this.playbackOffset += (this.context.currentTime - this.playbackStartTime);
      }
    }
  }

  public updateFilters(bands: EqBand[]) {
    this.initContext();
    if (!this.context || !this.analyserInput || !this.analyserOutput) return;

    // Disconnect everything between input and output analyser
    this.analyserInput.disconnect();
    
    this.filters.clear();

    let previousNode: AudioNode = this.analyserInput;

    // Only add filters that are ENABLED
    bands.filter(b => b.enabled).forEach(band => {
      if (!this.context) return;
      const filter = this.context.createBiquadFilter();
      filter.type = band.type as BiquadFilterType;
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q;
      filter.gain.value = band.gain;
      
      // Note: For this Web Audio prototype, we use standard BiquadFilters.
      // True VST-style dynamic EQ requires AudioWorklet implementation.
      
      previousNode.connect(filter);
      previousNode = filter;
      this.filters.set(band.id, filter);
    });

    previousNode.connect(this.analyserOutput);
  }

  /**
   * Export processed audio using OfflineAudioContext
   */
  public async exportAudio(bands: EqBand[]): Promise<Blob | null> {
    if (!this.fileBuffer) {
      throw new Error("No audio file loaded to export");
    }

    const length = this.fileBuffer.length;
    const sampleRate = this.fileBuffer.sampleRate;
    
    // Create Offline Context
    const offlineCtx = new OfflineAudioContext(
      this.fileBuffer.numberOfChannels,
      length,
      sampleRate
    );

    // Create Source
    const source = offlineCtx.createBufferSource();
    source.buffer = this.fileBuffer;

    // Create Filter Chain mirrors current settings
    let previousNode: AudioNode = source;

    bands.filter(b => b.enabled).forEach(band => {
      const filter = offlineCtx.createBiquadFilter();
      filter.type = band.type as BiquadFilterType;
      filter.frequency.value = band.frequency;
      filter.Q.value = band.q;
      filter.gain.value = band.gain;
      
      previousNode.connect(filter);
      previousNode = filter;
    });

    // Connect to destination
    previousNode.connect(offlineCtx.destination);

    // Render
    source.start(0);
    const renderedBuffer = await offlineCtx.startRendering();

    // Encode to WAV
    return this.bufferToWav(renderedBuffer);
  }

  private bufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i;
    let sample;
    let offset = 0;
    let pos = 0;
  
    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
  
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)
  
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length
  
    // write interleaved data
    for(i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));
  
    while(pos < buffer.length) {
      for(i = 0; i < numOfChan; i++) { // interleave channels
        sample = Math.max(-1, Math.min(1, channels[i][pos])); // clamp
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; // scale to 16-bit signed int
        view.setInt16(44 + offset, sample, true);
        offset += 2;
      }
      pos++;
    }
  
    return new Blob([bufferArr], { type: 'audio/wav' });
  
    function setUint16(data: any) {
      view.setUint16(pos, data, true);
      pos += 2;
    }
  
    function setUint32(data: any) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }

  public getAnalysers() {
    return {
      input: this.analyserInput,
      output: this.analyserOutput
    };
  }
}

export const audioEngine = new AudioEngine();
