import { useState } from 'react';
import type { AuditEvent, User } from '../../lib/types';
import { SearchBox, Empty, SectionHead, Truncated, usePaged } from '../../components/ui';
import { auditColumns } from '../../lib/audit';

export default function Audit({ events, users }: { events: AuditEvent[]; users: User[] }) {
  const [q, setQ] = useState('');
  const [actor, setActor] = useState('All users');

  const rows = events
    .map((e) => ({ e, cols: auditColumns(e) }))
    .filter(
      ({ e, cols }) =>
        (actor === 'All users' || e.actorId === actor) &&
        `${cols.crud} ${e.action} ${e.entityId} ${e.actorId} ${e.clientId ?? ''} ${cols.attribute}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    );
  const { rows: pageRows, pager } = usePaged(rows);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">GOVERNANCE</div>
          <h1>Audit log</h1>
          <p>Every action, accounted for.</p>
        </div>
        <span className="outline-chip">Administrator access</span>
      </div>
      <section className="panel">
        <SectionHead
          title="Activity trail"
          detail="Appendix 2 format · PII values are partially masked"
        />
        <div className="filters">
          <SearchBox
            value={q}
            onChange={setQ}
            placeholder="Search action, CRUD, attribute, or ID…"
          />
          <select
            value={actor}
            aria-label="Filter audit by user"
            onChange={(e) => setActor(e.target.value)}
          >
            <option>All users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.firstName} {u.lastName}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>DateTime (ISO 8601)</th>
                  <th>CRUD</th>
                  <th>Action</th>
                  <th>Attribute name</th>
                  <th>Before value</th>
                  <th>After value</th>
                  <th>Agent ID</th>
                  <th>Client ID</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(({ e, cols }) => {
                  const u = users.find((u) => u.id === e.actorId);
                  return (
                    <tr key={e.id}>
                      <td className="audit-mono">{e.at}</td>
                      <td>
                        <span className={`crud-tag ${cols.crud.toLowerCase()}`}>{cols.crud}</span>
                      </td>
                      <td className="audit-details">
                        <strong>{e.action}</strong>
                        <small>
                          <Truncated text={e.detail ?? e.entityId} />
                        </small>
                      </td>
                      <td className="audit-mono">{cols.attribute}</td>
                      <td className="audit-mono">{cols.before || '—'}</td>
                      <td className="audit-mono">{cols.after || '—'}</td>
                      <td>
                        <span className="audit-mono">{e.actorId}</span>
                        {u && (
                          <small>
                            {u.firstName} {u.lastName}
                          </small>
                        )}
                      </td>
                      <td className="audit-mono">{e.clientId ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {pager}
          </div>
        ) : (
          <Empty />
        )}
      </section>
      <p className="footnote">
        Local demonstration only. Production audit integrity and access enforcement require a
        backend.
      </p>
    </>
  );
}
