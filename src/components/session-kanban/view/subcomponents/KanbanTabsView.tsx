import { useState } from 'react';
import type { ProjectSession } from '../../../../types/app';
import type { KanbanColumn, SessionLabel } from '../../types/kanban';
import SimpleSessionCard from './SimpleSessionCard';

type KanbanTabsViewProps = {
  columns: KanbanColumn[];
  sessionsByColumn: Map<number, { session: ProjectSession; position: number }[]>;
  currentTime: Date;
  projectName: string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onSessionClick: (session: ProjectSession) => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
  allProjects?: import('../../../../types/app').Project[];
};

export default function KanbanTabsView({
  columns, sessionsByColumn, currentTime, projectName,
  getLabelsForSession, onSessionClick, onSessionUpdated, onSessionDeleted, allProjects,
}: KanbanTabsViewProps) {
  const [activeId, setActiveId] = useState<number | null>(columns[0]?.id ?? null);

  const activeCol = columns.find((c) => c.id === activeId);
  const activeItems = activeId ? sessionsByColumn.get(activeId) ?? [] : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-border px-4 py-1">
        {columns.map((c) => {
          const count = (sessionsByColumn.get(c.id) ?? []).length;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => setActiveId(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm transition-colors ${
                c.id === activeId
                  ? 'border-b-2 border-primary font-semibold text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {c.column_name}
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{count}</span>
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {activeCol && activeItems.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {activeItems.map(({ session }) => (
              <SimpleSessionCard
                key={session.id}
                session={session}
                sessionLabels={getLabelsForSession(session.id)}
                currentTime={currentTime}
                projectName={projectName}
                onSessionClick={onSessionClick}
                onSessionUpdated={onSessionUpdated}
                onSessionDeleted={onSessionDeleted}
                allProjects={allProjects}
              />
            ))}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">Nessuna sessione in questa colonna</p>
        )}
      </div>
    </div>
  );
}
