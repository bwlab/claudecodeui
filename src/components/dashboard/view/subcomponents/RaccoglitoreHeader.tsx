import { useState } from 'react';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import type { Raccoglitore } from '../../types/dashboard';
import { getIconComponent } from '../../utils/getIconComponent';

type RaccoglitoreHeaderProps = {
  raccoglitore: Raccoglitore;
  projectCount: number;
  onUpdate: (updates: { name?: string; color?: string; icon?: string; notes?: string }) => void;
  onDelete: () => void;
  onAddProject: () => void;
};

export default function RaccoglitoreHeader({
  raccoglitore,
  projectCount,
  onUpdate,
  onDelete,
  onAddProject,
}: RaccoglitoreHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(raccoglitore.name);

  const handleSave = () => {
    if (name.trim() && name.trim() !== raccoglitore.name) {
      onUpdate({ name: name.trim() });
    }
    setIsEditing(false);
  };

  const IconComponent = getIconComponent(raccoglitore.icon);

  return (
    <div className="group/rh flex items-center gap-2 px-3 py-2">
      <div
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
        style={{ backgroundColor: raccoglitore.color + '20', color: raccoglitore.color }}
      >
        <IconComponent className="h-3 w-3" />
      </div>

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
          <h3 className="flex-1 truncate text-sm font-semibold text-foreground">{raccoglitore.name}</h3>
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {projectCount}
          </span>
          <button
            type="button"
            onClick={onAddProject}
            className="rounded p-0.5 text-primary transition-colors hover:bg-primary/10"
            title="Aggiungi progetto"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/rh:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded p-0.5 opacity-0 transition-opacity hover:bg-accent group-hover/rh:opacity-100"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
        </>
      )}
    </div>
  );
}
