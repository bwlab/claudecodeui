import DashboardSelector from '../../../dashboard/view/DashboardSelector';
import type { MainContentHeaderProps } from '../../types/types';
import MobileMenuButton from './MobileMenuButton';
import MainContentTabSwitcher from './MainContentTabSwitcher';
import MainContentTitle from './MainContentTitle';
import ProjectBreadcrumb from './ProjectBreadcrumb';

export default function MainContentHeader({
  activeTab,
  setActiveTab,
  selectedProject,
  selectedSession,
  shouldShowTasksTab,
  isMobile,
  onMenuClick,
  activeDashboardId,
  effectiveDashboardId,
  onDashboardSelect,
  onNavigateToDashboardPath,
  hideDashboardSelector,
}: MainContentHeaderProps) {
  const breadcrumbDashboardId = activeDashboardId !== null
    ? null // dashboard already visible — no need to show breadcrumb
    : effectiveDashboardId ?? null;
  const showBreadcrumb = !!selectedProject && breadcrumbDashboardId !== null;

  return (
    <div className="pwa-header-safe flex-shrink-0 border-b border-border/60 bg-background px-3 py-1.5 sm:px-4 sm:py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {isMobile && <MobileMenuButton onMenuClick={onMenuClick} />}
          {selectedProject && (
            <MainContentTitle
              activeTab={activeTab}
              selectedProject={selectedProject}
              selectedSession={selectedSession}
              shouldShowTasksTab={shouldShowTasksTab}
            />
          )}
        </div>

        {!hideDashboardSelector && !activeDashboardId && (
          <DashboardSelector activeDashboardId={activeDashboardId} onDashboardSelect={onDashboardSelect} />
        )}

        {selectedProject && (
          <div className="scrollbar-hide min-w-0 flex-shrink overflow-x-auto sm:flex-shrink-0">
            <MainContentTabSwitcher
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              shouldShowTasksTab={shouldShowTasksTab}
            />
          </div>
        )}
      </div>
      {showBreadcrumb && (
        <ProjectBreadcrumb
          dashboardId={breadcrumbDashboardId}
          projectName={selectedProject!.name}
          projectDisplayName={selectedProject!.displayName || selectedProject!.name}
          onNavigate={onNavigateToDashboardPath}
        />
      )}
    </div>
  );
}
