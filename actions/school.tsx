"use server";

import { revalidatePath } from "next/cache";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";

type CreateSchoolAccountInput = {
  schoolName: string;
  ownerEmail: string;
  ownerPassword: string;
  subscriptionPlan?: "trial" | "basic" | "pro" | "enterprise";
};

type CreateSchoolAccountResult =
  | {
      success: true;
      schoolId: string;
      ownerId: string;
      message: string;
    }
  | {
      success: false;
      message: string;
    };

export async function createSchoolWithOwner(
  input: CreateSchoolAccountInput,
): Promise<CreateSchoolAccountResult> {
  const schoolName = input.schoolName?.trim();
  const ownerEmail = input.ownerEmail?.trim().toLowerCase();
  const ownerPassword = input.ownerPassword?.trim();
  const subscriptionPlan = input.subscriptionPlan ?? "trial";

  if (!schoolName || schoolName.length < 2) {
    return {
      success: false,
      message: "اسم المدرسة مطلوب ويجب أن يكون حرفين على الأقل.",
    };
  }

  if (!ownerEmail || !ownerEmail.includes("@")) {
    return {
      success: false,
      message: "البريد الإلكتروني غير صالح.",
    };
  }

  if (!ownerPassword || ownerPassword.length < 6) {
    return {
      success: false,
      message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل.",
    };
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return {
      success: false,
      message:
        "إعدادات Supabase غير مكتملة. تأكد من NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY.",
    };
  }

  if (!serviceRoleKey.startsWith("sb_secret_")) {
    return {
      success: false,
      message:
        "قيمة SUPABASE_SERVICE_ROLE_KEY غير صحيحة. يجب أن تبدأ بـ sb_secret_.",
    };
  }

  const adminClient = createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: createdUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });

  if (createUserError || !createdUser.user) {
    return {
      success: false,
      message: createUserError?.message ?? "فشل إنشاء حساب مالك المدرسة.",
    };
  }

  const ownerId = createdUser.user.id;
  let schoolId: string | null = null;

  try {
    const { data: school, error: schoolError } = await adminClient
      .from("schools")
      .insert({
        name: schoolName,
        owner_id: ownerId,
        subscription_plan: subscriptionPlan,
      })
      .select("id")
      .single();

    if (schoolError || !school) {
      throw new Error(schoolError?.message ?? "فشل إنشاء المدرسة.");
    }

    schoolId = school.id;

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: ownerId,
      school_id: schoolId,
      role: "owner",
    });

    if (profileError) {
      throw new Error(profileError.message);
    }
  } catch (error) {
    await adminClient.auth.admin.deleteUser(ownerId);

    if (error instanceof Error && error.message.toLowerCase().includes("permission denied")) {
      return {
        success: false,
        message:
          "فشل بسبب صلاحيات قاعدة البيانات (permission denied). نفّذ أوامر GRANT في SQL Editor ثم أعد المحاولة.",
      };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "حدث خطأ غير متوقع.",
    };
  }

  revalidatePath("/protected/schools");

  return {
    success: true,
    schoolId: schoolId!,
    ownerId,
    message: "تم إنشاء المدرسة وحساب المالك بنجاح.",
  };
}
