import type { SupabaseClient } from "@supabase/supabase-js";

export type AppUserRole = "owner" | "staff";

function normalizeRole(value: unknown): AppUserRole | null {
  if (value === "owner" || value === "staff") return value;
  if (typeof value === "string") {
    const v = value.toLowerCase().trim();
    if (v === "owner" || v === "admin") return "owner";
    if (v === "staff" || v === "teacher" || v === "employee") return "staff";
  }
  return null;
}

type LegacyUserRow = Record<string, unknown> & {
  role?: unknown;
  type?: unknown;
  user_role?: unknown;
  userRole?: unknown;
};

/**
 * المصدر الرسمي للدور هو `public.users.role`.
 * نحافظ على fallback اختياري لـ `public.profiles.role` للتوافق مع بيئات أقدم فقط.
 */
export async function resolveAppRole(
  supabase: SupabaseClient,
  userId: string,
  userEmail?: string | null,
): Promise<AppUserRole | null> {
  const { data: userById, error: byIdError } = await supabase
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!byIdError) {
    const row = userById as LegacyUserRow | null;
    const byIdRole =
      normalizeRole(row?.role) ??
      normalizeRole(row?.type) ??
      normalizeRole(row?.user_role) ??
      normalizeRole(row?.userRole) ??
      null;

    if (byIdRole) return byIdRole;
  }

  if (!userEmail) return null;

  const normalizedEmail = userEmail.trim().toLowerCase();
  if (!normalizedEmail) return null;

  const { data: userByEmail, error: byEmailError } = await supabase
    .from("users")
    .select("*")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (!byEmailError) {
    const emailRow = userByEmail as LegacyUserRow | null;
    const roleByEmail =
      normalizeRole(emailRow?.role) ??
      normalizeRole(emailRow?.type) ??
      normalizeRole(emailRow?.user_role) ??
      normalizeRole(emailRow?.userRole) ??
      null;

    if (roleByEmail) return roleByEmail;
  }

  // توافق اختياري مع بيئات تستخدم profiles.
  const { data: profileById, error: profileByIdError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profileByIdError) return null;

  return normalizeRole(profileById?.role);
}
