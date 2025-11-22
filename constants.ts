
import { FilterType, EqBand } from './types';

export const MIN_FREQ = 20;
export const MAX_FREQ = 20000;
export const MIN_DB = -30;
export const MAX_DB = 30;
export const MIN_Q = 0.1;
export const MAX_Q = 18.0;

// Colors similar to Pro-Q
export const BAND_COLORS = [
  '#ef4444', // Red
  '#eab308', // Yellow
  '#22c55e', // Green
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
  '#a855f7', // Purple
  '#f472b6', // Pink
];

export const DEFAULT_DYNAMIC_SETTINGS = {
  enabled: false,
  threshold: -18,
  range: -6,
  attack: 10,
  release: 100,
  ratio: 2,
  knee: 6,
  mix: 100,
};

export const createDefaultBand = (id: string, freq: number = 1000): EqBand => ({
  id,
  enabled: true,
  frequency: freq,
  gain: 0,
  q: 1.0,
  type: FilterType.Peaking,
  color: BAND_COLORS[Math.floor(Math.random() * BAND_COLORS.length)],
  dynamic: { ...DEFAULT_DYNAMIC_SETTINGS },
});

// Math Helpers for UI
export const freqToX = (freq: number, width: number): number => {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const freqLog = Math.log10(Math.max(MIN_FREQ, Math.min(freq, MAX_FREQ)));
  return ((freqLog - minLog) / (maxLog - minLog)) * width;
};

export const xToFreq = (x: number, width: number): number => {
  const minLog = Math.log10(MIN_FREQ);
  const maxLog = Math.log10(MAX_FREQ);
  const freqLog = (x / width) * (maxLog - minLog) + minLog;
  return Math.pow(10, freqLog);
};

export const dbToY = (db: number, height: number): number => {
  // Map +30dB to 0 (top) and -30dB to height (bottom)
  const range = MAX_DB - MIN_DB;
  const normalized = (db - MIN_DB) / range;
  return height - normalized * height;
};

export const yToDb = (y: number, height: number): number => {
  const range = MAX_DB - MIN_DB;
  const normalized = (height - y) / height;
  return normalized * range + MIN_DB;
};
