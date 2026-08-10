import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Timer, KanbanSquare, ArrowRight } from 'lucide-react';

interface ToolItem {
  path: string;
  name: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: 'disponível' | 'em breve';
}

const TOOLS: ToolItem[] = [
  {
    path: '/tools/pomodoro',
    name: 'Pomodoro',
    description: 'Ciclos de foco e pausa configuráveis, com registro automático e gráficos de desempenho.',
    icon: Timer,
    status: 'disponível',
  },
  {
    path: '/tools/kanban',
    name: 'Quadro Kanban',
    description: 'Organize suas tarefas em etapas personalizáveis, com ordenação por arrastar e soltar.',
    icon: KanbanSquare,
    status: 'disponível',
  },
];

export const ToolsPage: React.FC = () => {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h2 className="text-lg font-bold text-foreground">Ferramentas Úteis</h2>
        <p className="text-xs text-muted-foreground">
          Ferramentas de produtividade e foco para apoiar seus hábitos.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link key={tool.path} to={tool.path} className="group">
              <Card className="h-full transition-all hover:shadow-md hover:border-primary/40">
                <CardHeader className="p-5 pb-3">
                  <div className="flex items-start justify-between">
                    <div className="w-11 h-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                      <Icon className="w-6 h-6" />
                    </div>
                    <Badge variant={tool.status === 'disponível' ? 'success' : 'outline'} className="text-[10px]">
                      {tool.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-5 pt-1">
                  <CardTitle className="text-base font-bold text-foreground flex items-center gap-1.5">
                    {tool.name}
                    <ArrowRight className="w-4 h-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">{tool.description}</CardDescription>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
};
