import React from 'react';
import { COLOR_OPTIONS } from '@/constants';
import { cn } from '@/utils/cn';
import { Check } from 'lucide-react';

interface ColorPickerProps {
  selectedColor: string;
  onSelectColor: (color: string) => void;
}

export const ColorPicker: React.FC<ColorPickerProps> = ({ selectedColor, onSelectColor }) => {
  return (
    <div className="flex flex-wrap gap-2.5 p-2 border rounded-lg bg-background">
      {COLOR_OPTIONS.map((c) => {
        const isSelected = selectedColor === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onSelectColor(c.value)}
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer hover:scale-110 shadow-xs',
              isSelected ? 'ring-2 ring-offset-2 ring-primary scale-110' : 'opacity-80 hover:opacity-100'
            )}
            style={{ backgroundColor: c.value }}
            title={c.name}
          >
            {isSelected && <Check className="w-4 h-4 text-white drop-shadow-md" />}
          </button>
        );
      })}
    </div>
  );
};
