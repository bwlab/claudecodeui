import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, Plus, Check, X, MoreHorizontal, FolderOpen, ArrowRightLeft, ChevronRight } from 'lucide-react';
import type { Raccoglitore } from '../../types/dashboard';
import { getIconComponent } from '../../utils/getIconComponent';

type RaccoglitoreHeaderProps = {
  raccoglitore: Raccoglitore;
  projectCount: number;
  childrenCount?: number;
  totalCount?: number;
  onUpdate: (updates: { name?: string; color?: string; icon?: string; notes?: string }) => void;
  onDelete: () => void;
  onAddProject: () => void;
  onDrillIn?: () => void;
  onRequestMove?: () => void;
};

export default function RaccoglitoreHeader({
  raccoglitore,
  projectCount,
  childrenCount = 0,
  totalCount,
  onUpdate,
  onDelete,
  onAddProject,
  onDrillIn,
  onRequestMove,
}: RaccoglitoreHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(raccoglitore.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const handleSave = () => {
    if (name.trim() && name.trim() !== raccoglitore.name) {
      onUpdate({ name: name.trim() });
    }
    setIsEditing(false);
  };

  const IconComponent = getIconComponent(raccoglitore.icon);
  const hasChildren = childrenCount > 0;
  const showTotal = totalCount !== undefined && totalCount !== projectCount;

  return (
    <div className="group/rh flex items-center gap-2 px-3 py-2">
      <button
        type="button"
        onClick={hasChildren && onDrillIn ? onDrillIn : undefined}
        disabled={!hasChildren || !onDrillIn}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded transition-opacity enabled:hover:opacity-80 disabled:cursor-default"
        style={{ backgroundColor: raccoglitore.color + '20', color: raccoglitore.color }}
        title={hasChildren ? 'Apri sottocartelle' : undefined}
      >
        <IconComponent className="h-3 w-3" />
      </button>

      {isEditing ? (
        <div className="flex flex-1 items-center gap-1">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSave();
              if (e.key === 'Escape') { setName(raccoglitore.name); setIsEditing(false); }
            }}
            className="flex-1 rounded border border-border bg-background px-2 py-0.5 text-sm font-semibold outline-none focus:ring-1 focus:ring-primary"
          />
          <button type="button" onClick={handleSave} className="rounded p-0.5 hover:bg-accent">
            <Check className="h-3.5 w-3.5 text-primary" />
          </button>
          <button type="button" onClick={() => { setName(raccoglitore.name); setIsEditing(false); }} className="rounded p-0.5 hover:bg-accent">
            <X className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={hasChildren && onDrillIn ? onDrillIn : undefined}
            disabled={!hasChildren || !onDrillIn}
            className="flex min-w-0 flex-1 items-center gap-1 truncate text-left enabled:hover:text-primary disabled:cursor-default"
            title={hasChildren ? 'Apri sottocartelle' : raccoglitore.name}
          >
            <h3 className="truncate text-sm font-semibold text-foreground">{raccoglitore.name}</h3>
            {hasChildren && <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />}
          </button>
          <span
            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            title={showTotal ? `${projectCount} diretti · ${totalCount} totale (con sottocartelle)` : `${projectCount} progetti`}
          >
            {showTotal ? `${projectCount}/${totalCount}` : projectCount}
          </span>
          {hasChildren && (
            <span
              className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
              title={`${childrenCount} sottocartella${childrenCount === 1 ? '' : 'e'}`}
            >
              {childrenCount}▸
            </span>
          )}
          <button
            type="button"
            onClick={onAddProject}
            className="rounded p-0.5 text-primary transition-colors hover:bg-primary/10"
            title="Aggiungi progetto"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/rh:opacity-100"
              title="Altre azioni"
            >
              <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full z-20 mt-1 w-48 overflow-hidden rounded-lg border border-border bg-background shadow-lg">
                {hasChildren && onDrillIn && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onDrillIn(); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <FolderOpen className="h-3.5 w-3.5" />
                    Apri sottocartelle
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setIsEditing(true); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Rinomina
                </button>
                {onRequestMove && (
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); onRequestMove(); }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Sposta in…
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onDelete(); }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Elimina
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
