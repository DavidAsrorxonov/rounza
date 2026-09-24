import { Temporal } from "@js-temporal/polyfill";

export function validTimeZone(zone: string) {
  // Named IANA zones only; fixed offsets and POSIX time zones are not accepted.
  if (!/^[A-Za-z_]+(?:\/[A-Za-z0-9_+\-]+)*$/.test(zone)) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function scheduledInstant(
  local: string,
  zone: string,
  occurrence: string,
) {
  const wall = Temporal.PlainDateTime.from(local);
  const earlier = wall.toZonedDateTime(zone, { disambiguation: "earlier" });
  const later = wall.toZonedDateTime(zone, { disambiguation: "later" });
  if (
    !earlier.toPlainDateTime().equals(wall) ||
    !later.toPlainDateTime().equals(wall)
  )
    throw new Error(
      "This local time does not exist because the clocks change. Choose another time.",
    );
  if (
    earlier.epochNanoseconds !== later.epochNanoseconds &&
    occurrence === "reject"
  )
    throw new Error(
      "This time occurs twice when the clocks change. Choose the first or second occurrence.",
    );
  return (occurrence === "later" ? later : earlier).toInstant().toString();
}
export function localSchedule(instant: string | null, zone: string) {
  if (!instant) return { local: "", occurrence: "reject" };
  const zoned = Temporal.Instant.from(instant).toZonedDateTimeISO(zone);
  const wall = zoned.toPlainDateTime();
  const earlier = wall.toZonedDateTime(zone, { disambiguation: "earlier" });
  const later = wall.toZonedDateTime(zone, { disambiguation: "later" });
  return {
    local: wall.toString({ smallestUnit: "minute" }),
    occurrence:
      earlier.epochNanoseconds === later.epochNanoseconds
        ? "reject"
        : zoned.epochNanoseconds === earlier.epochNanoseconds
          ? "earlier"
          : "later",
  };
}
export function formatMeeting(instant: string, zone: string) {
  return (
    new Intl.DateTimeFormat("en", {
      timeZone: zone,
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(instant)) + ` · ${zone}`
  );
}
export function actionClock(zone: string, now = Temporal.Now.instant()) {
  const today = now.toZonedDateTimeISO(zone).toPlainDate();
  return {
    today: today.toString(),
    day_end: today
      .add({ days: 1 })
      .toZonedDateTime(zone)
      .toInstant()
      .toString(),
    at_time: now.toString(),
  };
}
