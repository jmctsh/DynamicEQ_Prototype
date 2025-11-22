
import React from 'react';
import { EqBand, FilterType } from '../types';
import Knob from './Knob';
import { Trash2, Power, Activity } from 'lucide-react';

interface ControlsProps {
  band: EqBand | null;
  onUpdate: (updatedBand: EqBand) => void;
  onDelete: (id: string) => void;
}

const Controls: React.FC<ControlsProps> = ({ band, onUpdate, onDelete }) => {
  if (!band) {
    return (
      <div className="h-48 flex items-center justify-center text-slate-600 border-t border-slate-800 bg-slate-900/50 backdrop-blur-sm">
        <p>Select a band to edit parameters</p>
      </div>
    );
  }

  const handlePropChange = (prop: keyof EqBand, value: any) => {
    onUpdate({ ...band, [prop]: value });
  };

  const handleDynamicChange = (prop: keyof typeof band.dynamic, value: any) => {
    onUpdate({
      ...band,
      dynamic: { ...band.dynamic, [prop]: value },
    });
  };

  return (
    <div className="h-48 bg-slate-900/90 border-t border-slate-800 p-4 flex gap-8 overflow-x-auto backdrop-blur-md shadow-2xl">
      {/* Main Params */}
      <div className="flex items-center gap-4 border-r border-slate-800 pr-6 min-w-fit">
        <div className="flex flex-col gap-2 w-20">
           <div className="flex items-center gap-2 mb-1">
             <div className={`w-3 h-3 rounded-full shadow-lg transition-opacity ${band.enabled ? 'opacity-100' : 'opacity-20'}`} style={{ backgroundColor: band.color }}></div>
             <span className="text-xs font-bold text-slate-300">BAND</span>
           </div>
           
           {/* Main Band Bypass Switch */}
           <button
             onClick={() => handlePropChange('enabled', !band.enabled)}
             className={`flex items-center justify-center p-2 rounded-full transition-all border mb-1 ${
               band.enabled 
               ? 'bg-slate-800 border-slate-600 text-white shadow-[0_0_10px_rgba(255,255,255,0.1)]' 
               : 'bg-slate-900 border-slate-800 text-slate-600'
             }`}
             title="Bypass Band"
           >
             <Power size={16} />
           </button>

           <select 
            value={band.type} 
            onChange={(e) => handlePropChange('type', e.target.value)}
            className="bg-slate-800 text-xs text-white p-1 rounded border border-slate-700 outline-none focus:border-blue-500 w-full"
           >
             {Object.values(FilterType).map(t => (
               <option key={t} value={t}>{t.toUpperCase()}</option>
             ))}
           </select>
           <button 
            onClick={() => onDelete(band.id)}
            className="mt-1 flex items-center justify-center gap-1 bg-red-900/20 hover:bg-red-900/40 text-red-400 px-2 py-1 rounded text-xs transition-colors border border-red-900/30"
           >
             <Trash2 size={12} />
           </button>
        </div>

        <div className={`flex gap-4 transition-opacity duration-200 ${band.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <Knob 
            label="Freq" 
            value={band.frequency} 
            min={20} 
            max={20000} 
            onChange={(v) => handlePropChange('frequency', v)} 
            color={band.color}
          />
          <Knob 
            label="Gain" 
            value={band.gain} 
            min={-30} 
            max={30} 
            onChange={(v) => handlePropChange('gain', v)} 
            color={band.color}
          />
          <Knob 
            label="Q" 
            value={band.q} 
            min={0.1} 
            max={10} 
            onChange={(v) => handlePropChange('q', v)} 
            color={band.color}
          />
        </div>
      </div>

      {/* Dynamic Section */}
      <div className="flex items-center gap-4 min-w-fit relative">
        {/* Disable overlay if band is bypassed */}
        {!band.enabled && <div className="absolute inset-0 z-10 bg-slate-900/50 backdrop-blur-[1px]"></div>}
        
        <div className="flex flex-col h-full justify-between py-2">
          <div className="flex items-center gap-2">
            <Activity size={14} className={band.dynamic.enabled ? 'text-yellow-400' : 'text-slate-600'} />
            <span className="text-xs font-bold text-slate-400 tracking-widest">DYNAMIC</span>
          </div>
          <button
            onClick={() => handleDynamicChange('enabled', !band.dynamic.enabled)}
            className={`flex items-center gap-2 px-3 py-1 rounded text-xs font-bold transition-all border ${
              band.dynamic.enabled 
                ? 'bg-yellow-500/10 border-yellow-500/50 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.2)]' 
                : 'bg-slate-800 border-slate-700 text-slate-500 hover:bg-slate-700'
            }`}
          >
            <Power size={12} />
            {band.dynamic.enabled ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className={`flex items-center gap-4 transition-opacity duration-300 ${band.dynamic.enabled ? 'opacity-100 pointer-events-auto' : 'opacity-30 pointer-events-none grayscale'}`}>
          <Knob 
            label="Thresh" 
            value={band.dynamic.threshold} 
            min={-60} 
            max={0} 
            onChange={(v) => handleDynamicChange('threshold', v)} 
            color="#eab308"
          />
           <Knob 
            label="Range" 
            value={band.dynamic.range} 
            min={-30} 
            max={30} 
            onChange={(v) => handleDynamicChange('range', v)} 
            color="#eab308"
          />
          <div className="w-px h-20 bg-slate-800 mx-2"></div>
          <Knob 
            label="Attack" 
            value={band.dynamic.attack} 
            min={0.1} 
            max={200} 
            onChange={(v) => handleDynamicChange('attack', v)} 
            color="#fbbf24"
            size={50}
          />
           <Knob 
            label="Release" 
            value={band.dynamic.release} 
            min={10} 
            max={1000} 
            onChange={(v) => handleDynamicChange('release', v)} 
            color="#fbbf24"
            size={50}
          />
           <Knob 
            label="Knee" 
            value={band.dynamic.knee} 
            min={0} 
            max={30} 
            onChange={(v) => handleDynamicChange('knee', v)} 
            color="#fbbf24"
            size={50}
          />
          <div className="w-px h-20 bg-slate-800 mx-2"></div>
          <Knob 
            label="Mix" 
            unit="%"
            value={band.dynamic.mix} 
            min={0} 
            max={100} 
            onChange={(v) => handleDynamicChange('mix', v)} 
            color="#fff"
            size={50}
          />
        </div>
      </div>
    </div>
  );
};

export default Controls;
