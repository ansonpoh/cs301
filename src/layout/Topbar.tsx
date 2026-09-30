import { Globe2, Menu } from 'lucide-react';
import type { User } from '../lib/types';
import { Avatar } from '../components/ui';

export default function Topbar({
  user,
  title,
  onOpenMenu,
}: {
  user: User;
  title: string;
  onOpenMenu: () => void;
}) {
  return (
    <header className="topbar">
      <div className="breadcrumb">
        <button
          className="mobile-menu icon-button"
          aria-label="Open navigation"
          onClick={onOpenMenu}
        >
          <Menu size={20} />
        </button>
        <span>Workspace</span>
        <span>/</span>
        <strong>{title}</strong>
      </div>
      <div className="topbar-right">
        <span className="region">
          <Globe2 size={15} />
          Singapore
        </span>
        <span className="topbar-divider" />
        <span className="demo-pill">Demo mode</span>
        <Avatar small name={`${user.firstName} ${user.lastName}`} />
      </div>
    </header>
  );
}
