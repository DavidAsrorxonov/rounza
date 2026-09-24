import type {
  HiringRound,
  PreparationTask,
  ApplicationContact,
} from "@/lib/supabase/database.types";
import { kinds, roundStatuses, type JourneyType } from "./model";
import { localSchedule } from "./time";
export type Field = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  maxLength?: number;
  min?: number | string;
  max?: number | string;
  options?: readonly string[];
  help?: string;
  wide?: boolean;
};
export const fields: Record<JourneyType, Field[]> = {
  round: [
    {
      name: "title",
      label: "Round title",
      required: true,
      maxLength: 200,
      help: "Use any name. Repeated rounds are welcome.",
    },
    { name: "kind", label: "Round type", options: kinds },
    { name: "status", label: "Round status", options: roundStatuses },
    {
      name: "position",
      label: "Journey order",
      type: "number",
      required: true,
      min: 1,
      max: 999,
      help: "Lower numbers appear first. Ties stay in the order they were added.",
    },
    {
      name: "scheduled_local",
      label: "Meeting date and time",
      type: "datetime-local",
      min: "0001-01-01T00:00",
      max: "9999-12-31T23:59",
    },
    {
      name: "time_zone",
      label: "Meeting time zone",
      required: true,
      maxLength: 100,
      help: "IANA name, for example Asia/Tokyo, Europe/London or America/New_York.",
    },
    {
      name: "duration_minutes",
      label: "Duration in minutes",
      type: "number",
      required: true,
      min: 5,
      max: 1440,
    },
    {
      name: "occurrence",
      label: "Clock-change occurrence",
      options: ["reject", "earlier", "later"],
      help: "Only needed if a local time happens twice when clocks go back. Earlier is the first occurrence; later is the second.",
    },
    {
      name: "due_on",
      label: "Assessment or round deadline",
      type: "date",
      min: "0001-01-01",
      max: "9999-12-31",
      help: "Optional date-only deadline. It stays on this calendar date in every time zone.",
    },
    {
      name: "meeting_url",
      label: "Meeting link",
      type: "url",
      maxLength: 2048,
    },
    { name: "location", label: "Meeting location", maxLength: 300 },
    { name: "people", label: "People attending", maxLength: 500 },
    {
      name: "notes",
      label: "Round notes",
      type: "textarea",
      maxLength: 20000,
      wide: true,
    },
    {
      name: "schedule_note",
      label: "Reason for schedule or status change",
      type: "textarea",
      maxLength: 1000,
      wide: true,
      help: "Optional. Saved in history when the time, time zone, duration, deadline or status changes.",
    },
  ],
  task: [
    { name: "title", label: "Task title", required: true, maxLength: 200 },
    {
      name: "due_on",
      label: "Task due date",
      type: "date",
      min: "0001-01-01",
      max: "9999-12-31",
    },
    { name: "completed", label: "Task status", options: ["false", "true"] },
    {
      name: "notes",
      label: "Task notes",
      type: "textarea",
      maxLength: 10000,
      wide: true,
    },
  ],
  contact: [
    { name: "name", label: "Contact name", required: true, maxLength: 160 },
    { name: "role", label: "Contact role", maxLength: 200 },
    { name: "email", label: "Email address", type: "email", maxLength: 254 },
    { name: "phone", label: "Phone number", type: "tel", maxLength: 80 },
    {
      name: "notes",
      label: "Contact notes",
      type: "textarea",
      maxLength: 5000,
      wide: true,
    },
  ],
};
export type JourneyRecord = HiringRound | PreparationTask | ApplicationContact;
export function initialValues(type: JourneyType, record?: JourneyRecord) {
  const defaults: Record<string, string> = {
    kind: "Interview",
    status: "Planned",
    position: "1",
    time_zone: "UTC",
    duration_minutes: "60",
    occurrence: "reject",
    completed: "false",
  };
  const saved = (record ?? {}) as Record<string, unknown>;
  const result = Object.fromEntries(
    fields[type].map((field) => [
      field.name,
      saved[field.name] == null
        ? (defaults[field.name] ?? "")
        : String(saved[field.name]),
    ]),
  );
  if (type === "round" && record) {
    const round = record as HiringRound;
    const schedule = localSchedule(round.scheduled_at, round.time_zone);
    result.scheduled_local = schedule.local;
    result.occurrence = schedule.occurrence;
    result.schedule_note = "";
  }
  return result;
}
