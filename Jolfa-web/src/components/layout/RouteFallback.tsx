/**
 * Shown while a route's code chunk downloads. Deliberately quiet: on a fast
 * connection the chunk arrives in a few milliseconds, and a spinner that flashes
 * for one frame reads as jank. The delay animation holds it invisible briefly so
 * only genuinely slow loads ever show anything.
 */
export function RouteFallback() {
  return (
    <div
      className="flex min-h-[50svh] items-center justify-center motion-safe:animate-[fade-in_200ms_ease-out_150ms_both]"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">در حال بارگذاری…</span>
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-2 border-muted border-t-primary"
      />
    </div>
  )
}
