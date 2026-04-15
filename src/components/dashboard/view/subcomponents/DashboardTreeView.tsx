import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Folder, FolderPlus } from 'lucide-react';
import type { Project } from '../../../../types/app';
import type { RaccoglitoreNode } from '../../types/dashboard';
import { MAX_RACCOGLITORE_DEPTH } from '../../types/dashboard';
import type { ClaudeTaskSummaryByProject } from '../../../claude-tasks/types/claude-tasks';
import DashboardProjectCard from './DashboardProjectCard';
import RaccoglitoreHeader from './RaccoglitoreHeader';
import MoveRaccoglitoreDialog from './MoveRaccoglitoreDialog';
import DeleteRaccoglitoreDialog from './DeleteRaccoglitoreDialog';
import ProjectAssignmentDialog from './ProjectAssignmentDialog';

type AddOptions = { color?: string; icon?: string; notes?: string; parent_id?: number | null };

type Props = {
  tree: RaccoglitoreNode[];
  currentPath: number[];
  currentNode: RaccoglitoreNode | null;
  currentChildren: RaccoglitoreNode[];
  projectsByRaccoglitore: Map<number, Project[]>;
  onProjectClick: (project: Project) => void;
  onSetPath: (path: number[]) => void;
  onAddRaccoglitore: (name: string, options?: AddOptions) => void;
  onUpdateRaccoglitore: (rid: number, updates: { name?: string; color?: string; icon?: string; notes?: string }) => void;
  onDeleteRaccoglitore: (rid: number, options?: { reparent?: boolean }) => void;
  onMoveRaccoglitore: (rid: number, parentId: number | null, position?: number | null) => Promise<void>;
  onAssignProject: (rid: number, projectName: string) => void;
  onRemoveProject: (rid: number, projectName: string) => void;
  onMoveProjectAssignment: (fromRid: number, toRid: number, projectName: string) => Promise<void> | void;
  allProjects: Project[];
  taskSummary: ClaudeTaskSummaryByProject;
};

