import React from 'react';
import { AVAILABLE_ICONS } from '@/constants';
import { IconRenderer } from './IconRenderer';
import { cn } from '@/utils/cn';

interface IconPickerProps {
  selectedIcon: string;
  onSelectIcon: (iconName: string) => void;
  className?: string;
}

export const IconPicker: React.FC<IconPickerProps> = ({
  selectedIcon,
  onSelectIcon,
  className,
}) => {
  return (
    <div className={cn('grid grid-cols-6 sm:grid-cols-8 gap-2 p-2 border rounded-lg bg-background max-h-48 overflow-y-auto', className)}>
      {AVAILABLE_ICONS.map((iconName) => {
        const isSelected = selectedIcon === iconName;
        return (
          <button
            key={iconName}
            type="button"
            onClick={() => onSelectIcon(iconName)}
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg border transition-all hover:scale-105 cursor-pointer',
              isSelected
                ? 'border-primary bg-primary/10 text-primary shadow-xs ring-2 ring-primary/30 font-bold'
                : 'border-transparent text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
            title={iconName}
          >
            <IconRenderer name={iconName} size={22} />
          </button>
        );
      })}
    </div>
  );
};
