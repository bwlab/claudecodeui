import { Columns3, List, LayoutGrid, Table2 } from 'lucide-react';
import type { DashboardViewMode } from '../../types/dashboard';

type ViewModeSwitcherProps = {
  viewMode: DashboardViewMode;
  onViewModeChange: (mode: DashboardViewMode) => void;
};

const modes: { mode: DashboardViewMode; icon: typeof Columns3; label: string }[] = [
  { mode: 'kanban', icon: Columns3, label: 'Kanban' },
  { mode: 'accordion', icon: List, label: 'Accordion' },
  { mode: 'tabs', icon: Table2, label: 'Tab' },
  { mode: 'grid', icon: LayoutGrid, label: 'Griglia' },
];

export default function ViewModeSwitcher({ viewMode, onViewModeChange }: ViewModeSwitcherProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/60 bg-muted/30 p-0.5">
      {modes.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onViewModeChange(mode)}
          className={`rounded-md p-1.5 transition-colors ${
            viewMode === mode
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
