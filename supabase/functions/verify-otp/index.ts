import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const TEST_MODE = Deno.env.get("OTP_TEST_MODE") === "true" || !Deno.env.get("MSG91_AUTH_KEY");
const TEST_OTP = "123456";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, otp } = await req.json();

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      return jsonResponse({ error: "Valid phone number required" }, 400);
    }

    if (!otp || !/^\d{6}$/.test(otp)) {
      return jsonResponse({ error: "Valid 6-digit OTP required" }, 400);
    }

    if (TEST_MODE) {
      if (otp !== TEST_OTP) {
        return jsonResponse(
          { error: "OTP verification failed", details: "otp_not_verified" },
          401
        );
      }
    } else {
      const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
      if (!msg91AuthKey) {
        return jsonResponse({ error: "MSG91 not configured" }, 500);
      }

      const verifyUrl = new URL("https://control.msg91.com/api/v5/otp/verify");
      verifyUrl.searchParams.set("mobile", phone);
      verifyUrl.searchParams.set("otp", otp);

      const msg91Response = await fetch(verifyUrl.toString(), {
        method: "GET",
        headers: { authkey: msg91AuthKey },
      });

      const msg91Data = await msg91Response.json();

      if (msg91Data.type !== "success") {
        return jsonResponse(
          { error: "OTP verification failed", details: msg91Data.message },
          401
        );
      }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    await supabase
      .from("otp_sessions")
      .update({ verified: true })
      .eq("phone", phone)
      .eq("verified", false);

    const fallbackEmail = `${phone}@pratihari.local`;

    // Check for an existing sebayat row by phone (may have been pre-created by admin)
    const { data: existingSebayat } = await supabase
      .from("sebayats")
      .select("id, auth_user_id, profile_status")
      .eq("phone", phone)
      .maybeSingle();

    let isNewUser = false;
    // The email we'll use to generate the magic link session
    let sessionEmail = fallbackEmail;
    // Profile status to return to the client so it can seed state without a race condition
    let profileStatus: string | null = existingSebayat?.profile_status ?? null;
    let sebayatId: string | null = existingSebayat?.id ?? null;

    if (!existingSebayat) {
      // Brand new user — create auth account and sebayat row together
      isNewUser = true;

      const { data: newUser, error: createError } =
        await supabase.auth.admin.createUser({
          email: fallbackEmail,
          phone,
          email_confirm: true,
          phone_confirm: true,
          user_metadata: { phone },
        });

      if (createError) {
        return jsonResponse({ error: "Failed to create user account" }, 500);
      }

      // id = auth user id for self-registered users (backward compat)
      await supabase.from("sebayats").insert({
        id: newUser.user.id,
        auth_user_id: newUser.user.id,
        phone,
      });

      sebayatId = newUser.user.id;
      profileStatus = null;
      sessionEmail = fallbackEmail;
    } else if (!existingSebayat.auth_user_id) {
      // Admin pre-created profile exists but has no auth account yet — create one and link.
      // Only treat as "new user" (needs onboarding) if the profile has no substantive status.
      const existingStatus = existingSebayat.profile_status;
      isNewUser = !existingStatus || existingStatus === 'draft';

      // Check if an auth user with this fallback email already exists
      const { data: existingAuthList } = await supabase.auth.admin.listUsers();
      const existingAuthUser = existingAuthList?.users?.find(u => u.email === fallbackEmail);

      let authUserId: string;
      if (existingAuthUser) {
        authUserId = existingAuthUser.id;
        sessionEmail = existingAuthUser.email ?? fallbackEmail;
      } else {
        const { data: newUser, error: createError } =
          await supabase.auth.admin.createUser({
            email: fallbackEmail,
            phone,
            email_confirm: true,
            phone_confirm: true,
            user_metadata: { phone },
          });

        if (createError) {
          return jsonResponse({ error: "Failed to create user account" }, 500);
        }
        authUserId = newUser.user.id;
        sessionEmail = fallbackEmail;
      }

      // Link the auth account to the pre-created sebayat profile
      await supabase
        .from("sebayats")
        .update({ auth_user_id: authUserId })
        .eq("id", existingSebayat.id);
    } else {
      // Existing sebayat already linked to an auth account — look up that user's actual email
      // so we generate the magic link for the correct account (not a new one).
      const { data: authUser } = await supabase.auth.admin.getUserById(existingSebayat.auth_user_id);
      sessionEmail = authUser?.user?.email ?? fallbackEmail;
    }

    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: sessionEmail,
      });

    if (linkError || !linkData) {
      return jsonResponse({ error: "Failed to generate session link" }, 500);
    }

    const verifyResponse = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/auth/v1/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey:
            Deno.env.get("SUPABASE_ANON_KEY") ||
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        },
        body: JSON.stringify({
          type: "magiclink",
          token_hash: linkData.properties.hashed_token,
        }),
      }
    );

    const session = await verifyResponse.json();

    if (!verifyResponse.ok || !session.access_token) {
      return jsonResponse({ error: "Failed to create session" }, 500);
    }

    return jsonResponse({
      success: true,
      is_new_user: isNewUser,
      profile_status: profileStatus,
      sebayat_id: sebayatId,
      session: {
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_in: session.expires_in,
        user: session.user,
      },
    });
  } catch (_err) {
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
