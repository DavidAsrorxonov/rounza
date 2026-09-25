import type {
  VaultRecord,
  PortalRecord,
  PortalLink,
} from "@/features/vault/model";
// Schema contract for the migrations in supabase/migrations. Update with every migration.
// Once linked, Supabase CLI can regenerate this file (see docs/accounts-setup.md).
type Profile = {
  id: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
};
type Application = {
  revision: number;
  id: string;
  user_id: string;
  company: string;
  role: string;
  status: Database["public"]["Enums"]["application_status"];
  location: string;
  job_url: string | null;
  description: string;
  notes: string;
  applied_on: string | null;
  created_at: string;
  updated_at: string;
};

type JourneyRecord = {
  id: string;
  user_id: string;
  application_id: string;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type HiringRound = JourneyRecord & {
  title: string;
  kind: "Interview" | "Assessment" | "Other";
  status: "Planned" | "Scheduled" | "Completed" | "Cancelled";
  position: number;
  scheduled_at: string | null;
  time_zone: string;
  duration_minutes: number;
  due_on: string | null;
  meeting_url: string | null;
  location: string;
  people: string;
  notes: string;
  schedule_note: string;
};
export type PreparationTask = JourneyRecord & {
  title: string;
  round_id: string | null;
  due_on: string | null;
  completed: boolean;
  notes: string;
};
export type ApplicationContact = JourneyRecord & {
  name: string;
  role: string;
  email: string;
  phone: string;
  notes: string;
};
export type ScheduleHistory = {
  id: string;
  user_id: string;
  application_id: string;
  round_id: string;
  previous_at: string | null;
  scheduled_at: string | null;
  previous_due_on: string | null;
  due_on: string | null;
  previous_time_zone: string | null;
  time_zone: string;
  previous_status: string | null;
  status: string;
  previous_duration_minutes: number | null;
  duration_minutes: number;
  note: string;
  created_at: string;
};
export type NextAction = {
  id: string;
  user_id: string;
  application_id: string;
  record_id: string;
  source: "task" | "meeting" | "deadline" | "round";
  company: string;
  role: string;
  title: string;
  due_at: string | null;
  due_on: string | null;
  time_zone: string;
  bucket: number;
  sort_at: string;
};
type JourneyTable<T extends JourneyRecord, K extends keyof T> = {
  Row: T;
  Insert: Pick<T, K | "application_id"> & Partial<T>;
  Update: Partial<T>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      credential_vaults: {
        Row: VaultRecord;
        Insert: Omit<VaultRecord, "revision" | "created_at" | "updated_at">;
        Update: Partial<VaultRecord>;
        Relationships: [];
      };
      portal_accounts: {
        Row: PortalRecord;
        Insert: Omit<PortalRecord, "revision" | "created_at" | "updated_at">;
        Update: Partial<PortalRecord>;
        Relationships: [];
      };
      application_portals: {
        Row: PortalLink;
        Insert: Omit<PortalLink, "created_at">;
        Update: never;
        Relationships: [];
      };
      hiring_rounds: JourneyTable<HiringRound, "title">;
      preparation_tasks: JourneyTable<PreparationTask, "title">;
      application_contacts: JourneyTable<ApplicationContact, "name">;
      round_schedule_history: {
        Row: ScheduleHistory;
        Insert: never;
        Update: never;
        Relationships: [];
      };
      profiles: {
        Row: Profile;
        Insert: Pick<Profile, "id"> & Partial<Omit<Profile, "id">>;
        Update: Partial<Profile>;
        Relationships: [];
      };
      applications: {
        Row: Application;
        Insert: Pick<Application, "company" | "role"> &
          Partial<Omit<Application, "company" | "role">>;
        Update: Partial<Application>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      create_portal_account: {
        Args: {
          p_id: string;
          p_vault_id: string;
          p_nonce: string;
          p_ciphertext: string;
          p_application_id?: string | null;
        };
        Returns: string;
      };
      list_portal_accounts: {
        Args: { p_application_id?: string | null };
        Returns: PortalRecord[];
      };
      next_actions: {
        Args: { today: string; day_end: string; at_time: string };
        Returns: NextAction[];
      };
      search_applications: {
        Args: {
          search_term?: string;
          status_filter?:
            Database["public"]["Enums"]["application_status"] | null;
        };
        Returns: Application[];
      };
    };
    Enums: {
      application_status:
        | "Saved"
        | "Applied"
        | "Interviewing"
        | "Offer"
        | "Rejected"
        | "Withdrawn";
    };
    CompositeTypes: { [_ in never]: never };
  };
};
