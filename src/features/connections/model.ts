import { z } from "zod";

export const accessModes = ["none", "selected", "all"] as const;
export const permissionsInput = z.object({
  application_access: z.enum(accessModes),
  application_ids: z.array(z.uuid()).max(500),
  resume_access: z.enum(accessModes),
  resume_ids: z.array(z.uuid()).max(500),
});
export type Permissions = z.infer<typeof permissionsInput>;
export type Connection = Permissions & {
  id: string;
  user_id: string;
  client_id: string;
  client_name: string;
  activated_at: string;
  revoked_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type ConnectionState = { message?: string };
export type RecordOption = { id: string; label: string };
export const authorizationId = z.uuid();
export const emptyPermissions: Permissions = {
  application_access: "selected",
  application_ids: [],
  resume_access: "none",
  resume_ids: [],
};
export function readPermissions(form: FormData) {
  return permissionsInput.safeParse({
    application_access: form.get("application_access"),
    application_ids: form.getAll("application_ids"),
    resume_access: form.get("resume_access"),
    resume_ids: form.getAll("resume_ids"),
  });
}
// Only this one internal route is supported as a post-login continuation.
export function consentDestination(id: unknown) {
  const parsed = authorizationId.safeParse(id);
  return parsed.success
    ? `/auth/consent?authorization_id=${parsed.data}`
    : null;
}
