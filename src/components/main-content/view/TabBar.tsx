import { useCallback, useRef, useState } from 'react';
import { MessageSquare, TerminalSquare, X } from 'lucide-react';
import {
  useTabsStore,
  activateTab,
  closeTab,
  closeOthers,
  closeAllTabs,
  reorderTabs,
  type Tab,
} from '../../../stores/tabsStore';

interface TabBarProps {
  /** Called after activating a tab — caller syncs URL. */
  onActivate?: (tab: Tab) => void;
  /** Called after closing — caller may navigate if no tabs remain. */
  onClose?: (closedId: string) => void;
}

interface ContextMenu {
  x: number;
  y: number;
  tabId: string;
}

export default function TabBar({ onActivate, onClose }: TabBarProps) {
  const { tabs, activeTabId } = useTabsStore();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const dragIndexRef = useRef<number | null>(null);

  const handleActivate = useCallback(
    (tab: Tab) => {
      activateTab(tab.id);
      onActivate?.(tab);
    },
    [onActivate],
  );

  const handleClose = useCallback(
    (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      closeTab(id);
      onClose?.(id);
    },
    [onClose],
  );

  const handleDragStart = (index: number) => (e: React.DragEvent) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('application/x-bwlab-tab', String(index));
    } catch {
      /* ignore */
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (dragIndexRef.current === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (toIndex: number) => (e: React.DragEvent) => {
    e.preventDefault();
    const from = dragIndexRef.current;
    dragIndexRef.current = null;
    if (from === null || from === toIndex) return;
    reorderTabs(from, toIndex);
  };

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const closeMenu = useCallback(() => setContextMenu(null), []);

  if (tabs.length === 0) return null;

  return (
    <>
      <div
        className="flex h-9 min-h-9 w-full items-stretch overflow-x-auto border-b border-border/40 bg-muted/20"
        role="tablist"
      >
        {tabs.map((tab, idx) => {
          const isActive = tab.id === activeTabId;
          const Icon = tab.kind === 'shell' ? TerminalSquare : MessageSquare;
          return (
            <div
              key={tab.id}
              draggable
              onDragStart={handleDragStart(idx)}
              onDragOver={handleDragOver}
              onDrop={handleDrop(idx)}
              onContextMenu={(e) => handleContextMenu(e, tab.id)}
              onClick={() => handleActivate(tab)}
              className={`group flex min-w-[140px] max-w-[220px] cursor-pointer items-center gap-2 border-r border-border/40 px-3 transition-colors ${
                isActive
                  ? 'bg-background text-foreground'
                  : 'text-muted-foreground hover:bg-muted/40 hover:text-foreground'
              }`}
              role="tab"
              aria-selected={isActive}
              title={tab.title}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="flex-1 truncate text-xs font-medium">{tab.title}</span>
              <button
                type="button"
                onClick={(e) => handleClose(e, tab.id)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded opacity-0 transition hover:bg-muted group-hover:opacity-100"
                aria-label="Chiudi scheda"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {contextMenu && (
        <>
          <button
            type="button"
            onClick={closeMenu}
            className="fixed inset-0 z-50 cursor-default"
            aria-label="Chiudi menu"
          />
          <div
            className="fixed z-50 min-w-[180px] rounded-md border border-border bg-popover py-1 text-sm shadow-lg"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                closeTab(contextMenu.tabId);
                onClose?.(contextMenu.tabId);
                closeMenu();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
            >
              Chiudi scheda
            </button>
            <button
              type="button"
              onClick={() => {
                closeOthers(contextMenu.tabId);
                closeMenu();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
            >
              Chiudi altre
            </button>
            <button
              type="button"
              onClick={() => {
                closeAllTabs();
                onClose?.(contextMenu.tabId);
                closeMenu();
              }}
              className="flex w-full items-center px-3 py-1.5 text-left hover:bg-muted"
            >
              Chiudi tutte
            </button>
          </div>
        </>
      )}
    </>
  );
}
