import { useEffect, useState } from "react";

// Returns the current time in ms, refreshed periodically so time-based UI (e.g. "upcoming" filters) stays live.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
