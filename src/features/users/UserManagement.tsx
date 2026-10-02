import { KeyRound, Pencil, Plus, Power, RotateCcw, Trash2 } from 'lucide-react';
import type { User } from '../../lib/types';
import { Avatar, Badge, SectionHead } from '../../components/ui';

export default function UserManagement({
  users,
  currentUser,
  onCreate,
  onEdit,
  onResetPassword,
  onToggle,
  onDelete,
  onResetDemo,
}: {
  users: User[];
  currentUser: User;
  onCreate: () => void;
  onEdit: (u: User) => void;
  onResetPassword: (u: User) => void;
  onToggle: (u: User) => void;
  onDelete: (u: User) => void;
  onResetDemo: () => void;
}) {
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">WORKSPACE ADMINISTRATION</div>
          <h1>User management</h1>
          <p>The right access for every member of your team.</p>
        </div>
        <button className="primary" onClick={onCreate}>
          <Plus size={17} />
          Create user
        </button>
      </div>

      <section className="panel">
        <SectionHead
          title="Your team"
          detail={`${users.length} users · ${users.filter((u) => u.active).length} active`}
        />
        <div className="table-scroll">
          <table className="stack-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const protectedUser = u.root || u.id === currentUser.id;

                return (
                  <tr key={u.id}>
                    <td className="cell-primary">
                      <div className="cell-flex">
                        <Avatar name={`${u.firstName} ${u.lastName}`} />
                        <div>
                          <strong>
                            {u.firstName} {u.lastName}
                            {u.root && <span className="root-label">ROOT</span>}
                          </strong>
                          <small>{u.email}</small>
                        </div>
                      </div>
                    </td>
                    <td data-label="Role">
                      <Badge>{u.role}</Badge>
                    </td>
                    <td data-label="Status">
                      <Badge>{u.active ? 'Active' : 'Disabled'}</Badge>
                    </td>
                    <td className="cell-wide">
                      <div className="actions">
                        <button
                          className="icon-button"
                          aria-label={`Edit ${u.firstName}`}
                          onClick={() => onEdit(u)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`Reset password for ${u.firstName}`}
                          disabled={!u.active}
                          onClick={() => onResetPassword(u)}
                        >
                          <KeyRound size={16} />
                        </button>
                        <button
                          className="icon-button"
                          aria-label={`${u.active ? 'Disable' : 'Enable'} ${u.firstName}`}
                          disabled={protectedUser}
                          onClick={() => onToggle(u)}
                        >
                          <Power size={16} />
                        </button>
                        <button
                          className="icon-button danger"
                          aria-label={`Delete ${u.firstName}`}
                          disabled={protectedUser}
                          onClick={() => onDelete(u)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="admin-reset">
        <div>
          <h3>Start fresh</h3>
          <p>Restore the original fictional data and sign out of this session.</p>
        </div>
        <button className="secondary" onClick={onResetDemo}>
          <RotateCcw size={16} />
          Reset demo data
        </button>
      </div>
    </>
  );
}
