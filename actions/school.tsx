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

  let ownerId: string | null = null;
  let createdNewAuthUser = false;

  const { data: createdUser, error: createUserError } =
    await adminClient.auth.admin.createUser({
      email: ownerEmail,
      password: ownerPassword,
      email_confirm: true,
    });

  if (createUserError || !createdUser.user) {
    const alreadyRegistered = createUserError?.message
      ?.toLowerCase()
      .includes("already been registered");

    if (!alreadyRegistered) {
      return {
        success: false,
        message: createUserError?.message ?? "فشل إنشاء حساب مالك المدرسة.",
      };
    }

    const { data: existingUser, error: existingUserError } = await adminClient
      .from("users")
      .select("id")
      .eq("email", ownerEmail)
      .maybeSingle();

    if (existingUserError || !existingUser?.id) {
      return {
        success: false,
        message:
          "هذا البريد مسجل مسبقا، لكن لم يتم العثور عليه في جدول users. تأكد من تطابق users.id مع auth.users.id.",
      };
    }

    ownerId = existingUser.id as string;
  } else {
    ownerId = createdUser.user.id;
    createdNewAuthUser = true;
  }

  if (!ownerId) {
    return {
      success: false,
      message: "تعذر تحديد هوية مالك المدرسة.",
    };
  }
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

    // البيئة الحالية تعتمد public.users كمصدر أساسي لربط المستخدم بالمدرسة.
    const { error: legacyUserError } = await adminClient.from("users").upsert(
      {
        id: ownerId,
        email: ownerEmail,
        school_id: schoolId,
        role: "staff",
      },
      { onConflict: "id" },
    );

    const upsertConflictUnsupported =
      !!legacyUserError &&
      legacyUserError.message
        .toLowerCase()
        .includes("there is no unique or exclusion constraint matching the on conflict specification");

    if (upsertConflictUnsupported) {
      const { error: updateByIdError } = await adminClient
        .from("users")
        .update({
          school_id: schoolId,
          role: "staff",
        })
        .eq("id", ownerId);

      if (updateByIdError) {
        throw new Error(updateByIdError.message);
      }

      const { error: updateByEmailError } = await adminClient
        .from("users")
        .update({
          school_id: schoolId,
          role: "staff",
        })
        .eq("email", ownerEmail);

      if (updateByEmailError) {
        throw new Error(updateByEmailError.message);
      }
    } else if (legacyUserError) {
      throw new Error(legacyUserError.message);
    }

    const { data: ownerUserRow, error: ownerUserLookupError } = await adminClient
      .from("users")
      .select("school_id")
      .eq("id", ownerId)
      .maybeSingle();

    if (ownerUserLookupError) {
      throw new Error(ownerUserLookupError.message);
    }

    if (!ownerUserRow?.school_id || ownerUserRow.school_id !== schoolId) {
      throw new Error("فشل ربط المستخدم بالمدرسة في جدول users (school_id).");
    }
  } catch (error) {
    if (createdNewAuthUser) {
      await adminClient.auth.admin.deleteUser(ownerId);
    }

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

  revalidatePath("/admin/schools");

  return {
    success: true,
    schoolId: schoolId!,
    ownerId,
    message: "تم إنشاء المدرسة وحساب المالك بنجاح.",
  };
}
