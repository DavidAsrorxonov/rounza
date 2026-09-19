"use client";

import { useSyncExternalStore } from "react";
import {
  applicationSchema,
  dateKey,
  formatAppointment,
  demoDataSchema,
  type ApplicationStatus,
  type DemoApplication,
  type DemoData,
} from "./model";
import { createDemoData } from "./seed";

export const DEMO_STORAGE_KEY = "rounza.demo.v1";
type Snapshot = { data: DemoData; memoryOnly: boolean; notice: string };
let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

function persist(next: Snapshot) {
  try {
    window.sessionStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(next.data));
    next.memoryOnly = false;
  } catch {
    next.memoryOnly = true;
  }
  snapshot = next;
}

function getSnapshot(): Snapshot {
  if (snapshot) return snapshot;
  let data: DemoData | null = null;
  let notice = "";
  let memoryOnly = false;
  try {
    const raw = window.sessionStorage.getItem(DEMO_STORAGE_KEY);
    if (raw) {
      // Ignore oversized, old, or malformed data rather than breaking the demo.
      const parsed =
        raw.length <= 500_000
          ? demoDataSchema.safeParse(JSON.parse(raw))
          : null;
      if (parsed?.success) data = parsed.data;
      else
        notice =
          "The sample workspace was restored because its saved data could not be read.";
    }
  } catch {
    notice = "A fresh sample workspace is ready.";
    memoryOnly = true;
  }
  persist({ data: data ?? createDemoData(), memoryOnly, notice });
  return snapshot!;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const serverSnapshot = () => null;

export function useDemo() {
  return useSyncExternalStore(subscribe, getSnapshot, serverSnapshot);
}

function update(data: DemoData, notice: string) {
  persist({ data, notice, memoryOnly: false });
  listeners.forEach((listener) => listener());
}

function updateApplication(
  id: string,
  mutate: (application: DemoApplication) => DemoApplication,
  notice: string,
  event?: string,
) {
  const current = getSnapshot().data;
  update(
    {
      ...current,
      applications: current.applications.map((application) => {
        if (application.id !== id) return application;
        const changed = mutate(application);
        if (event)
          changed.history = [
            { id: crypto.randomUUID(), text: event, date: dateKey() },
            ...changed.history,
          ].slice(0, 30);
        return applicationSchema.parse(changed);
      }),
    },
    notice,
  );
}

export const demoActions = {
  dismissNotice() {
    snapshot = { ...getSnapshot(), notice: "" };
    listeners.forEach((listener) => listener());
  },
  reset() {
    update(
      createDemoData(),
      "Demo reset. The original sample applications are restored.",
    );
  },
  setStatus(id: string, status: ApplicationStatus) {
    updateApplication(
      id,
      (application) => ({ ...application, status }),
      `Application moved to ${status}.`,
      `Status changed to ${status}`,
    );
  },
  toggleTask(id: string, taskId: string) {
    updateApplication(
      id,
      (application) => ({
        ...application,
        tasks: application.tasks.map((task) =>
          task.id === taskId ? { ...task, done: !task.done } : task,
        ),
      }),
      "Checklist updated.",
    );
  },
  saveNotes(id: string, notes: string) {
    updateApplication(
      id,
      (application) => ({ ...application, notes }),
      "Notes saved in this demo tab.",
    );
  },
  reschedule(id: string, roundId: string, scheduledAt: string) {
    const round = getSnapshot()
      .data.applications.find((item) => item.id === id)
      ?.rounds.find((item) => item.id === roundId);
    const event = round?.scheduledAt
      ? `${round.title}: moved from ${formatAppointment(round.scheduledAt)} to ${formatAppointment(scheduledAt)}`
      : `${round?.title ?? "Round"} scheduled for ${formatAppointment(scheduledAt)}`;
    updateApplication(
      id,
      (application) => ({
        ...application,
        rounds: application.rounds.map((round) =>
          round.id === roundId
            ? { ...round, scheduledAt, state: "Scheduled" }
            : round,
        ),
      }),
      "Interview schedule updated.",
      event,
    );
  },
  completeRound(id: string, roundId: string) {
    updateApplication(
      id,
      (application) => ({
        ...application,
        rounds: application.rounds.map((round) =>
          round.id === roundId ? { ...round, state: "Completed" } : round,
        ),
      }),
      "Round marked complete. Your application status is unchanged.",
      "Hiring round completed",
    );
  },
  addApplication(input: {
    company: string;
    role: string;
    location: string;
    status: ApplicationStatus;
  }) {
    const data = getSnapshot().data;
    if (data.applications.length >= 100) return null;
    const application = applicationSchema.parse({
      ...input,
      id: crypto.randomUUID(),
      color: "blue",
      salary: "Not specified",
      addedOn: dateKey(),
      description: "Add your sample notes to explore this application.",
      notes: "",
      contact: null,
      rounds: [],
      tasks: [],
      history: [
        {
          id: crypto.randomUUID(),
          text: "Added to your applications",
          date: dateKey(),
        },
      ],
    });
    update(
      { ...data, applications: [application, ...data.applications] },
      `${application.company} added to the demo.`,
    );
    return application.id;
  },
};
