import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router'
import { Button } from '@/components/ui/Button'

/**
 * Catches anything a route throws while rendering, including a chunk that fails
 * to download. Without it a single render error blanks the whole application,
 * which is exactly when the user most needs a way out.
 */
export function RouteError() {
  const error = useRouteError()
  const navigate = useNavigate()

  // A failed dynamic import means the user is on a stale build (we deployed
  // while their tab was open) or lost connectivity — reloading fixes both, so
  // it gets its own message rather than a generic apology.
  const isChunkError =
    error instanceof Error &&
    /Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message,
    )

  const status = isRouteErrorResponse(error) ? error.status : null

  const title = isChunkError
    ? 'نسخه جدیدی از سایت منتشر شده است'
    : status === 404
      ? 'صفحه مورد نظر پیدا نشد'
      : 'خطایی رخ داد'

  const description = isChunkError
    ? 'برای ادامه، صفحه را تازه‌سازی کنید.'
    : 'مشکلی در نمایش این صفحه پیش آمد. می‌توانید دوباره تلاش کنید یا به صفحه اصلی بازگردید.'

  return (
    <div
      role="alert"
      className="flex min-h-[60svh] flex-col items-center justify-center gap-4 px-6 text-center"
    >
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="max-w-md text-muted-foreground">{description}</p>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        {isChunkError ? (
          <Button onClick={() => window.location.reload()}>تازه‌سازی صفحه</Button>
        ) : (
          <Button onClick={() => navigate(0)}>تلاش دوباره</Button>
        )}
        <Button variant="outline" onClick={() => navigate('/')}>
          بازگشت به صفحه اصلی
        </Button>
      </div>

      {import.meta.env.DEV && error instanceof Error ? (
        <pre className="mt-4 max-w-full overflow-x-auto rounded-md bg-muted p-4 text-left text-xs">
          {error.stack ?? error.message}
        </pre>
      ) : null}
    </div>
  )
}
