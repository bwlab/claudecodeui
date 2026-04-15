import { ChevronRight, Home } from 'lucide-react';
import type { RaccoglitoreNode } from '../../types/dashboard';

type Props = {
  pathNodes: RaccoglitoreNode[];
  onNavigate: (path: number[]) => void;
};

export default function RaccoglitoreBreadcrumb({ pathNodes, onNavigate }: Props) {
  if (pathNodes.length === 0) return null;

  return (
    <nav className="flex items-center gap-1 border-b border-border bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
      <button
        type="button"
        onClick={() => onNavigate([])}
        className="flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
        <span>Home</span>
      </button>
      {pathNodes.map((node, idx) => {
        const isLast = idx === pathNodes.length - 1;
        const subPath = pathNodes.slice(0, idx + 1).map(n => n.id);
        return (
          <span key={node.id} className="flex items-center gap-1">
            <ChevronRight className="h-3 w-3" />
            {isLast ? (
              <span className="rounded px-1.5 py-0.5 font-medium text-foreground">{node.name}</span>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate(subPath)}
                className="rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
              >
                {node.name}
              </button>
            )}
          </span>
        );
      })}
    </nav>
  );
}
