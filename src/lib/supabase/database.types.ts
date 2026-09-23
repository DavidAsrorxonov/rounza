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

export type Database = {
  public: {
    Tables: {
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
