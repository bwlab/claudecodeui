import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ProjectSession } from '../../../../types/app';
import type { KanbanColumn, SessionLabel } from '../../types/kanban';
import SimpleSessionCard from './SimpleSessionCard';

type KanbanAccordionViewProps = {
  columns: KanbanColumn[];
  sessionsByColumn: Map<number, { session: ProjectSession; position: number }[]>;
  currentTime: Date;
  projectName: string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onSessionClick: (session: ProjectSession) => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
};

export default function KanbanAccordionView({
  columns, sessionsByColumn, currentTime, projectName,
  getLabelsForSession, onSessionClick, onSessionUpdated, onSessionDeleted,
}: KanbanAccordionViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(columns.map((c) => c.id)));

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      {columns.map((col) => {
        const items = sessionsByColumn.get(col.id) ?? [];
        const isOpen = expanded.has(col.id);
        return (
          <div key={col.id} className="rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => toggle(col.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              <span className="flex-1 text-sm font-semibold">{col.column_name}</span>
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
            </button>
            {isOpen && (
              items.length > 0 ? (
                <div className="grid grid-cols-1 gap-2 border-t border-border/50 p-3 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map(({ session }) => (
                    <SimpleSessionCard
                      key={session.id}
                      session={session}
                      sessionLabels={getLabelsForSession(session.id)}
                      currentTime={currentTime}
                      projectName={projectName}
                      onSessionClick={onSessionClick}
                      onSessionUpdated={onSessionUpdated}
                      onSessionDeleted={onSessionDeleted}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-t border-border/50 px-4 py-4 text-center text-xs text-muted-foreground">
                  Nessuna sessione
                </div>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
