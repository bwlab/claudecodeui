import type { ProjectSession } from '../../../../types/app';
import type { KanbanColumn, SessionLabel } from '../../types/kanban';
import SimpleSessionCard from './SimpleSessionCard';

type KanbanGridViewProps = {
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

export default function KanbanGridView({
  columns, sessionsByColumn, currentTime, projectName,
  getLabelsForSession, onSessionClick, onSessionUpdated, onSessionDeleted, allProjects,
}: KanbanGridViewProps) {
  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto p-4">
      {columns.map((col) => {
        const items = sessionsByColumn.get(col.id) ?? [];
        return (
          <div key={col.id}>
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">{col.column_name}</h3>
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{items.length}</span>
            </div>
            {items.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
                    allProjects={allProjects}
                  />
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-border/50 py-4 text-center text-xs text-muted-foreground">
                Nessuna sessione
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
