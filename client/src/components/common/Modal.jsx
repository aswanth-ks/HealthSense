import { useEffect } from 'react';
import { X } from 'lucide-react';

export default function Modal({ open, onClose, eyebrow, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className={`card flex max-h-[92vh] w-full ${width} flex-col rounded-b-none sm:rounded-2xl`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            {eyebrow && <p className="eyebrow">{eyebrow}</p>}
            <h2 className="mt-1 text-lg font-medium">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-ink-soft hover:bg-canvas"><X size={18} /></button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}
