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

function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Load config
    const { data: config } = await supabase
      .from("seba_notification_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!config) {
      return json({ error: "Notification config not initialized" }, 500);
    }

    // Feature switch
    if (!config.niti_tracker_integration_enabled) {
      await supabase.from("niti_tracker_events").insert({
        status: "skipped_disabled",
        error_message: "Integration disabled",
      });
      return json({ success: true, skipped: true, reason: "integration_disabled" });
    }

    // Auth check
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    const providedSecret = match ? match[1].trim() : "";
    const expectedSecret = (config.niti_tracker_webhook_secret || "").trim();

    if (!expectedSecret || !providedSecret || !safeEquals(providedSecret, expectedSecret)) {
      await supabase.from("niti_tracker_events").insert({
        status: "invalid_auth",
        error_message: "Invalid or missing webhook secret",
      });
      return json({ error: "Unauthorized" }, 401);
    }

    // Body
    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const nitiSequence = Number(body.niti_sequence);
    const serviceDate = String(body.service_date ?? "");
    const nitiName = String(body.niti_name ?? "");

    if (!Number.isInteger(nitiSequence) || nitiSequence < 1) {
      await supabase.from("niti_tracker_events").insert({
        status: "invalid_payload",
        niti_name: nitiName,
        service_date: null,
        error_message: "niti_sequence must be positive integer",
      });
      return json({ error: "niti_sequence must be a positive integer" }, 400);
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDate)) {
      await supabase.from("niti_tracker_events").insert({
        status: "invalid_payload",
        niti_sequence: nitiSequence,
        niti_name: nitiName,
        error_message: "service_date must be YYYY-MM-DD",
      });
      return json({ error: "service_date must be YYYY-MM-DD" }, 400);
    }

    // Preceding-niti reminder disabled?
    if (!config.preceding_niti_reminder_enabled) {
      await supabase.from("niti_tracker_events").insert({
        niti_sequence: nitiSequence,
        niti_name: nitiName,
        service_date: serviceDate,
        notified_count: 0,
        status: "skipped_disabled",
        error_message: "Preceding-niti reminder disabled",
      });
      return json({ success: true, skipped: true, reason: "reminder_disabled" });
    }

    const offset = Number(config.preceding_niti_offset) || 1;
    const targetSequence = nitiSequence + offset;

    // Find roster rows for today matching target niti_sequence
    const { data: rosterRows, error: rosterErr } = await supabase
      .from("seba_roster")
      .select(`
        id,
        sebayat_id,
        substitute_sebayat_id,
        is_absent,
        beddha_number,
        seba_categories!inner (id, name, niti_sequence),
        seba_schedule!inner (service_date)
      `)
      .eq("seba_schedule.service_date", serviceDate)
      .eq("seba_categories.niti_sequence", targetSequence);

    if (rosterErr) {
      await supabase.from("niti_tracker_events").insert({
        niti_sequence: nitiSequence,
        niti_name: nitiName,
        service_date: serviceDate,
        status: "error",
        error_message: rosterErr.message,
      });
      return json({ error: "Query failed", details: rosterErr.message }, 500);
    }

    const rows = rosterRows ?? [];
    let notified = 0;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const r of rows as Array<{
      sebayat_id: string;
      substitute_sebayat_id: string | null;
      is_absent: boolean;
      beddha_number: number;
      seba_categories: { name: string };
    }>) {
      const targetSebayat = r.is_absent ? r.substitute_sebayat_id : r.sebayat_id;
      if (!targetSebayat) continue;

      const resp = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          event: "seba_preceding_niti_reminder",
          recipient_sebayat_id: targetSebayat,
          template_vars: {
            seba_name: r.seba_categories?.name ?? "",
            beddha_number: String(r.beddha_number ?? ""),
            previous_niti_name: nitiName,
            previous_niti_sequence: String(nitiSequence),
            service_date: serviceDate,
          },
        }),
      });

      if (resp.ok) notified++;
    }

    // Try insert processed row (respects unique index)
    const { error: insErr } = await supabase.from("niti_tracker_events").insert({
      niti_sequence: nitiSequence,
      niti_name: nitiName,
      service_date: serviceDate,
      notified_count: notified,
      status: "processed",
    });

    if (insErr && /duplicate|unique/i.test(insErr.message)) {
      return json({ success: true, skipped: true, reason: "already_processed" });
    }

    return json({
      success: true,
      notified,
      target_sequence: targetSequence,
      matched_rows: rows.length,
    });
  } catch (err) {
    return json({ error: "Internal server error", details: String(err) }, 500);
  }
});
