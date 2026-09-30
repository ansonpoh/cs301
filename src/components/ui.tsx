import { useEffect, useRef, useId, useState, type ReactNode } from 'react';
import { X, Search, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react';

export const money = (v: number) =>
  new Intl.NumberFormat('en-SG', {
    style: 'currency',
    currency: 'SGD',
    maximumFractionDigits: 2,
  }).format(v);
export const date = (v: string) =>
  new Date(v).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });
export const datetime = (v: string) =>
  new Date(v).toLocaleString('en-SG', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className={`badge ${String(children).toLowerCase().replaceAll(' ', '-')}`}>
      {children}
    </span>
  );
}

export function Avatar({ name, small = false }: { name: string; small?: boolean }) {
  return (
    <span className={`avatar ${small ? 'small' : ''} tone-${name.charCodeAt(0) % 4}`}>
      {name
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')}
    </span>
  );
}

export function Empty({
  title = 'No records found',
  text = 'Try a different search or filter.',
}: {
  title?: string;
  text?: string;
}) {
  return (
    <div className="empty">
      <Search size={26} />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder = 'Search...',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="search">
      <Search size={17} />
      <input
        aria-label={placeholder}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

export function SectionHead({
  title,
  detail,
  action,
  onAction,
}: {
  title: string;
  detail?: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action && (
        <button className="text-button" onClick={onAction}>
          {action}
          <ArrowUpRight size={16} />
        </button>
      )}
    </div>
  );
}

export function Modal({
  title,
  subtitle,
  children,
  onClose,
  guardChanges = false,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  guardChanges?: boolean;
}) {
  const titleId = useId();

  const ref = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const el = ref.current!;
    el.showModal();
    return () => {
      el.close();
      previous?.focus();
    };
  }, []);
  // Forms with typed changes ask before closing so a multi-step entry is not lost by accident.
  const requestClose = () => {
    if (guardChanges && dirty) setConfirming(true);
    else onClose();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onInput={() => setDirty(true)}
      onChange={() => setDirty(true)}
      onCancel={(e) => {
        e.preventDefault();
        if (confirming) setConfirming(false);
        else requestClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) requestClose();
      }}
    >
      <div className="modal-head">
        <div>
          <h2 id={titleId}>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <button aria-label="Close dialog" className="icon-button" onClick={requestClose}>
          <X size={20} />
        </button>
      </div>
      {confirming && (
        <div className="discard-prompt" role="alertdialog" aria-label="Discard changes?">
          <p>
            <strong>Discard your changes?</strong>
            <span>The information you entered will not be saved.</span>
          </p>
          <div className="actions">
            <button className="secondary" autoFocus onClick={() => setConfirming(false)}>
              Keep editing
            </button>
            <button className="danger-solid" onClick={onClose}>
              Discard
            </button>
          </div>
        </div>
      )}
      {children}
    </dialog>
  );
}

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className={`field ${error ? 'invalid' : ''}`}>
      <span>{label}</span>
      {children}
      {error && <small role="alert">{error}</small>}
    </label>
  );
}

export const PAGE_SIZE = 20;
// Client-side paging for the demo; a backend would page on the server.
export function usePaged<T>(rows: T[], size = PAGE_SIZE) {
  const [page, setPage] = useState(0);

  const pages = Math.max(1, Math.ceil(rows.length / size));
  const current = Math.min(page, pages - 1);

  useEffect(() => setPage(0), [rows.length]);

  return {
    rows: rows.slice(current * size, (current + 1) * size),
    pager: <Pager page={current} pages={pages} total={rows.length} size={size} onPage={setPage} />,
  };
}

export function Pager({
  page,
  pages,
  total,
  size,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  size: number;
  onPage: (p: number) => void;
}) {
  if (pages <= 1) return null;

  return (
    <nav className="pager" aria-label="Pagination">
      <span>
        {page * size + 1}–{Math.min(total, (page + 1) * size)} of {total}
      </span>
      <div className="actions">
        <button
          className="icon-button"
          aria-label="Previous page"
          disabled={page === 0}
          onClick={() => onPage(page - 1)}
        >
          <ChevronLeft size={17} />
        </button>
        <span aria-current="page">
          Page {page + 1} of {pages}
        </span>
        <button
          className="icon-button"
          aria-label="Next page"
          disabled={page >= pages - 1}
          onClick={() => onPage(page + 1)}
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </nav>
  );
}

export function Truncated({ text, limit = 90 }: { text: string; limit?: number }) {
  const [open, setOpen] = useState(false);
  if (text.length <= limit) return <>{text}</>;

  return (
    <>
      {open ? text : `${text.slice(0, limit).trimEnd()}…`}{' '}
      <button className="inline-link" onClick={() => setOpen(!open)}>
        {open ? 'Less' : 'More'}
      </button>
    </>
  );
}