type TreeRowProps = {
  node: RaccoglitoreNode;
  path: number[];
  currentPath: number[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
  onSelect: (path: number[]) => void;
};

function TreeRow({ node, path, currentPath, expanded, onToggle, onSelect }: TreeRowProps) {
  const fullPath = [...path, node.id];
  const key = fullPath.join('.');
  const isOpen = expanded.has(key);
  const isSelected = currentPath.length === fullPath.length && currentPath.every((id, i) => id === fullPath[i]);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className={`group flex items-center gap-1 rounded px-1.5 py-1 text-xs transition-colors ${
          isSelected ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
        }`}
      >
        <button
          type="button"
          onClick={() => onToggle(key)}
          disabled={!hasChildren}
          className="flex h-4 w-4 flex-shrink-0 items-center justify-center disabled:opacity-30"
        >
          {hasChildren ? (
            isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />
          ) : null}
        </button>
        <button
          type="button"
          onClick={() => onSelect(fullPath)}
          className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
        >
          <Folder className="h-3.5 w-3.5 flex-shrink-0" style={{ color: node.color }} />
          <span className="truncate">{node.name}</span>
          {node.totalProjectsCount > 0 && (
            <span className="ml-auto rounded-full bg-muted px-1 text-[9px] text-muted-foreground">
              {node.totalProjectsCount}
            </span>
          )}
        </button>
      </div>
      {isOpen && (
        <div className="ml-3 border-l border-border/40 pl-1">
          {node.children.map((child) => (
            <TreeRow
              key={child.id}
              node={child}
              path={fullPath}
              currentPath={currentPath}
              expanded={expanded}
              onToggle={onToggle}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardTreeView({
  tree,
  currentPath,
  currentNode,
  currentChildren,
  projectsByRaccoglitore,
  onProjectClick,
  onSetPath,
  onAddRaccoglitore,
  onUpdateRaccoglitore,
  onDeleteRaccoglitore,
  onMoveRaccoglitore,
  onAssignProject,
  onRemoveProject,
  onMoveProjectAssignment,
  allProjects,
  taskSummary,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>();
    // Auto-expand along currentPath
    currentPath.forEach((_, i) => {
      s.add(currentPath.slice(0, i + 1).join('.'));
    });
    return s;
  });
  const [assignRid, setAssignRid] = useState<number | null>(null);
  const [moveTargetNode, setMoveTargetNode] = useState<RaccoglitoreNode | null>(null);
  const [deleteTargetNode, setDeleteTargetNode] = useState<RaccoglitoreNode | null>(null);

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const parentDepth = currentNode?.depth ?? -1;
  const canAddAtCurrent = parentDepth + 1 <= MAX_RACCOGLITORE_DEPTH;

  const directProjects = useMemo(() => {
    if (!currentNode) return [] as Project[];
    return projectsByRaccoglitore.get(currentNode.id) ?? [];
  }, [currentNode, projectsByRaccoglitore]);

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <aside className="flex w-64 flex-shrink-0 flex-col border-r border-border/50 bg-muted/10">
          <div className="flex items-center justify-between border-b border-border/40 px-3 py-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Raccoglitori
            </span>
            {canAddAtCurrent && (
              <button
                type="button"
                onClick={() => {
                  onAddRaccoglitore('Nuovo raccoglitore', {
                    parent_id: currentNode ? currentNode.id : null,
                  });
                }}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                title={currentNode ? 'Nuova sottocartella qui' : 'Nuovo raccoglitore'}
              >
                <FolderPlus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            <button
              type="button"
              onClick={() => onSetPath([])}
              className={`mb-1 flex w-full items-center gap-1 rounded px-2 py-1 text-xs ${
                currentPath.length === 0
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
              }`}
            >
              <span>Radice</span>
            </button>
            {tree.map((root) => (
              <TreeRow
                key={root.id}
                node={root}
                path={[]}
                currentPath={currentPath}
                expanded={expanded}
                onToggle={toggle}
                onSelect={onSetPath}
              />
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {currentNode ? (
            <>
              <div className="border-b border-border/40 px-4 py-2">
                <RaccoglitoreHeader
                  raccoglitore={currentNode}
                  projectCount={currentNode.directProjectsCount}
                  childrenCount={currentNode.children.length}
                  totalCount={currentNode.totalProjectsCount}
                  onUpdate={(updates) => onUpdateRaccoglitore(currentNode.id, updates)}
                  onDelete={() => setDeleteTargetNode(currentNode)}
                  onAddProject={() => setAssignRid(currentNode.id)}
                  onRequestMove={() => setMoveTargetNode(currentNode)}
                />
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {currentChildren.length > 0 && (
                  <section className="mb-6">
                    <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Sottocartelle
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {currentChildren.map((child) => (
                        <button
                          key={child.id}
                          type="button"
                          onClick={() => onSetPath([...currentPath, child.id])}
                          className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-left transition-all hover:border-border hover:shadow-sm"
                        >
                          <Folder className="h-5 w-5 flex-shrink-0" style={{ color: child.color }} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{child.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {child.totalProjectsCount} progetti · {child.children.length} sotto
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <section>
                  <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Progetti
                  </h4>
                  {directProjects.length === 0 ? (
                    <p className="rounded border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                      Nessun progetto diretto in questo raccoglitore.
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {directProjects.map((project) => (
                        <DashboardProjectCard
                          key={project.name}
                          project={project}
                          onClick={onProjectClick}
                          taskSummary={taskSummary[project.path || project.fullPath || '']}
                          currentRaccoglitoreId={currentNode.id}
                          tree={tree}
                          onMoveProject={onMoveProjectAssignment}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </div>
            </>
          ) : (
            <div className="flex-1 overflow-y-auto p-4">
              <h4 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Raccoglitori principali
              </h4>
              {currentChildren.length === 0 ? (
                <p className="rounded border border-dashed border-border/60 p-6 text-center text-xs text-muted-foreground">
                  Nessun raccoglitore. Crea il primo dalla sidebar o dalla vista kanban.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {currentChildren.map((child) => (
                    <button
                      key={child.id}
                      type="button"
                      onClick={() => onSetPath([child.id])}
                      className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-left transition-all hover:border-border hover:shadow-sm"
                    >
                      <Folder className="h-5 w-5 flex-shrink-0" style={{ color: child.color }} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{child.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {child.totalProjectsCount} progetti · {child.children.length} sotto
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
