export type ChairTime = {
  /** Seconds since the client sat down. */
  elapsed: number;
  /** Booked service length in seconds. */
  planned: number;
  /** 0–1 of the booked length, capped at 1. */
  progress: number;
  /** Seconds past the booked length, 0 if on time. */
  over: number;
};

/**
 * How long a checked-in client has been in the chair, measured against the
 * booked service length (ends_at - starts_at). Falls back to the booking
 * start if the check-in time wasn't recorded.
 */
export function chairTime(
  appt: { checkedInAt: string | null; startsAt: string; endsAt: string },
  now: number,
): ChairTime {
  const start = new Date(appt.checkedInAt ?? appt.startsAt).getTime();
  const planned = Math.max(
    60,
    (new Date(appt.endsAt).getTime() - new Date(appt.startsAt).getTime()) / 1000,
  );
  const elapsed = Math.max(0, Math.floor((now - start) / 1000));
  return {
    elapsed,
    planned,
    progress: Math.min(1, elapsed / planned),
    over: Math.max(0, Math.floor(elapsed - planned)),
  };
}

/** 754 → "12:34"; 3754 → "1:02:34". */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}
