import { useState, useMemo, type ReactNode } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  pointerWithin,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { Plus, Check, X, FolderPlus } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { RaccoglitoreNode } from '../../types/dashboard';
import { MAX_RACCOGLITORE_DEPTH } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import RaccoglitoreHeader from './RaccoglitoreHeader';
import DashboardProjectCard from './DashboardProjectCard';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';
import MoveRaccoglitoreDialog from './MoveRaccoglitoreDialog';
import DeleteRaccoglitoreDialog from './DeleteRaccoglitoreDialog';

type AddOptions = { color?: string; icon?: string; notes?: string; parent_id?: number | null };

type DashboardKanbanViewProps = {
  tree: RaccoglitoreNode[];
  currentChildren: RaccoglitoreNode[];
  currentNode: RaccoglitoreNode | null;
  projectsByRaccoglitore: Map<number, Project[]>;
  onProjectClick: (project: Project) => void;
  onAddRaccoglitore: (name: string, options?: AddOptions) => void;
  onUpdateRaccoglitore: (rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => void;
  onDeleteRaccoglitore: (rid: number, options?: { reparent?: boolean }) => void;
  onMoveRaccoglitore: (rid: number, parentId: number | null, position?: number | null) => Promise<void>;
  onAssignProject: (rid: number, projectName: string) => void;
  onRemoveProject: (rid: number, projectName: string) => void;
  onMoveProjectAssignment: (fromRid: number, toRid: number, projectName: string) => Promise<void> | void;
  onDrillInto: (rid: number) => void;
  allProjects: Project[];
  taskSummary: ClaudeTaskSummaryByProject;
};

type ActiveDrag = { fromRid: number; project: Project };

function DroppableColumn({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, data: { type: 'column' } });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-1 flex-col gap-2 overflow-y-auto p-2 transition-colors ${
        isOver ? 'bg-primary/10' : ''
      }`}
      style={{ minHeight: '100px' }}
    >
      {children}
    </div>
  );
}

function DraggableCard({ id, children }: { id: string; children: ReactNode }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, data: { type: 'project' } });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`touch-none ${isDragging ? 'opacity-40' : ''}`}
    >
      {children}
    </div>
  );
}

export default function DashboardKanbanView({
  tree,
  currentChildren,
  currentNode,
  projectsByRaccoglitore,
  onProjectClick,
  onAddRaccoglitore,
  onUpdateRaccoglitore,
  onDeleteRaccoglitore,
  onMoveRaccoglitore,
  onAssignProject,
  onRemoveProject,
  onMoveProjectAssignment,
  onDrillInto,
  allProjects,
  taskSummary,
}: DashboardKanbanViewProps) {
  const [isAddingColumn, setIsAddingColumn] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [assignRid, setAssignRid] = useState<number | null>(null);
  const [moveTargetNode, setMoveTargetNode] = useState<RaccoglitoreNode | null>(null);
  const [deleteTargetNode, setDeleteTargetNode] = useState<RaccoglitoreNode | null>(null);
  const [activeDrag, setActiveDrag] = useState<ActiveDrag | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const parentDepth = currentNode?.depth ?? -1;
  const canAddAtThisLevel = parentDepth + 1 <= MAX_RACCOGLITORE_DEPTH;

  const currentNodeDirectProjects = useMemo(
    () => (currentNode ? (projectsByRaccoglitore.get(currentNode.id) ?? []) : []),
    [currentNode, projectsByRaccoglitore],
  );

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    if (!canAddAtThisLevel) return;
    onAddRaccoglitore(newColName.trim(), {
      parent_id: currentNode ? currentNode.id : null,
    });
    setNewColName('');
    setIsAddingColumn(false);
  };

  const parseCardId = (id: string) => {
    // card:<rid>:<projectName>
    const rest = id.slice('card:'.length);
    const sep = rest.indexOf(':');
    if (sep < 0) return null;
    return { fromRid: Number(rest.slice(0, sep)), projectName: rest.slice(sep + 1) };
  };

  const parseColId = (id: string) => {
    if (!id.startsWith('col:')) return null;
    return Number(id.slice('col:'.length));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const parsed = parseCardId(String(event.active.id));
    if (!parsed) return;
    const list = projectsByRaccoglitore.get(parsed.fromRid) ?? [];
    const project = list.find((p) => p.name === parsed.projectName);
    if (!project) return;
    setActiveDrag({ fromRid: parsed.fromRid, project });
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveDrag(null);
    const { active, over } = event;
    if (!over) return;
    const parsedCard = parseCardId(String(active.id));
    if (!parsedCard) return;
    const toRid = parseColId(String(over.id));
    if (toRid === null || toRid === parsedCard.fromRid) return;
    try {
      await onMoveProjectAssignment(parsedCard.fromRid, toRid, parsedCard.projectName);
    } catch (err) {
      console.error('move project failed', err);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveDrag(null)}
    >
      <div className="flex h-full gap-4 overflow-x-auto p-4">
        {currentNode && currentNodeDirectProjects.length > 0 && (
          <div className="flex w-72 shrink-0 flex-col rounded-xl border border-primary/40 bg-primary/5">
            <div className="flex items-center gap-2 border-b border-primary/20 px-3 py-2">
              <div
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded"
                style={{ backgroundColor: currentNode.color + '20', color: currentNode.color }}
              >
                <Plus className="h-3 w-3" style={{ transform: 'rotate(45deg)' }} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-semibold text-foreground">{currentNode.name}</h3>
                <p className="text-[10px] text-muted-foreground">progetti diretti</p>
              </div>
              <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                {currentNodeDirectProjects.length}
              </span>
              <button
                type="button"
                onClick={() => setAssignRid(currentNode.id)}
                className="rounded p-0.5 text-primary transition-colors hover:bg-primary/10"
                title="Assegna progetto a questo raccoglitore"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <DroppableColumn id={`col:${currentNode.id}`}>
              {currentNodeDirectProjects.map((project) => (
                <DraggableCard key={project.name} id={`card:${currentNode.id}:${project.name}`}>
                  <DashboardProjectCard
                    project={project}
                    onClick={onProjectClick}
                    taskSummary={taskSummary[project.path || project.fullPath || '']}
                    currentRaccoglitoreId={currentNode.id}
                    tree={tree}
                    onMoveProject={onMoveProjectAssignment}
                  />
                </DraggableCard>
              ))}
            </DroppableColumn>
          </div>
        )}

        {currentChildren.map((r) => {
          const projects = projectsByRaccoglitore.get(r.id) ?? [];
          const canAddSub = r.depth + 1 <= MAX_RACCOGLITORE_DEPTH;
          return (
            <div key={r.id} className="flex w-72 shrink-0 flex-col rounded-xl border border-border bg-muted/30">
              <RaccoglitoreHeader
                raccoglitore={r}
                projectCount={r.directProjectsCount}
                childrenCount={r.children.length}
                totalCount={r.totalProjectsCount}
                onUpdate={(updates) => onUpdateRaccoglitore(r.id, updates)}
                onDelete={() => setDeleteTargetNode(r)}
                onAddProject={() => setAssignRid(r.id)}
                onDrillIn={() => onDrillInto(r.id)}
                onRequestMove={() => setMoveTargetNode(r)}
              />
              <DroppableColumn id={`col:${r.id}`}>
                {projects.map((project) => (
                  <DraggableCard key={project.name} id={`card:${r.id}:${project.name}`}>
                    <DashboardProjectCard
                      project={project}
                      onClick={onProjectClick}
                      taskSummary={taskSummary[project.path || project.fullPath || '']}
                      currentRaccoglitoreId={r.id}
                      tree={tree}
                      onMoveProject={onMoveProjectAssignment}
                    />
                  </DraggableCard>
                ))}
                {projects.length === 0 && r.children.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground/70">Vuoto</p>
                )}
              </DroppableColumn>
              {canAddSub && (
                <button
                  type="button"
                  onClick={() => {
                    onAddRaccoglitore(`Nuova sottocartella`, { parent_id: r.id });
                  }}
                  className="flex items-center justify-center gap-1 border-t border-border/60 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Crea una sottocartella dentro questo raccoglitore"
                >
                  <FolderPlus className="h-3 w-3" />
                  Aggiungi sottocartella
                </button>
              )}
            </div>
          );
        })}

        <div className="flex w-72 shrink-0 items-start">
          {isAddingColumn ? (
            <div className="flex w-full items-center gap-1 rounded-xl border border-dashed border-border bg-muted/20 p-3">
              <input
                autoFocus
                value={newColName}
                onChange={(e) => setNewColName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleAddColumn();
                  if (e.key === 'Escape') { setIsAddingColumn(false); setNewColName(''); }
                }}
                placeholder={currentNode ? 'Nome sottocartella...' : 'Nome raccoglitore...'}
                className="flex-1 rounded border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <button type="button" onClick={handleAddColumn} className="rounded p-1 hover:bg-accent">
                <Check className="h-4 w-4 text-primary" />
              </button>
              <button type="button" onClick={() => { setIsAddingColumn(false); setNewColName(''); }} className="rounded p-1 hover:bg-accent">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          ) : canAddAtThisLevel ? (
            <button
              type="button"
              onClick={() => setIsAddingColumn(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border/60 bg-muted/10 p-4 text-sm text-muted-foreground transition-colors hover:border-border hover:bg-muted/20"
            >
              <Plus className="h-4 w-4" />
              {currentNode ? 'Nuova sottocartella' : 'Nuovo raccoglitore'}
            </button>
          ) : (
            <p className="w-full rounded-xl border border-dashed border-border/40 bg-muted/10 p-4 text-center text-xs text-muted-foreground/70">
              Profondità massima raggiunta
            </p>
          )}
        </div>
      </div>

      <DragOverlay>
        {activeDrag && (
          <div className="pointer-events-none w-72 rotate-2 opacity-90">
            <DashboardProjectCard
              project={activeDrag.project}
              onClick={() => { /* no-op */ }}
              taskSummary={taskSummary[activeDrag.project.path || activeDrag.project.fullPath || '']}
            />
          </div>
        )}
      </DragOverlay>

      {assignRid !== null && (
        <ProjectAssignmentDialog
          allProjects={allProjects}
          assignedProjects={(projectsByRaccoglitore.get(assignRid) ?? []).map((p) => p.name)}
          onAssign={(name) => onAssignProject(assignRid, name)}
          onRemove={(name) => onRemoveProject(assignRid, name)}
          onClose={() => setAssignRid(null)}
        />
      )}

      {moveTargetNode && (
        <MoveRaccoglitoreDialog
          tree={tree}
          nodeId={moveTargetNode.id}
          currentParentId={moveTargetNode.parent_id}
          onMove={async (parentId) => {
            await onMoveRaccoglitore(moveTargetNode.id, parentId, null);
          }}
          onClose={() => setMoveTargetNode(null)}
        />
      )}

      {deleteTargetNode && (
        <DeleteRaccoglitoreDialog
          name={deleteTargetNode.name}
          hasChildren={deleteTargetNode.children.length > 0}
          onConfirm={async ({ reparent }) => {
            await onDeleteRaccoglitore(deleteTargetNode.id, { reparent });
          }}
          onClose={() => setDeleteTargetNode(null)}
        />
      )}
    </DndContext>
  );
}
