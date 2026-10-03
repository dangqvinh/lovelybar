import { useEffect, type ReactNode } from "react";

interface Props {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  busy,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCancel();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dlg-title"
        className="card w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dlg-title" className="text-lg font-bold">
          {title}
        </h2>
        {children && (
          <div className="mt-2 text-sm text-ink-soft">{children}</div>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline" onClick={onCancel} disabled={busy}>
            Hủy
          </button>
          <button
            className={
              danger
                ? "btn bg-red-600 text-white hover:bg-red-700"
                : "btn-primary"
            }
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? "Đang xử lý…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
