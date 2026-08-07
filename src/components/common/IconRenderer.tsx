import React from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideProps } from 'lucide-react';

interface IconRendererProps extends LucideProps {
  name: string;
  fallbackIcon?: string;
}

export const IconRenderer: React.FC<IconRendererProps> = ({
  name,
  fallbackIcon = 'Target',
  className,
  size = 20,
  ...props
}) => {
  const iconsMap = LucideIcons as unknown as Record<string, React.ComponentType<LucideProps>>;
  const IconComponent = iconsMap[name] || iconsMap[fallbackIcon] || LucideIcons.Target;

  return <IconComponent className={className} size={size} {...props} />;
};
