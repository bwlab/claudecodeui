import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus, Check, X, GripVertical } from 'lucide-react';
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
import type { Project } from '../../../../types/app';
import type { Raccoglitore } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import { getIconComponent } from '../../utils/getIconComponent';
import DashboardProjectCard from './DashboardProjectCard';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';

type DashboardAccordionViewProps = {
  raccoglitori: Raccoglitore[];
  projectsByRaccoglitore: Map<number, Project[]>;
  onProjectClick: (project: Project) => void;
  onAddRaccoglitore: (name: string, color?: string, icon?: string, notes?: string) => void;
  onUpdateRaccoglitore: (rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => void;
  onDeleteRaccoglitore: (rid: number) => void;
  onAssignProject: (rid: number, projectName: string) => void;
  onRemoveProject: (rid: number, projectName: string) => void;
  onMoveRaccoglitori?: (ids: number[]) => void;
  allProjects: Project[];
  taskSummary: ClaudeTaskSummaryByProject;
};

function SortableRaccoglitore({
  r, projects, isOpen, toggle, onProjectClick, onAssignClick, taskSummary,
}: {
  r: Raccoglitore;
  projects: Project[];
  isOpen: boolean;
  toggle: (id: number) => void;
  onProjectClick: (project: Project) => void;
  onAssignClick: (id: number) => void;
  taskSummary: ClaudeTaskSummaryByProject;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `rac-${r.id}` });
  const style = { transform: CSS.Transform.toString(transform), transition };
  const IconComponent = getIconComponent(r.icon);

  return (
    <div ref={setNodeRef} style={style} className={`rounded-xl border border-border bg-card ${isDragging ? 'opacity-50' : ''}`}>
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
          onClick={() => toggle(r.id)}
          className="flex flex-1 items-center gap-3 text-left"
        >
          {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          <div className="flex h-5 w-5 items-center justify-center rounded" style={{ backgroundColor: r.color + '20', color: r.color }}>
            <IconComponent className="h-3 w-3" />
          </div>
          <span className="flex-1 text-sm font-semibold">{r.name}</span>
        </button>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{projects.length}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onAssignClick(r.id); }}
          className="rounded p-1 text-primary hover:bg-primary/10"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
      {isOpen && projects.length > 0 && (
        <div className="grid grid-cols-1 gap-2 border-t border-border/50 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <DashboardProjectCard key={p.name} project={p} onClick={onProjectClick} taskSummary={taskSummary[p.path || p.fullPath || '']} />
          ))}
        </div>
      )}
      {isOpen && projects.length === 0 && (
        <div className="border-t border-border/50 px-4 py-4 text-center text-xs text-muted-foreground">Nessun progetto</div>
      )}
    </div>
  );
}

export default function DashboardAccordionView({
  raccoglitori,
  projectsByRaccoglitore,
  onProjectClick,
  onAddRaccoglitore,
  onAssignProject,
  onRemoveProject,
  onMoveRaccoglitori,
  allProjects,
  taskSummary,
}: DashboardAccordionViewProps) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set(raccoglitori.map((r) => r.id)));
  const [assignRid, setAssignRid] = useState<number | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !onMoveRaccoglitori) return;
    const oldIdx = raccoglitori.findIndex((r) => `rac-${r.id}` === String(active.id));
    const newIdx = raccoglitori.findIndex((r) => `rac-${r.id}` === String(over.id));
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = [...raccoglitori];
    const [moved] = reordered.splice(oldIdx, 1);
    reordered.splice(newIdx, 0, moved);
    onMoveRaccoglitori(reordered.map((r) => r.id));
  };

  const sortableIds = raccoglitori.map((r) => `rac-${r.id}`);

  return (
    <>
      <div className="flex h-full flex-col gap-2 overflow-y-auto p-4">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
            {raccoglitori.map((r) => (
              <SortableRaccoglitore
                key={r.id}
                r={r}
                projects={projectsByRaccoglitore.get(r.id) ?? []}
                isOpen={expanded.has(r.id)}
                toggle={toggle}
                onProjectClick={onProjectClick}
                onAssignClick={setAssignRid}
                taskSummary={taskSummary}
              />
            ))}
          </SortableContext>
        </DndContext>

        {isAdding ? (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newName.trim()) { onAddRaccoglitore(newName.trim()); setNewName(''); setIsAdding(false); }
                if (e.key === 'Escape') { setIsAdding(false); setNewName(''); }
              }}
              placeholder="Nome raccoglitore..."
              className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
            />
            <button type="button" onClick={() => { if (newName.trim()) { onAddRaccoglitore(newName.trim()); setNewName(''); setIsAdding(false); }}} className="rounded p-1 hover:bg-accent">
              <Check className="h-4 w-4 text-primary" />
            </button>
            <button type="button" onClick={() => { setIsAdding(false); setNewName(''); }} className="rounded p-1 hover:bg-accent">
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 p-3 text-sm text-muted-foreground hover:border-border hover:bg-muted/10"
          >
            <Plus className="h-4 w-4" /> Nuovo raccoglitore
          </button>
        )}
      </div>

      {assignRid !== null && (
        <ProjectAssignmentDialog
          allProjects={allProjects}
          assignedProjects={(projectsByRaccoglitore.get(assignRid) ?? []).map((p) => p.name)}
          onAssign={(name) => onAssignProject(assignRid, name)}
          onRemove={(name) => onRemoveProject(assignRid, name)}
          onClose={() => setAssignRid(null)}
        />
      )}
    </>
  );
}
