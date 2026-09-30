import { CheckCircle2, X } from 'lucide-react';

export default function Toast({ message, onDismiss }: { message: string; onDismiss?: () => void }) {
  return (
    <div className="toast" role="status">
      <CheckCircle2 size={18} />
      {message}
      {onDismiss && (
        <button aria-label="Dismiss notification" onClick={onDismiss}>
          <X size={15} />
        </button>
      )}
    </div>
  );
}
