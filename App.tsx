
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AudioState, EqBand } from './types';
import { createDefaultBand } from './constants';
import Controls from './components/Controls';
import EqVisualizer from './components/EqVisualizer';
import { audioEngine } from './services/audioEngine';
import { Play, Square, Mic, Waves, Zap, Upload, Download, Loader2, FileAudio } from 'lucide-react';

const App: React.FC = () => {
  // Initialize with a few default bands
  const [bands, setBands] = useState<EqBand[]>([
    createDefaultBand('band-1', 100),
    createDefaultBand('band-2', 1000),
    createDefaultBand('band-3', 5000),
  ]);
  
  const [selectedBandId, setSelectedBandId] = useState<string | null>('band-2');
  const [audioState, setAudioState] = useState<AudioState>({ isPlaying: false, sourceType: 'noise' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync audio engine when bands change
  useEffect(() => {
    audioEngine.updateFilters(bands);
  }, [bands]);

  const handleBandUpdate = useCallback((updatedBand: EqBand) => {
    setBands(prev => prev.map(b => b.id === updatedBand.id ? updatedBand : b));
  }, []);

  const handleBandAdd = useCallback((newBand: EqBand) => {
    setBands(prev => [...prev, newBand]);
  }, []);

  const handleBandDelete = useCallback((id: string) => {
    setBands(prev => prev.filter(b => b.id !== id));
    if (selectedBandId === id) setSelectedBandId(null);
  }, [selectedBandId]);

  const toggleAudio = async (type: 'noise' | 'mic' | 'oscillator' | 'file') => {
    // If switching to file but no file loaded, trigger upload
    if (type === 'file' && !audioState.fileName) {
       fileInputRef.current?.click();
       return;
    }

    if (audioState.isPlaying && audioState.sourceType === type) {
      audioEngine.stop();
      setAudioState(prev => ({ ...prev, isPlaying: false }));
    } else {
      await audioEngine.start(type);
      setAudioState(prev => ({ ...prev, isPlaying: true, sourceType: type }));
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Stop current playback
    if (audioState.isPlaying) {
        audioEngine.stop();
    }

    try {
        setAudioState(prev => ({ ...prev, isPlaying: false, fileName: 'Loading...', sourceType: 'file' }));
        await audioEngine.loadAudioFile(file);
        setAudioState(prev => ({ ...prev, fileName: file.name, sourceType: 'file' }));
        
        // Auto start
        await audioEngine.start('file');
        setAudioState(prev => ({ ...prev, isPlaying: true }));
    } catch (err) {
        console.error("Error loading file", err);
        alert("Could not load audio file.");
        setAudioState(prev => ({ ...prev, fileName: undefined }));
    }
  };

  const handleExport = async () => {
      if (!audioState.fileName) {
          alert("Please upload an audio file first to export.");
          return;
      }

      setAudioState(prev => ({ ...prev, isExporting: true }));
      
      // Pause playback during export to save resources
      const wasPlaying = audioState.isPlaying;
      if (wasPlaying) audioEngine.stop();

      try {
          // Wait a tick for UI to update
          await new Promise(resolve => setTimeout(resolve, 100));
          
          const blob = await audioEngine.exportAudio(bands);
          if (blob) {
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `processed_${audioState.fileName.replace(/\.[^/.]+$/, "")}.wav`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              URL.revokeObjectURL(url);
          }
      } catch (e) {
          console.error(e);
          alert("Export failed.");
      } finally {
          setAudioState(prev => ({ ...prev, isExporting: false, isPlaying: false })); // Remain stopped after export
      }
  };

  const selectedBand = bands.find(b => b.id === selectedBandId) || null;

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-white font-sans overflow-hidden select-none">
      {/* Hidden Input */}
      <input 
        type="file" 
        accept="audio/*" 
        ref={fileInputRef} 
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Header */}
      <header className="h-16 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
            <Zap className="text-white w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-lg font-bold tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent leading-none">
                SPECTRA <span className="font-thin opacity-70">EQ</span>
            </h1>
            <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">Web Audio Processor</span>
          </div>
        </div>
        
        {/* Source Controls */}
        <div className="flex items-center gap-2 bg-slate-950/50 p-1.5 rounded-xl border border-slate-800 shadow-inner">
          <button 
            onClick={() => toggleAudio('noise')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              audioState.isPlaying && audioState.sourceType === 'noise' 
              ? 'bg-slate-800 text-blue-400 shadow-sm ring-1 ring-blue-500/30' 
              : 'hover:bg-slate-800 text-slate-500'
            }`}
            title="Test with Pink Noise"
          >
            {audioState.isPlaying && audioState.sourceType === 'noise' ? <Square size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>}
            Noise
          </button>
           <button 
            onClick={() => toggleAudio('oscillator')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              audioState.isPlaying && audioState.sourceType === 'oscillator' 
              ? 'bg-slate-800 text-purple-400 shadow-sm ring-1 ring-purple-500/30' 
              : 'hover:bg-slate-800 text-slate-500'
            }`}
            title="Test with Sawtooth Wave"
          >
            <Waves size={12} />
            Osc
          </button>
          <button 
            onClick={() => toggleAudio('mic')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              audioState.isPlaying && audioState.sourceType === 'mic' 
              ? 'bg-slate-800 text-red-400 shadow-sm ring-1 ring-red-500/30' 
              : 'hover:bg-slate-800 text-slate-500'
            }`}
            title="Live Microphone Input"
          >
            <Mic size={12} />
            Mic
          </button>
          
          <div className="w-px h-4 bg-slate-800 mx-1"></div>

          <button 
            onClick={() => toggleAudio('file')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              audioState.sourceType === 'file' 
              ? 'bg-slate-800 text-emerald-400 shadow-sm ring-1 ring-emerald-500/30' 
              : 'hover:bg-slate-800 text-slate-500'
            }`}
            title="Upload and Play Audio File"
          >
            {audioState.fileName ? (
                audioState.isPlaying && audioState.sourceType === 'file' ? <Square size={12} fill="currentColor"/> : <Play size={12} fill="currentColor"/>
            ) : <FileAudio size={14} />}
            <span className="max-w-[100px] truncate">
                {audioState.fileName || "Import Audio"}
            </span>
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3">
            {audioState.fileName && (
                 <button 
                 onClick={handleExport}
                 disabled={audioState.isExporting}
                 className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
               >
                 {audioState.isExporting ? <Loader2 size={14} className="animate-spin"/> : <Download size={14} />}
                 EXPORT WAV
               </button>
            )}
             {!audioState.fileName && (
                 <button 
                 onClick={() => fileInputRef.current?.click()}
                 className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-bold transition-colors border border-slate-700"
               >
                 <Upload size={14} />
                 UPLOAD
               </button>
            )}
        </div>
      </header>

      {/* Main Visualization Area */}
      <main className="flex-1 relative">
        <EqVisualizer 
          bands={bands}
          selectedBandId={selectedBandId}
          onBandSelect={setSelectedBandId}
          onBandUpdate={handleBandUpdate}
          onBandAdd={handleBandAdd}
        />
        
        {/* Overlay info if not playing */}
        {!audioState.isPlaying && !audioState.isExporting && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-900/80 backdrop-blur px-8 py-6 rounded-2xl border border-slate-800/50 text-center shadow-2xl">
              <p className="text-slate-200 font-medium text-lg mb-1">Audio Engine Suspended</p>
              <p className="text-slate-500 text-sm">Select a source or upload a file to begin</p>
            </div>
          </div>
        )}

        {/* Exporting Overlay */}
        {audioState.isExporting && (
           <div className="absolute inset-0 flex items-center justify-center z-50 bg-slate-950/60 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 px-8 py-6 rounded-xl flex flex-col items-center shadow-2xl">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-4" />
                  <h3 className="text-white font-bold mb-1">Rendering Audio...</h3>
                  <p className="text-slate-400 text-xs">Applying EQ and compression settings</p>
              </div>
           </div>
        )}
      </main>

      {/* Controls Footer */}
      <Controls 
        band={selectedBand} 
        onUpdate={handleBandUpdate} 
        onDelete={handleBandDelete}
      />
    </div>
  );
};

export default App;
