import React, { useState, useRef, useEffect } from 'react';

interface KnobProps {
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  label?: string;
  unit?: string;
  size?: number;
  color?: string;
}

const Knob: React.FC<KnobProps> = ({ 
  value, 
  min, 
  max, 
  onChange, 
  label, 
  unit = '', 
  size = 60,
  color = '#3b82f6'
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef<number>(0);
  const startValueRef = useRef<number>(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    startYRef.current = e.clientY;
    startValueRef.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaY = startYRef.current - e.clientY;
      const range = max - min;
      // Sensitivity: 200px for full range
      const deltaValue = (deltaY / 200) * range;
      let newValue = startValueRef.current + deltaValue;
      newValue = Math.max(min, Math.min(max, newValue));
      onChange(newValue);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, min, max, onChange]);

  // Visual calculation
  const percentage = (value - min) / (max - min);
  const angle = -135 + (percentage * 270); // -135 to +135 degrees
  const rad = (angle * Math.PI) / 180;
  
  // SVG Math
  const center = size / 2;
  const radius = (size / 2) - 6;
  const pointerX = center + radius * Math.sin(rad);
  const pointerY = center - radius * Math.cos(rad);

  return (
    <div className="flex flex-col items-center gap-1 select-none group">
      <div 
        className="relative cursor-ns-resize" 
        style={{ width: size, height: size }}
        onMouseDown={handleMouseDown}
      >
        <svg width={size} height={size} className="overflow-visible">
          {/* Background Track */}
          <path 
            d={`M ${center + (radius * Math.sin(-135 * Math.PI / 180))} ${center - (radius * Math.cos(-135 * Math.PI / 180))} A ${radius} ${radius} 0 1 1 ${center + (radius * Math.sin(135 * Math.PI / 180))} ${center - (radius * Math.cos(135 * Math.PI / 180))}`}
            fill="none"
            stroke="#1e293b"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* Value Track */}
          <path 
            d={`M ${center + (radius * Math.sin(-135 * Math.PI / 180))} ${center - (radius * Math.cos(-135 * Math.PI / 180))} A ${radius} ${radius} 0 ${angle > 45 ? 1 : 0} 1 ${pointerX} ${pointerY}`}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            className="opacity-80 group-hover:opacity-100 transition-opacity"
          />
          {/* Indicator Dot */}
          <circle cx={pointerX} cy={pointerY} r="3" fill="white" />
        </svg>
        {/* Center Label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="text-[10px] font-mono text-slate-400">
            {Math.round(value * 10) / 10}
          </span>
        </div>
      </div>
      {label && (
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
          {label}
        </span>
      )}
    </div>
  );
};

export default Knob;
