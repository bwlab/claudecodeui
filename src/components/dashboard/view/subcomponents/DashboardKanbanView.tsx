import { useState } from 'react';
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

  const parentDepth = currentNode?.depth ?? -1;
  const canAddAtThisLevel = parentDepth + 1 <= MAX_RACCOGLITORE_DEPTH;

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    if (!canAddAtThisLevel) return;
    onAddRaccoglitore(newColName.trim(), {
      parent_id: currentNode ? currentNode.id : null,
    });
    setNewColName('');
    setIsAddingColumn(false);
  };

  return (
    <>
      <div className="flex h-full gap-4 overflow-x-auto p-4">
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
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2" style={{ minHeight: '100px' }}>
                {projects.map((project) => (
                  <DashboardProjectCard
                    key={project.name}
                    project={project}
                    onClick={onProjectClick}
                    taskSummary={taskSummary[project.path || project.fullPath || '']}
                    currentRaccoglitoreId={r.id}
                    tree={tree}
                    onMoveProject={onMoveProjectAssignment}
                  />
                ))}
                {projects.length === 0 && r.children.length === 0 && (
                  <p className="px-2 py-3 text-center text-xs text-muted-foreground/70">Vuoto</p>
                )}
              </div>
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

        {/* Add column button (at current level) */}
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
    </>
  );
}
