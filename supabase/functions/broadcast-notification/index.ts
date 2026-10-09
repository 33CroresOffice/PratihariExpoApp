import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const {
      title,
      message,
      channels = [],
      recipient_type = "all",
      recipient_ids = [],
      recipient_group = null,
      beddha_numbers = [],
    } = await req.json();

    if (!title || !message) {
      return json({ error: "title and message are required" }, 400);
    }
    if (!Array.isArray(channels) || channels.length === 0) {
      return json({ error: "At least one channel must be selected" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token) return json({ error: "Unauthorized" }, 401);

    const { data: userData } = await supabase.auth.getUser(token);
    const adminUserId = userData?.user?.id;
    if (!adminUserId) return json({ error: "Unauthorized" }, 401);

    const { data: admin } = await supabase
      .from("pratihari_admins")
      .select("user_id")
      .eq("user_id", adminUserId)
      .maybeSingle();
    if (!admin) return json({ error: "Admin access required" }, 403);

    // Load channel configs to check which are globally enabled
    const { data: channelRows } = await supabase
      .from("notification_channels")
      .select("channel, enabled");
    const channelEnabledMap: Record<string, boolean> = {};
    for (const ch of channelRows ?? []) {
      channelEnabledMap[ch.channel] = ch.enabled;
    }

    // Resolve recipients based on recipient_type
    let sebayatIds: string[] = [];

    if (recipient_type === "all") {
      const { data: all } = await supabase
        .from("sebayats")
        .select("id")
        .eq("profile_status", "approved")
        .eq("is_suspended", false);
      sebayatIds = (all ?? []).map((s: { id: string }) => s.id);
    } else if (recipient_type === "group" && recipient_group) {
      // Find sebayats in a specific group (pratihari or gochhikar)
      const { data: groups } = await supabase
        .from("seba_groups")
        .select("id")
        .eq("code", recipient_group);
      if (groups && groups.length > 0) {
        const groupId = groups[0].id;
        const { data: cats } = await supabase
          .from("seba_categories")
          .select("id")
          .eq("group_id", groupId);
        if (cats && cats.length > 0) {
          const catIds = cats.map((c: { id: string }) => c.id);
          // Get sebayats who have selections or nijog assignments in these categories
          const [{ data: sel }, { data: nijog }] = await Promise.all([
            supabase
              .from("sebayat_seba_selections")
              .select("sebayat_id")
              .in("seba_category_id", catIds),
            supabase
              .from("nijog_assignments")
              .select("sebayat_id")
              .in("seba_category_id", catIds),
          ]);
          const idSet = new Set<string>();
          for (const r of (sel ?? []) as Array<{ sebayat_id: string }>) idSet.add(r.sebayat_id);
          for (const r of (nijog ?? []) as Array<{ sebayat_id: string }>) idSet.add(r.sebayat_id);
          sebayatIds = Array.from(idSet);
        }
      }
    } else if (recipient_type === "individual" && Array.isArray(recipient_ids) && recipient_ids.length > 0) {
      sebayatIds = recipient_ids;
    } else if (recipient_type === "beddha" && Array.isArray(beddha_numbers) && beddha_numbers.length > 0) {
      // Find sebayats with specific beddha numbers today
      const today = new Date();
      const utcMs = today.getTime() + today.getTimezoneOffset() * 60000;
      const istMs = utcMs + 5.5 * 3600000;
      const d = new Date(istMs);
      const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

      const { data: roster } = await supabase
        .from("seba_roster")
        .select("sebayat_id, substitute_sebayat_id, is_absent, beddha_number, seba_schedule!inner(service_date)")
        .eq("seba_schedule.service_date", todayStr)
        .in("beddha_number", beddha_numbers);
      for (const r of (roster ?? []) as Array<{
        sebayat_id: string;
        substitute_sebayat_id: string | null;
        is_absent: boolean;
      }>) {
        const target = r.is_absent ? r.substitute_sebayat_id : r.sebayat_id;
        if (target) sebayatIds.push(target);
      }
    }

    if (sebayatIds.length === 0) {
      return json({ success: true, notified: 0, message: "No recipients found" });
    }

    // Deduplicate
    sebayatIds = [...new Set(sebayatIds)];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");

    const templateVars: Record<string, string> = { title, message };

    let notified = 0;
    const perChannelStats: Record<string, { sent: number; failed: number; skipped: number }> = {};
    for (const ch of channels) perChannelStats[ch] = { sent: 0, failed: 0, skipped: 0 };

    // Process each recipient
    for (const sid of sebayatIds) {
      // Fetch sebayat phone for SMS/WhatsApp
      let recipientPhone: string | null = null;
      if (channels.includes("sms") || channels.includes("whatsapp")) {
        const { data: sebayat } = await supabase
          .from("sebayats")
          .select("mobile_primary")
          .eq("id", sid)
          .maybeSingle();
        if (sebayat?.mobile_primary) {
          recipientPhone = sebayat.mobile_primary.replace(/\D/g, "");
        }
      }

      // ── In-App ────────────────────────────────────────────────────────────
      if (channels.includes("inapp") && channelEnabledMap["inapp"] !== false) {
        try {
          await supabase.from("sebayat_notifications").insert({
            sebayat_id: sid,
            event_key: "manual_broadcast",
            title,
            body: message,
            is_read: false,
          });
          perChannelStats.inapp.sent++;
        } catch {
          perChannelStats.inapp.failed++;
        }
      }

      // ── Push ──────────────────────────────────────────────────────────────
      if (channels.includes("push") && channelEnabledMap["push"]) {
        try {
          const { data: tokenRows } = await supabase
            .from("push_tokens")
            .select("token")
            .eq("sebayat_id", sid);
          if (tokenRows && tokenRows.length > 0) {
            const messages = tokenRows.map((row: { token: string }) => ({
              to: row.token,
              title,
              body: message,
              sound: "default",
              data: { event: "manual_broadcast" },
            }));
            await fetch("https://exp.host/--/api/v2/push/send", {
              method: "POST",
              headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
            });
            perChannelStats.push.sent++;
          } else {
            perChannelStats.push.skipped++;
          }
        } catch {
          perChannelStats.push.failed++;
        }
      }

      // ── SMS ───────────────────────────────────────────────────────────────
      if (channels.includes("sms") && channelEnabledMap["sms"] && recipientPhone) {
        try {
          if (msg91AuthKey) {
            await fetch("https://control.msg91.com/api/v5/flow/", {
              method: "POST",
              headers: { authkey: msg91AuthKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                template_id: Deno.env.get("MSG91_SMS_NOTIFICATION_TEMPLATE_ID") ?? Deno.env.get("MSG91_TEMPLATE_ID"),
                short_url: "0",
                recipients: [{ mobiles: recipientPhone, var1: message }],
              }),
            });
            perChannelStats.sms.sent++;
          } else {
            perChannelStats.sms.skipped++;
          }
        } catch {
          perChannelStats.sms.failed++;
        }
      }

      // ── WhatsApp ──────────────────────────────────────────────────────────
      if (channels.includes("whatsapp") && channelEnabledMap["whatsapp"] && recipientPhone) {
        try {
          if (msg91AuthKey) {
            await fetch("https://control.msg91.com/api/v5/flow/", {
              method: "POST",
              headers: { authkey: msg91AuthKey, "Content-Type": "application/json" },
              body: JSON.stringify({
                template_id: Deno.env.get("MSG91_WA_NOTIFICATION_TEMPLATE_ID") ?? Deno.env.get("MSG91_TEMPLATE_ID"),
                short_url: "0",
                recipients: [{ mobiles: recipientPhone, channel: "WHATSAPP", var1: message }],
              }),
            });
            perChannelStats.whatsapp.sent++;
          } else {
            perChannelStats.whatsapp.skipped++;
          }
        } catch {
          perChannelStats.whatsapp.failed++;
        }
      }

      // Log the broadcast
      for (const ch of channels) {
        const stat = perChannelStats[ch];
        const status = stat.sent > 0 ? "sent" : stat.failed > 0 ? "failed" : "skipped";
        await supabase.from("notification_log").insert({
          event_key: "manual_broadcast",
          channel: ch,
          recipient_type: "sebayat",
          recipient_sebayat_id: sid,
          recipient_phone: recipientPhone,
          status,
        });
      }

      notified++;
    }

    return json({
      success: true,
      total_recipients: sebayatIds.length,
      notified,
      per_channel: perChannelStats,
    });
  } catch (err) {
    return json({ error: "Internal error", details: String(err) }, 500);
  }
});
