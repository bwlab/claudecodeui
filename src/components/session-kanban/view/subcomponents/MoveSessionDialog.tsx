import { useState } from 'react';
import { X, Search, FolderInput, Check } from 'lucide-react';
import type { Project, ProjectSession } from '../../../../types/app';
import { api } from '../../../../utils/api';

type MoveSessionDialogProps = {
  session: ProjectSession;
  sessionTitle: string;
  currentProjectName: string;
  allProjects: Project[];
  onClose: () => void;
  onMoved: (sessionId: string) => void;
};

export default function MoveSessionDialog({
  session, sessionTitle, currentProjectName, allProjects, onClose, onMoved,
}: MoveSessionDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = allProjects
    .filter((p) => p.name !== currentProjectName)
    .filter((p) => {
      if (!search.trim()) return true;
      const term = search.toLowerCase();
      return (
        (p.displayName || p.name).toLowerCase().includes(term) ||
        (p.path || p.fullPath || '').toLowerCase().includes(term)
      );
    });

  const handleMove = async () => {
    if (!selectedProject) return;
    setMoving(true);
    setError(null);
    try {
      const res = await api.moveSession(currentProjectName, session.id, selectedProject.name);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Errore sconosciuto');
      }
      onMoved(session.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setMoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <FolderInput className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold">Sposta sessione</h3>
          </div>
          <button type="button" onClick={onClose} className="rounded p-1 hover:bg-accent">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        <div className="border-b border-border px-4 py-2">
          <p className="text-xs text-muted-foreground">
            Sposti <span className="font-medium text-foreground">{sessionTitle}</span> da <code className="rounded bg-muted px-1 py-0.5 font-mono">{currentProjectName}</code>
          </p>
        </div>

        <div className="border-b border-border px-4 py-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca progetto destinazione..."
              className="flex-1 bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">
              {search ? 'Nessun progetto trovato' : 'Nessun altro progetto disponibile'}
            </p>
          ) : (
            filtered.map((project) => {
              const isSelected = selectedProject?.name === project.name;
              return (
                <button
                  key={project.name}
                  type="button"
                  onClick={() => setSelectedProject(project)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-accent/50'
                  }`}
                >
                  <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                  }`}>
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{project.displayName || project.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{project.path || project.fullPath}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {error && (
          <div className="border-t border-border bg-destructive/10 px-4 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={onClose} className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent">
            Annulla
          </button>
          <button
            type="button"
            onClick={handleMove}
            disabled={!selectedProject || moving}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            <FolderInput className="h-3.5 w-3.5" />
            {moving ? 'Spostamento...' : 'Sposta'}
          </button>
        </div>
      </div>
    </div>
  );
}
