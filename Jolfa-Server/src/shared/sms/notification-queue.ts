/**
 * Notification work that nobody waits for.
 *
 * Its own module, with no static imports, and that is the whole point: the test
 * suite imports `flushNotifications` from here in its setup file, and anything
 * this module pulled in would be instantiated before a test file could mock it.
 * Importing the logger alone would be enough — it reads the validated `env`,
 * which the SMS tests replace — so the logger is loaded on the error path only.
 */

const inFlight = new Set<Promise<void>>();

/**
 * Starts notification work and returns immediately.
 *
 * The callers that use this are requests the customer is waiting on — placing
 * an order, returning from the payment gateway, registering. SMS.ir is allowed
 * 15 seconds before the client gives up, and awaiting that would add it to the
 * response: a slow provider would make checkout look broken, and a payment
 * callback could time out at the gateway's end with the order left in limbo.
 *
 * Nothing is lost by not waiting. Every outcome is written to the SMS log by
 * `notify`, which is where failures are read. The rejection handler matters
 * because the work usually includes a database lookup, which `notify` itself
 * does not guard — without it a missing row becomes an unhandled rejection that
 * takes the process down after a purchase has already succeeded.
 *
 * The returned promise exists so tests can await the work; production callers
 * ignore it deliberately.
 */
export function queueNotification(work: Promise<unknown>): Promise<void> {
  const tracked = work
    .then(
      () => undefined,
      async (error: unknown) => {
        const { logger } = await import("../logger.js");
        logger.error({ err: error }, "notification failed outside the request");
      },
    )
    .finally(() => {
      inFlight.delete(tracked);
    });

  inFlight.add(tracked);
  return tracked;
}

/**
 * Waits for the queued notifications to finish.
 *
 * Only the test suite needs this, and it needs it for a real reason: work that
 * nobody awaits keeps running after the request that started it, so a
 * notification's database writes could land after a test had truncated the
 * tables and surface inside the next test. Awaited between tests, the
 * background path stays non-blocking in production and deterministic here.
 */
export async function flushNotifications(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.all([...inFlight]);
  }
}
