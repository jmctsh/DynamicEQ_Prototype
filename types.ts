
export enum FilterType {
  LowPass = 'lowpass',
  HighPass = 'highpass',
  BandPass = 'bandpass',
  LowShelf = 'lowshelf',
  HighShelf = 'highshelf',
  Peaking = 'peaking',
  Notch = 'notch',
}

export interface DynamicSettings {
  enabled: boolean;
  threshold: number; // dB
  range: number; // dB (max gain reduction/expansion)
  attack: number; // ms
  release: number; // ms
  ratio: number; // e.g., 2.0 for 2:1
  knee: number; // dB
  mix: number; // 0-100%
}

export interface EqBand {
  id: string;
  enabled: boolean; // Band On/Off bypass
  frequency: number; // Hz
  gain: number; // dB
  q: number; // Q factor
  type: FilterType;
  dynamic: DynamicSettings;
  color: string;
}

export interface AudioState {
  isPlaying: boolean;
  sourceType: 'noise' | 'mic' | 'oscillator' | 'file';
  fileName?: string;
  isExporting?: boolean;
}
