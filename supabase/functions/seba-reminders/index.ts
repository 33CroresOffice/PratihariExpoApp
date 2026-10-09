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

// Map offset_days to the event key and config field
const STAGE_MAP: Record<number, { eventKey: string; configField: string }> = {
  5: { eventKey: "seba_5day_reminder", configField: "five_day_reminder_enabled" },
  3: { eventKey: "seba_3day_reminder", configField: "three_day_reminder_enabled" },
  1: { eventKey: "seba_1day_reminder", configField: "one_day_reminder_enabled" },
  0: { eventKey: "seba_dayof_reminder", configField: "morning_reminder_enabled" },
};

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

    // Support both old mode-based and new offset_days-based API
    let offsetDays: number | null = null;
    let mode = url.searchParams.get("mode") || "";

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.offset_days !== undefined) {
          offsetDays = parseInt(String(body.offset_days), 10);
        } else if (body.mode) {
          mode = String(body.mode);
        }
      } catch { /* ignore */ }
    }

    if (offsetDays === null) {
      // Backward compat: map old mode to offset
      if (mode === "evening") offsetDays = 1;
      else if (mode === "morning") offsetDays = 0;
      else {
        return json({ error: "offset_days (0,1,3,5) or mode (evening/morning) required" }, 400);
      }
    }

    if (!(offsetDays in STAGE_MAP)) {
      return json({ error: "offset_days must be one of: 5, 3, 1, 0" }, 400);
    }

    const stage = STAGE_MAP[offsetDays];
    const targetDate = istDate(offsetDays);
    const eventKey = stage.eventKey;

    const { data: config } = await supabase
      .from("seba_notification_config")
      .select("*")
      .eq("id", 1)
      .maybeSingle();

    if (!config) return json({ error: "Config not initialized" }, 500);

    const enabled = (config as Record<string, unknown>)[stage.configField] as boolean;
    if (!enabled) {
      return json({ success: true, skipped: true, reason: "reminder_disabled", offset_days: offsetDays });
    }

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
      offset_days: offsetDays,
      event_key: eventKey,
      service_date: targetDate,
      matched: rows.length,
      notified,
    });
  } catch (err) {
    return json({ error: "Internal error", details: String(err) }, 500);
  }
});
