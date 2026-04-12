import { useState } from 'react';
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  onMoveColumn: (columnIds: number[]) => void;
  allProjects?: import('../../../../types/app').Project[];
};

function SortableAccordionItem({
  column, items, isOpen, toggle, currentTime, projectName,
  getLabelsForSession, onSessionClick, onSessionUpdated, onSessionDeleted, allProjects,
}: {
  column: KanbanColumn;
  items: { session: ProjectSession; position: number }[];
  isOpen: boolean;
  toggle: (id: number) => void;
  currentTime: Date;
  projectName: string;
  getLabelsForSession: (sessionId: string) => SessionLabel[];
  onSessionClick: (session: ProjectSession) => void;
  onSessionUpdated: () => void;
  onSessionDeleted: (sessionId: string) => void;
  allProjects?: import('../../../../types/app').Project[];
}) {
  const {
    attributes, listeners, setNodeRef, transform, transition, isDragging,
  } = useSortable({ id: `col-${column.id}` });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-xl border border-border bg-card ${isDragging ? 'opacity-50' : ''}`}
    >
      <div className="flex w-full items-center gap-2 px-4 py-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="cursor-grab p-1 text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
          title="Trascina per riordinare"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => toggle(column.id)}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <span className="flex-1 text-sm font-semibold">{column.column_name}</span>
        </button>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
      </div>
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
                allProjects={allProjects}
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
}

export default function KanbanAccordionView({
  columns, sessionsByColumn, currentTime, projectName,
  getLabelsForSession, onSessionClick, onSessionUpdated, onSessionDeleted, onMoveColumn, allProjects,
}: KanbanAccordionViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(columns.map((c) => c.id)));

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = columns.findIndex((c) => `col-${c.id}` === String(active.id));
    const newIndex = columns.findIndex((c) => `col-${c.id}` === String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = [...columns];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);
    onMoveColumn(reordered.map((c) => c.id));
  };

  const sortableIds = columns.map((c) => `col-${c.id}`);

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
          {columns.map((col) => (
            <SortableAccordionItem
              key={col.id}
              column={col}
              items={sessionsByColumn.get(col.id) ?? []}
              isOpen={expanded.has(col.id)}
              toggle={toggle}
              currentTime={currentTime}
              projectName={projectName}
              getLabelsForSession={getLabelsForSession}
              onSessionClick={onSessionClick}
              onSessionUpdated={onSessionUpdated}
              onSessionDeleted={onSessionDeleted}
              allProjects={allProjects}
            />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}
