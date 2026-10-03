import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-ink-soft" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-pink-200 border-t-pink-500" />
      <span className="text-sm">{label}…</span>
    </div>
  )
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card animate-pulse overflow-hidden">
          <div className="aspect-square bg-pink-50" />
          <div className="space-y-2 p-4">
            <div className="h-4 w-2/3 rounded-full bg-pink-100" />
            <div className="h-3 w-full rounded-full bg-pink-50" />
            <div className="h-8 w-full rounded-full bg-pink-50" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center px-6 py-12 text-center">
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-pink-100 text-2xl text-pink-500">♡</div>
      <h2 className="text-lg font-bold">{title}</h2>
      {text && <p className="mt-1 text-sm text-ink-soft">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="card mx-auto flex max-w-md flex-col items-center border-red-100 px-6 py-10 text-center" role="alert">
      <h2 className="text-lg font-bold">Could not load this page</h2>
      <p className="mt-1 text-sm text-ink-soft">{message}</p>
      {onRetry && (
        <button className="btn-primary mt-5" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  )
}
