import { useState } from 'react';
import { X, Search, Check, Minus } from 'lucide-react';
import type { Project } from '../../../../types/app';

type ProjectAssignmentDialogProps = {
  allProjects: Project[];
  assignedProjects: string[];
  onAssign: (projectName: string) => void;
  onRemove: (projectName: string) => void;
  onClose: () => void;
};

export default function ProjectAssignmentDialog({
  allProjects,
  assignedProjects,
  onAssign,
  onRemove,
  onClose,
}: ProjectAssignmentDialogProps) {
  const [search, setSearch] = useState('');
  const assignedSet = new Set(assignedProjects);

  const filtered = allProjects.filter((p) => {
    const term = search.toLowerCase();
    return (p.displayName || p.name).toLowerCase().includes(term) || (p.path || '').toLowerCase().includes(term);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold">Aggiungi progetti</h3>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca progetti..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">Nessun progetto trovato</p>
          ) : (
            filtered.map((project) => {
              const isAssigned = assignedSet.has(project.name);
              return (
                <button
                  key={project.name}
                  type="button"
                  onClick={() => isAssigned ? onRemove(project.name) : onAssign(project.name)}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-accent/50"
                >
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    isAssigned ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  }`}>
                    {isAssigned ? <Check className="h-3 w-3" /> : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{project.displayName || project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{project.path || project.fullPath}</p>
                  </div>
                  {isAssigned && (
                    <Minus className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
