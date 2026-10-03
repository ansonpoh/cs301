import {
  ArrowLeftRight,
  ArrowRight,
  CircleHelp,
  LayoutDashboard,
  LogOut,
  HeartHandshake,
  MessageSquareWarning,
  ScrollText,
  UserCog,
  Users,
  X,
} from 'lucide-react';
import type { User } from '../lib/types';
import { Avatar } from '../components/ui';
import Brand from '../components/Brand';

export default function Sidebar({
  user,
  admin,
  page,
  clientCount,
  caseCount,
  riskCount,
  open,
  onNavigate,
  onClose,
  onHelp,
  onSignOut,
}: {
  user: User;
  admin: boolean;
  page: string;
  clientCount: number;
  caseCount: number;
  riskCount: number;
  open: boolean;
  onNavigate: (page: string) => void;
  onClose: () => void;
  onHelp: () => void;
  onSignOut: () => void;
}) {
  const links = [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Clients', icon: Users },
    { label: 'Transactions', icon: ArrowLeftRight },
    { label: 'Cases', icon: MessageSquareWarning },
    { label: 'Retention', icon: HeartHandshake },
    ...(admin
      ? [
          { label: 'User management', icon: UserCog },
          { label: 'Audit log', icon: ScrollText },
        ]
      : []),
  ];

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Brand />
        <button className="mobile-close icon-button" aria-label="Close menu" onClick={onClose}>
          <X />
        </button>

        <div className="workspace-label">WORKSPACE</div>
        <nav>
          {links.map((l) => (
            <button
              key={l.label}
              className={page === l.label ? 'active' : ''}
              onClick={() => onNavigate(l.label)}
            >
              <l.icon size={19} />
              {l.label === 'Clients' && !admin ? 'My clients' : l.label}
              {l.label === 'Clients' && <span>{clientCount}</span>}
              {l.label === 'Cases' && caseCount > 0 && (
                <span className="nav-alert" title="Escalated cases">
                  {caseCount}
                </span>
              )}
              {l.label === 'Retention' && riskCount > 0 && (
                <span className="nav-alert" title="Clients at high attrition risk">
                  {riskCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="environment-card">
            <span>
              <i />
              DEMO ENVIRONMENT
            </span>
            <p>
              A space to explore.
              <br />
              No real banking activity.
            </p>
            <button onClick={onHelp}>
              Your demo guide
              <ArrowRight size={15} />
            </button>
          </div>
          <button className="sidebar-help" onClick={onHelp}>
            <CircleHelp size={18} />
            Help & walkthrough
          </button>
          <div className="sidebar-profile">
            <Avatar small name={`${user.firstName} ${user.lastName}`} />
            <span>
              <strong>
                {user.firstName} {user.lastName}
              </strong>
              <small>{admin ? 'Administrator' : 'Relationship agent'}</small>
            </span>
            <button aria-label="Sign out" title="Sign out / switch profile" onClick={onSignOut}>
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      {open && <button className="menu-overlay" aria-label="Close navigation" onClick={onClose} />}
    </>
  );
}
