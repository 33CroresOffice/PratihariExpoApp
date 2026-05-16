import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Use service role to manage auth users
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is a super admin
    const { data: callerAdmin } = await serviceClient
      .from("pratihari_admins")
      .select("is_super_admin")
      .eq("user_id", caller.id)
      .maybeSingle();
    if (!callerAdmin?.is_super_admin) {
      return new Response(JSON.stringify({ error: "Super admin privileges required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // ── CREATE: create or link an auth user and add as admin ─────────────────
    if (action === "create") {
      const { email, password, role_id, existing_account } = body;
      if (!email || !role_id) {
        return new Response(JSON.stringify({ error: "email and role_id are required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!password || password.length < 8) {
        return new Response(JSON.stringify({ error: "password (min 8 chars) is required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isSuper = (await serviceClient.from("admin_roles").select("role_name").eq("id", role_id).maybeSingle())
        ?.data?.role_name === "Super Admin";

      let authUserId: string;

      if (existing_account) {
        // Find existing auth user — phone-OTP users have a synthetic email like <phone>@pratihari.local
        // so we search by real email, synthetic email, and phone number
        const { phone: bodyPhone } = body;
        const { data: listData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        const normalizedPhone = bodyPhone ? String(bodyPhone).replace(/^\+/, "") : null;
        const syntheticEmail = normalizedPhone ? `${normalizedPhone}@pratihari.local` : null;
        const existingUser = listData?.users?.find(u =>
          u.email === email ||
          (syntheticEmail && u.email === syntheticEmail) ||
          (normalizedPhone && u.phone === normalizedPhone)
        );
        if (!existingUser) {
          return new Response(JSON.stringify({ error: "No auth account found for this email or phone number. Make sure the user has logged in to the app at least once." }), {
            status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        authUserId = existingUser.id;
        // Update their password so they can log in to the admin dashboard
        await serviceClient.auth.admin.updateUserById(authUserId, { email, email_confirm: true, password });
      } else {
        // Check email not already in use
        const { data: listData } = await serviceClient.auth.admin.listUsers({ perPage: 1000 });
        const emailTaken = listData?.users?.some(u => u.email === email);
        if (emailTaken) {
          return new Response(JSON.stringify({ error: "Email address is already in use by another account." }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Create new auth user
        const { data: newUser, error: createErr } = await serviceClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr || !newUser?.user) {
          return new Response(JSON.stringify({ error: createErr?.message || "Failed to create user" }), {
            status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        authUserId = newUser.user.id;
      }

      // Insert pratihari_admins row
      const { data: newAdmin, error: insertErr } = await serviceClient.from("pratihari_admins").insert({
        user_id: authUserId,
        role_id,
        is_super_admin: isSuper,
        added_by: caller.id,
      }).select("id").maybeSingle();
      if (insertErr) {
        // Only rollback (delete user) if we created a brand-new account
        if (!existing_account) await serviceClient.auth.admin.deleteUser(authUserId);
        return new Response(JSON.stringify({ error: insertErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Save per-user permission overrides if provided
      const permission_overrides = body.permission_overrides;
      if (newAdmin?.id && Array.isArray(permission_overrides) && permission_overrides.length > 0) {
        const rows = permission_overrides
          .filter((o: { resource: string; action: string; granted: boolean }) =>
            o.resource && o.action && typeof o.granted === "boolean"
          )
          .map((o: { resource: string; action: string; granted: boolean }) => ({
            admin_id: newAdmin.id,
            resource: o.resource,
            action: o.action,
            granted: o.granted,
          }));
        if (rows.length > 0) {
          await serviceClient.from("admin_user_permissions").upsert(rows, {
            onConflict: "admin_id,resource,action",
          });
        }
      }

      return new Response(JSON.stringify({ success: true, user_id: authUserId }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── DISABLE / ENABLE ─────────────────────────────────────────────────────
    if (action === "set_disabled") {
      const { admin_id, disabled } = body;
      if (!admin_id || typeof disabled !== "boolean") {
        return new Response(JSON.stringify({ error: "admin_id and disabled required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: targetAdmin } = await serviceClient
        .from("pratihari_admins").select("user_id").eq("id", admin_id).maybeSingle();
      if (!targetAdmin) {
        return new Response(JSON.stringify({ error: "Admin not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Update auth user ban status
      await serviceClient.auth.admin.updateUserById(targetAdmin.user_id, {
        ban_duration: disabled ? "876600h" : "none",
      });
      // Update our flag
      await serviceClient.from("pratihari_admins").update({ is_disabled: disabled }).eq("id", admin_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── RESET PASSWORD ───────────────────────────────────────────────────────
    if (action === "reset_password") {
      const { admin_id, new_password } = body;
      if (!admin_id || !new_password || new_password.length < 8) {
        return new Response(JSON.stringify({ error: "admin_id and new_password (min 8 chars) required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: targetAdmin } = await serviceClient
        .from("pratihari_admins").select("user_id").eq("id", admin_id).maybeSingle();
      if (!targetAdmin) {
        return new Response(JSON.stringify({ error: "Admin not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error: pwErr } = await serviceClient.auth.admin.updateUserById(targetAdmin.user_id, {
        password: new_password,
      });
      if (pwErr) {
        return new Response(JSON.stringify({ error: pwErr.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
