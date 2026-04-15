import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { Project } from '../../../types/app';
import { useDashboardState } from '../hooks/useDashboardState';
import { useClaudeTasksApi } from '../../claude-tasks/hooks/useClaudeTasksApi';
import type { ClaudeTaskSummaryByProject } from '../../claude-tasks/types/claude-tasks';
import DashboardKanbanView from './subcomponents/DashboardKanbanView';
import DashboardAccordionView from './subcomponents/DashboardAccordionView';
import DashboardTabsView from './subcomponents/DashboardTabsView';
import DashboardGridView from './subcomponents/DashboardGridView';
import DashboardTreeView from './subcomponents/DashboardTreeView';
import ViewModeSwitcher from './subcomponents/ViewModeSwitcher';
import RaccoglitoreBreadcrumb from './subcomponents/RaccoglitoreBreadcrumb';

type DashboardViewProps = {
  dashboardId: number;
  projects: Project[];
  onProjectClick: (project: Project) => void;
};

export default function DashboardView({ dashboardId, projects, onProjectClick }: DashboardViewProps) {
  const state = useDashboardState(dashboardId, projects);
  const tasksApi = useClaudeTasksApi();
  const [taskSummary, setTaskSummary] = useState<ClaudeTaskSummaryByProject>({});

  useEffect(() => {
    tasksApi.getSummary().then(setTaskSummary);
  }, [tasksApi]);

  if (state.loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state.dashboard) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Dashboard non trovata
      </div>
    );
  }

  const legacyViewProps = {
    raccoglitori: state.currentChildren,
    projectsByRaccoglitore: state.projectsByRaccoglitore,
    onProjectClick,
    onAddRaccoglitore: (name: string) => state.addRaccoglitore(name),
    onUpdateRaccoglitore: state.updateRaccoglitore,
    onDeleteRaccoglitore: (rid: number) => state.deleteRaccoglitore(rid),
    onAssignProject: state.assignProject,
    onRemoveProject: state.removeProject,
    onMoveRaccoglitori: state.moveRaccoglitori,
    allProjects: projects,
    taskSummary,
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h2 className="text-sm font-semibold text-foreground">{state.dashboard.name}</h2>
        <ViewModeSwitcher
          viewMode={state.dashboard.view_mode}
          onViewModeChange={(mode) => state.updateViewMode(mode)}
        />
      </div>
      <RaccoglitoreBreadcrumb pathNodes={state.pathNodes} onNavigate={state.setCurrentPath} />
      <div className="flex-1 overflow-hidden">
        {state.dashboard.view_mode === 'kanban' && (
          <DashboardKanbanView
            tree={state.tree}
            currentChildren={state.currentChildren}
            currentNode={state.currentNode}
            projectsByRaccoglitore={state.projectsByRaccoglitore}
            onProjectClick={onProjectClick}
            onAddRaccoglitore={(name, options) => state.addRaccoglitore(name, options)}
            onUpdateRaccoglitore={state.updateRaccoglitore}
            onDeleteRaccoglitore={(rid, options) => state.deleteRaccoglitore(rid, options)}
            onMoveRaccoglitore={state.moveRaccoglitore}
            onAssignProject={state.assignProject}
            onRemoveProject={state.removeProject}
            onMoveProjectAssignment={state.moveProjectAssignment}
            onDrillInto={state.drillInto}
            allProjects={projects}
            taskSummary={taskSummary}
          />
        )}
        {state.dashboard.view_mode === 'accordion' && <DashboardAccordionView {...legacyViewProps} />}
        {state.dashboard.view_mode === 'tabs' && <DashboardTabsView {...legacyViewProps} />}
        {state.dashboard.view_mode === 'grid' && <DashboardGridView {...legacyViewProps} />}
        {state.dashboard.view_mode === 'tree' && (
          <DashboardTreeView
            tree={state.tree}
            currentPath={state.currentPath}
            currentNode={state.currentNode}
            currentChildren={state.currentChildren}
            projectsByRaccoglitore={state.projectsByRaccoglitore}
            onProjectClick={onProjectClick}
            onSetPath={state.setCurrentPath}
            onAddRaccoglitore={(name, options) => state.addRaccoglitore(name, options)}
            onUpdateRaccoglitore={state.updateRaccoglitore}
            onDeleteRaccoglitore={(rid, options) => state.deleteRaccoglitore(rid, options)}
            onMoveRaccoglitore={state.moveRaccoglitore}
            onAssignProject={state.assignProject}
            onRemoveProject={state.removeProject}
            onMoveProjectAssignment={state.moveProjectAssignment}
            allProjects={projects}
            taskSummary={taskSummary}
          />
        )}
      </div>
    </div>
  );
}
