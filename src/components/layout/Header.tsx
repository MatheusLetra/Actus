import React, { useState } from 'react';
import { Menu, Moon, Sun, Calendar as CalendarIcon } from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { dateService } from '@/services/dateService';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Sidebar } from './Sidebar';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  title: string;
}

export const Header: React.FC<HeaderProps> = ({ title }) => {
  const { isDark, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const todayFormatted = dateService.formatFullDate(dateService.getTodayString());

  return (
    <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-md border-b px-4 lg:px-8 py-3.5 flex items-center justify-between transition-colors">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Trigger */}
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </Button>

        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
            <CalendarIcon className="w-3.5 h-3.5" />
            <span className="capitalize">{todayFormatted}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Theme Toggle Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="rounded-full shadow-xs"
          title={isDark ? 'Mudar para Tema Claro' : 'Mudar para Tema Escuro'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400 fill-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </Button>
      </div>

      {/* Mobile Drawer Navigation */}
      <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
        <SheetContent side="left" className="p-0 w-72">
          <SheetHeader className="sr-only">
            <SheetTitle>Navegação do Sistema</SheetTitle>
          </SheetHeader>
          <Sidebar onItemClick={() => setMobileMenuOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
};
