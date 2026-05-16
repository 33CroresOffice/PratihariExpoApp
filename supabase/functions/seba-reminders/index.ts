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

// IST date helper — returns YYYY-MM-DD for today or offset days in IST
function istDate(offsetDays = 0): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + 5.5 * 3600000 + offsetDays * 86400000;
  const d = new Date(istMs);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    let mode = url.searchParams.get("mode") || "";
    if (!mode && req.method === "POST") {
      try {
        const body = await req.json();
        mode = String(body.mode || "");
      } catch { /* ignore */ }
    }

    if (mode !== "evening" && mode !== "morning") {
      return json({ error: "mode must be 'evening' or 'morning'" }, 400);
    }

    const { data: config } = await supabase
      .from("seba_notification_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!config) return json({ error: "Config not initialized" }, 500);

    const enabled = mode === "evening"
      ? config.evening_reminder_enabled
      : config.morning_reminder_enabled;

    if (!enabled) {
      return json({ success: true, skipped: true, reason: "reminder_disabled", mode });
    }

    // Evening run at 6 PM notifies people who have seba TOMORROW.
    // Morning run at 6 AM notifies people who have seba TODAY.
    const targetDate = mode === "evening" ? istDate(1) : istDate(0);
    const eventKey = mode === "evening" ? "seba_evening_reminder" : "seba_morning_reminder";

    const { data: rosterRows, error: rosterErr } = await supabase
      .from("seba_roster")
      .select(`
        id,
        sebayat_id,
        substitute_sebayat_id,
        is_absent,
        beddha_number,
        seba_categories!inner (id, name),
        seba_schedule!inner (service_date)
      `)
      .eq("seba_schedule.service_date", targetDate);

    if (rosterErr) {
      return json({ error: "Query failed", details: rosterErr.message }, 500);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    let notified = 0;
    const rows = rosterRows ?? [];

    for (const r of rows as Array<{
      sebayat_id: string;
      substitute_sebayat_id: string | null;
      is_absent: boolean;
      beddha_number: number;
      seba_categories: { name: string };
    }>) {
      const target = r.is_absent ? r.substitute_sebayat_id : r.sebayat_id;
      if (!target) continue;

      const resp = await fetch(`${supabaseUrl}/functions/v1/send-notification`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({
          event: eventKey,
          recipient_sebayat_id: target,
          template_vars: {
            seba_name: r.seba_categories?.name ?? "",
            beddha_number: String(r.beddha_number ?? ""),
            service_date: targetDate,
          },
        }),
      });

      if (resp.ok) notified++;
    }

    return json({
      success: true,
      mode,
      service_date: targetDate,
      matched: rows.length,
      notified,
    });
  } catch (err) {
    return json({ error: "Internal error", details: String(err) }, 500);
  }
});
