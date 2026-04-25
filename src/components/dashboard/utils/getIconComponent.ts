import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export function getIconComponent(iconName: string): LucideIcon {
  const icons = LucideIcons as unknown as Record<string, LucideIcon>;
  return icons[iconName] ?? LucideIcons.Folder;
}
