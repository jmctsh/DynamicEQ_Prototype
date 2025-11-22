
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { EqBand, FilterType } from '../types';
import { freqToX, xToFreq, dbToY, yToDb, MIN_FREQ, MAX_FREQ, MIN_DB, MAX_DB } from '../constants';
import { audioEngine } from '../services/audioEngine';

interface EqVisualizerProps {
  bands: EqBand[];
  selectedBandId: string | null;
  onBandSelect: (id: string | null) => void;
  onBandUpdate: (band: EqBand) => void;
  onBandAdd: (band: EqBand) => void;
}

const EqVisualizer: React.FC<EqVisualizerProps> = ({ 
  bands, 
  selectedBandId, 
  onBandSelect, 
  onBandUpdate,
  onBandAdd
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [dragState, setDragState] = useState<{ bandId: string, startX: number, startY: number, startFreq: number, startGain: number } | null>(null);

  // Calculate Magnitude Response for Biquad Filters (Standard Audio EQ Cookbook formulas)
  const getBiquadMagnitude = useCallback((freq: number, type: FilterType, f0: number, Q: number, gainDb: number): number => {
    const Fs = 48000; // Simulation sample rate
    const w0 = (2 * Math.PI * f0) / Fs;
    const cosw0 = Math.cos(w0);
    const sinw0 = Math.sin(w0);
    const alpha = sinw0 / (2 * Q);
    
    // Convert gain from dB to linear amplitude A
    // Note: For Peaking and Shelves, A is used. For Pass/Notch, gainDb is typically ignored by standard biquads, 
    // but we include it for Peaking/Shelves logic.
    const A = Math.pow(10, gainDb / 40);

    let b0 = 0, b1 = 0, b2 = 0, a0 = 0, a1 = 0, a2 = 0;

    switch (type) {
      case FilterType.LowPass:
        b0 = (1 - cosw0) / 2;
        b1 = 1 - cosw0;
        b2 = (1 - cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case FilterType.HighPass:
        b0 = (1 + cosw0) / 2;
        b1 = -(1 + cosw0);
        b2 = (1 + cosw0) / 2;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case FilterType.BandPass:
        b0 = alpha;
        b1 = 0;
        b2 = -alpha;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case FilterType.Notch:
        b0 = 1;
        b1 = -2 * cosw0;
        b2 = 1;
        a0 = 1 + alpha;
        a1 = -2 * cosw0;
        a2 = 1 - alpha;
        break;
      case FilterType.Peaking:
        b0 = 1 + alpha * A;
        b1 = -2 * cosw0;
        b2 = 1 - alpha * A;
        a0 = 1 + alpha / A;
        a1 = -2 * cosw0;
        a2 = 1 - alpha / A;
        break;
      case FilterType.LowShelf:
        // We use a simplified Q approximation here if Q is provided, though standard lowshelf uses S.
        // Audio Cookbook formula for LowShelf with Q:
        {
            const rootA = Math.sqrt(A);
            b0 = A * ((A + 1) - (A - 1) * cosw0 + 2 * rootA * alpha);
            b1 = 2 * A * ((A - 1) - (A + 1) * cosw0);
            b2 = A * ((A + 1) - (A - 1) * cosw0 - 2 * rootA * alpha);
            a0 = (A + 1) + (A - 1) * cosw0 + 2 * rootA * alpha;
            a1 = -2 * ((A - 1) + (A + 1) * cosw0);
            a2 = (A + 1) + (A - 1) * cosw0 - 2 * rootA * alpha;
        }
        break;
      case FilterType.HighShelf:
        {
            const rootA = Math.sqrt(A);
            b0 = A * ((A + 1) + (A - 1) * cosw0 + 2 * rootA * alpha);
            b1 = -2 * A * ((A - 1) + (A + 1) * cosw0);
            b2 = A * ((A + 1) + (A - 1) * cosw0 - 2 * rootA * alpha);
            a0 = (A + 1) - (A - 1) * cosw0 + 2 * rootA * alpha;
            a1 = 2 * ((A - 1) - (A + 1) * cosw0);
            a2 = (A + 1) - (A - 1) * cosw0 - 2 * rootA * alpha;
        }
        break;
      default:
        return 0;
    }

    // Normalize
    const b0n = b0 / a0;
    const b1n = b1 / a0;
    const b2n = b2 / a0;
    const a1n = a1 / a0;
    const a2n = a2 / a0;

    // Evaluate transfer function H(z) at z = e^(jw)
    // H(e^jw) = (b0 + b1*e^-jw + b2*e^-2jw) / (1 + a1*e^-jw + a2*e^-2jw)
    const w = (2 * Math.PI * freq) / Fs;
    const cosw = Math.cos(w);
    const sinw = Math.sin(w);
    const cos2w = Math.cos(2 * w);
    const sin2w = Math.sin(2 * w);

    const numReal = b0n + b1n * cosw + b2n * cos2w;
    const numImag = -b1n * sinw - b2n * sin2w;
    const denReal = 1 + a1n * cosw + a2n * cos2w;
    const denImag = -a1n * sinw - a2n * sin2w;

    const magSq = (numReal * numReal + numImag * numImag) / (denReal * denReal + denImag * denImag);
    
    // Avoid log(0)
    return 10 * Math.log10(Math.max(magSq, 1e-20));
  }, []);

  // Helper to calculate Frequency Response for the curve
  const getMagResponse = useCallback((freq: number, band: EqBand, includeDynamic: boolean = false): number => {
    if (!band.enabled) return 0;

    let gain = band.gain;
    
    // Dynamic processing visualization logic
    // Note: Standard LowPass/HighPass filters do not use 'Gain' parameter.
    // Dynamic EQ on a LowPass usually modulates frequency, which is complex to visualize here.
    // We only visualize dynamic gain changes for Peaking/Shelves.
    if (includeDynamic && band.dynamic.enabled) {
        if (band.type === FilterType.Peaking || band.type === FilterType.LowShelf || band.type === FilterType.HighShelf) {
            gain = band.gain + band.dynamic.range;
        }
    }

    return getBiquadMagnitude(freq, band.type, band.frequency, band.q, gain);
  }, [getBiquadMagnitude]);

  // Resize Observer
  useEffect(() => {
    const resize = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };
    window.addEventListener('resize', resize);
    resize();
    return () => window.removeEventListener('resize', resize);
  }, []);

  // Drawing Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true } as any);
    if (!ctx) return;

    const { width, height } = dimensions;
    canvas.width = width;
    canvas.height = height;

    const { input, output } = audioEngine.getAnalysers();
    const bufferLength = input ? input.frequencyBinCount : 0;
    const dataArrayInput = new Uint8Array(bufferLength);
    const dataArrayOutput = new Uint8Array(bufferLength);

    let animationFrameId: number;

    const draw = () => {
      // Get Data
      if (input) input.getByteFrequencyData(dataArrayInput);
      if (output) output.getByteFrequencyData(dataArrayOutput);

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(2, 6, 23, 0.20)';
      ctx.fillRect(0, 0, width, height);

      // Draw Grid
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#1e293b';
      ctx.beginPath();
      // Freq lines
      [30, 100, 300, 1000, 3000, 10000].forEach(f => {
        const x = freqToX(f, width);
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.fillStyle = '#64748b';
        ctx.font = '10px sans-serif';
        ctx.fillText(f >= 1000 ? `${f/1000}k` : `${f}`, x + 2, height - 5);
      });
      // dB lines
      [-18, 0, 18].forEach(db => {
        const y = dbToY(db, height);
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.fillText(`${db}dB`, 5, y - 2);
      });
      ctx.stroke();

      // 1. Draw Input Spectrum (Original Freq - Faint line)
      if (input) {
         ctx.beginPath();
         for (let i = 0; i < bufferLength; i++) {
            const freq = (i * 24000) / bufferLength;
            if (freq < MIN_FREQ) continue;
            if (freq > MAX_FREQ) break;
            
            const x = freqToX(freq, width);
            const db = (dataArrayInput[i] / 255) * (MAX_DB - MIN_DB) + MIN_DB - 20;
            const y = dbToY(db, height);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
         }
         ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)'; // More visible
         ctx.lineWidth = 1;
         ctx.stroke();
      }

      // 2. Draw Output Spectrum (EQ Adjusted Freq - Filled)
      if (output) {
        ctx.beginPath();
        ctx.moveTo(0, height);
        for (let i = 0; i < bufferLength; i++) {
          // Map bin index to frequency
          const freq = (i * 24000) / bufferLength; // assuming 48k sample rate
          if (freq < MIN_FREQ) continue;
          if (freq > MAX_FREQ) break;

          const x = freqToX(freq, width);
          const db = (dataArrayOutput[i] / 255) * (MAX_DB - MIN_DB) + MIN_DB - 20; 
          const y = dbToY(db, height);
          ctx.lineTo(x, y);
        }
        ctx.lineTo(width, height);
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, 'rgba(96, 165, 250, 0.3)');
        grad.addColorStop(1, 'rgba(96, 165, 250, 0.0)');
        ctx.fillStyle = grad;
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = 'rgba(96, 165, 250, 0.8)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // 3. Draw EQ Composite Curve (Main EQ Line)
      ctx.beginPath();
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2.5;
      
      // Resolution for curve drawing
      const curvePoints = width; 
      for (let i = 0; i < curvePoints; i++) {
        const x = i;
        const freq = xToFreq(x, width);
        
        // Sum gains of all bands
        let totalDb = 0;
        bands.forEach(band => {
           totalDb += getMagResponse(freq, band, false);
        });

        // Hard clip the visualization at reasonable DB limits to prevent infinity errors with high pass
        totalDb = Math.max(-60, Math.min(30, totalDb));

        const y = dbToY(totalDb, height);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.shadowBlur = 10;
      ctx.shadowColor = 'rgba(255,255,255,0.5)';
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 4. Draw Dynamic Threshold Curve (Compressed Content Visualization)
      // Only draw if any band has dynamics enabled
      if (bands.some(b => b.enabled && b.dynamic.enabled)) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(250, 204, 21, 0.6)'; // Yellowish for dynamics
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        
        for (let i = 0; i < curvePoints; i++) {
            const x = i;
            const freq = xToFreq(x, width);
            
            let totalDb = 0;
            bands.forEach(band => {
               totalDb += getMagResponse(freq, band, true);
            });
            
            totalDb = Math.max(-60, Math.min(30, totalDb));
    
            const y = dbToY(totalDb, height);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw Bands Handles
      bands.forEach(band => {
        if (!band.enabled && band.id !== selectedBandId) return; // Don't draw bypassed band handles unless selected

        const x = freqToX(band.frequency, width);
        const y = dbToY(band.gain, height);
        const isSelected = band.id === selectedBandId;

        // Dynamic Range Visualization (Vertical Bar)
        // Only relevant for filters where Gain is meaningful (Peaking/Shelf)
        const isGainRelevant = band.type === FilterType.Peaking || band.type === FilterType.LowShelf || band.type === FilterType.HighShelf;

        if (band.enabled && band.dynamic.enabled && isGainRelevant) {
            const rangeDb = band.gain + band.dynamic.range;
            const yRange = dbToY(rangeDb, height);
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x, yRange);
            ctx.strokeStyle = band.color; 
            ctx.globalAlpha = 0.6;
            ctx.lineWidth = 4;
            ctx.stroke();
            ctx.globalAlpha = 1.0;
            ctx.lineWidth = 1;
        }

        // Handle Circle
        ctx.beginPath();
        // For LP/HP, the Y position is technically 0dB (or unity) on the graph usually, 
        // but user might want to drag it. Since Gain param is unused for LP/HP, we clamp visual Y to 0 for LP/HP handles?
        // Standard Pro-Q behavior: LP/HP handles stay at 0dB line but dragging Y changes Q.
        // For simplicity in this drag handler, we use the band.gain value, but for LP/HP we might want to force it visually to 0 if we strictly follow physics.
        // However, to let user adjust 'Q' via drag, we need Y axis. 
        // In this implementation, dragging Y updates 'gain', but for LP/HP gain is ignored.
        // Let's keep the handle at `band.gain` so user can move it out of the way, or logic to map Y to Q for LP/HP could be added later.
        
        ctx.arc(x, y, isSelected ? 8 : 5, 0, 2 * Math.PI);
        ctx.fillStyle = band.enabled ? band.color : '#334155'; 
        ctx.fill();
        ctx.strokeStyle = isSelected ? '#ffffff' : (band.enabled ? '#000000' : '#475569');
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;

        // Label
        if (isSelected) {
          ctx.fillStyle = 'white';
          ctx.font = '10px mono';
          ctx.fillText(`${Math.round(band.frequency)}Hz`, x + 10, y - 10);
          if (!band.enabled) {
              ctx.fillStyle = '#94a3b8';
              ctx.fillText(`(Bypassed)`, x + 10, y + 20);
          }
        }
      });

      animationFrameId = requestAnimationFrame(draw);
    };

    draw();

    return () => cancelAnimationFrame(animationFrameId);
  }, [dimensions, bands, selectedBandId, getMagResponse]);


  // Interaction Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const { width, height } = dimensions;
    let clickedBandId: string | null = null;

    // Reverse loop to select top-most band visually
    for (let i = bands.length - 1; i >= 0; i--) {
      const band = bands[i];
      if (!band.enabled && band.id !== selectedBandId) continue; // Hard to click bypassed bands unless already selected

      const bx = freqToX(band.frequency, width);
      const by = dbToY(band.gain, height);
      if (Math.sqrt(Math.pow(mouseX - bx, 2) + Math.pow(mouseY - by, 2)) < 15) {
        clickedBandId = band.id;
        break;
      }
    }

    if (clickedBandId) {
      onBandSelect(clickedBandId);
      const band = bands.find(b => b.id === clickedBandId)!;
      setDragState({
        bandId: clickedBandId,
        startX: mouseX,
        startY: mouseY,
        startFreq: band.frequency,
        startGain: band.gain
      });
    } else {
       onBandSelect(null);
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      
      const freq = xToFreq(mouseX, dimensions.width);
      const newBand: EqBand = {
        id: `band-${Date.now()}`,
        enabled: true,
        frequency: freq,
        gain: 0, 
        q: 1.0,
        type: FilterType.Peaking,
        color: '#eab308', // Default color, maybe random in real app
        dynamic: { enabled: false, threshold: -18, range: -6, attack: 10, release: 100, ratio: 2, knee: 6, mix: 100 }
      };
      onBandAdd(newBand);
      onBandSelect(newBand.id);
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragState) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newFreq = xToFreq(mouseX, dimensions.width);
    const newGain = yToDb(mouseY, dimensions.height);

    const band = bands.find(b => b.id === dragState.bandId);
    if (band) {
      onBandUpdate({
        ...band,
        frequency: Math.max(20, Math.min(20000, newFreq)),
        gain: Math.max(-30, Math.min(30, newGain))
      });
    }
  };

  const handleMouseUp = () => {
    setDragState(null);
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-transparent cursor-crosshair overflow-hidden">
      <canvas 
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        className="block bg-transparent"
      />
      <div className="absolute top-4 right-4 text-slate-500 text-xs pointer-events-none select-none bg-slate-900/80 p-2 rounded backdrop-blur-sm">
        <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 bg-slate-500 opacity-30 rounded-full"></div> Original Input</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 bg-blue-400 opacity-80 rounded-full"></div> Output Spectrum</div>
        <div className="flex items-center gap-2 mb-1"><div className="w-2 h-2 bg-white rounded-full"></div> EQ Curve</div>
        <div className="flex items-center gap-2"><div className="w-2 h-2 border border-yellow-400 border-dashed rounded-full"></div> Dynamic Reduction</div>
      </div>
    </div>
  );
};

export default EqVisualizer;
