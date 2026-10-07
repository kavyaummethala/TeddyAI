// Sends browser errors to the backend so they show up in the `npm run dev` terminal.
// Bugs that only happen with a real mic and speakers are otherwise invisible.

export function reportClientError(where: string, error: unknown) {
  const err = error instanceof Error ? error : new Error(String(error));
  const body = JSON.stringify({ where, message: err.message, stack: err.stack?.split("\n").slice(0, 6).join("\n") });
  // keepalive lets the report finish even if the page is closing.
  fetch("/api/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(
    () => {}, // reporting must never cause another error
  );
}

export function installGlobalErrorReporting() {
  window.addEventListener("error", (e) => reportClientError("window", e.error ?? e.message));
  window.addEventListener("unhandledrejection", (e) => reportClientError("promise", e.reason));
}
