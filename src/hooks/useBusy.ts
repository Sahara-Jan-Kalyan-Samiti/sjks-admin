import { useCallback, useState } from "react";

/**
 * Tracks whether an async action is running, so its button can be disabled meanwhile.
 *   const [busy, run] = useBusy();   <Button busy={busy} onClick={() => run(save)}>Save</Button>
 * Errors are rethrown to the caller (usually a try/catch that shows a toast).
 */
export function useBusy(): [boolean, <T>(fn: () => Promise<T>) => Promise<T>] {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async <T>(fn: () => Promise<T>): Promise<T> => {
    setBusy(true);
    try {
      return await fn();
    } finally {
      setBusy(false);
    }
  }, []);
  return [busy, run];
}
