import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
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
      event,
      recipient_sebayat_id,
      recipient_type = "sebayat",
      template_vars = {},
    } = await req.json();

    if (!event) {
      return jsonResponse({ error: "event is required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");

    // Load channel configs
    const { data: channels } = await supabase
      .from("notification_channels")
      .select("channel, enabled, push_mode");

    const channelMap: Record<string, { enabled: boolean; push_mode: string }> = {};
    for (const ch of channels ?? []) {
      channelMap[ch.channel] = { enabled: ch.enabled, push_mode: ch.push_mode };
    }

    // Load feature config for this event
    const { data: featureConfig } = await supabase
      .from("notification_feature_config")
      .select("*")
      .eq("event_key", event)
      .maybeSingle();

    if (!featureConfig) {
      return jsonResponse({ success: true, message: "No config for event, skipping" });
    }

    const results: Record<string, string> = {};

    // ── Admin in-dashboard notification ──────────────────────────────────────
    if (featureConfig.admin_notification_enabled) {
      const title = applyTemplate(featureConfig.push_template || featureConfig.label, template_vars);
      const body = applyTemplate(
        featureConfig.sms_template || featureConfig.whatsapp_template || "",
        template_vars
      );

      await supabase.from("admin_notifications").insert({
        event_key: event,
        title,
        body,
        reference_type: template_vars.reference_type ?? null,
        reference_id: template_vars.reference_id ?? null,
        is_read: false,
      });

      await supabase.from("notification_log").insert({
        event_key: event,
        channel: "admin",
        recipient_type: "admin",
        recipient_sebayat_id: recipient_sebayat_id ?? null,
        status: "sent",
      });

      results.admin = "sent";
    }

    // Resolve recipient phone if we have a sebayat ID
    let recipientPhone: string | null = null;
    if (recipient_sebayat_id && recipient_type === "sebayat") {
      const { data: sebayat } = await supabase
        .from("sebayats")
        .select("mobile_primary, first_name, last_name")
        .eq("id", recipient_sebayat_id)
        .maybeSingle();

      if (sebayat?.mobile_primary) {
        recipientPhone = sebayat.mobile_primary.replace(/\D/g, "");
        if (!template_vars.name) {
          template_vars.name = [sebayat.first_name, sebayat.last_name].filter(Boolean).join(" ");
        }
      }
    }

    // ── SMS ───────────────────────────────────────────────────────────────────
    if (
      featureConfig.sms_enabled &&
      channelMap["sms"]?.enabled &&
      recipientPhone &&
      featureConfig.sms_template
    ) {
      let smsStatus = "failed";
      let providerResponse: Record<string, unknown> = {};
      let errorMessage: string | undefined;

      try {
        const message = applyTemplate(featureConfig.sms_template, template_vars);

        if (msg91AuthKey) {
          const url = new URL("https://control.msg91.com/api/v5/flow/");
          const response = await fetch(url.toString(), {
            method: "POST",
            headers: { authkey: msg91AuthKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              template_id: Deno.env.get("MSG91_SMS_NOTIFICATION_TEMPLATE_ID") ?? Deno.env.get("MSG91_TEMPLATE_ID"),
              short_url: "0",
              recipients: [
                {
                  mobiles: recipientPhone,
                  var1: message,
                },
              ],
            }),
          });
          providerResponse = await response.json();
          smsStatus = (providerResponse as Record<string, unknown>).type === "success" ? "sent" : "failed";
          if (smsStatus === "failed") {
            errorMessage = String((providerResponse as Record<string, unknown>).message ?? "Unknown error");
          }
        } else {
          smsStatus = "skipped";
          errorMessage = "MSG91_AUTH_KEY not configured";
        }
      } catch (err) {
        errorMessage = String(err);
      }

      await supabase.from("notification_log").insert({
        event_key: event,
        channel: "sms",
        recipient_type,
        recipient_sebayat_id: recipient_sebayat_id ?? null,
        recipient_phone: recipientPhone,
        status: smsStatus,
        provider_response: providerResponse,
        error_message: errorMessage ?? null,
      });

      results.sms = smsStatus;
    }

    // ── WhatsApp ──────────────────────────────────────────────────────────────
    if (
      featureConfig.whatsapp_enabled &&
      channelMap["whatsapp"]?.enabled &&
      recipientPhone &&
      featureConfig.whatsapp_template
    ) {
      let waStatus = "failed";
      let providerResponse: Record<string, unknown> = {};
      let errorMessage: string | undefined;

      try {
        const message = applyTemplate(featureConfig.whatsapp_template, template_vars);

        if (msg91AuthKey) {
          const url = new URL("https://control.msg91.com/api/v5/flow/");
          const response = await fetch(url.toString(), {
            method: "POST",
            headers: { authkey: msg91AuthKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              template_id: Deno.env.get("MSG91_WA_NOTIFICATION_TEMPLATE_ID") ?? Deno.env.get("MSG91_TEMPLATE_ID"),
              short_url: "0",
              recipients: [
                {
                  mobiles: recipientPhone,
                  channel: "WHATSAPP",
                  var1: message,
                },
              ],
            }),
          });
          providerResponse = await response.json();
          waStatus = (providerResponse as Record<string, unknown>).type === "success" ? "sent" : "failed";
          if (waStatus === "failed") {
            errorMessage = String((providerResponse as Record<string, unknown>).message ?? "Unknown error");
          }
        } else {
          waStatus = "skipped";
          errorMessage = "MSG91_AUTH_KEY not configured";
        }
      } catch (err) {
        errorMessage = String(err);
      }

      await supabase.from("notification_log").insert({
        event_key: event,
        channel: "whatsapp",
        recipient_type,
        recipient_sebayat_id: recipient_sebayat_id ?? null,
        recipient_phone: recipientPhone,
        status: waStatus,
        provider_response: providerResponse,
        error_message: errorMessage ?? null,
      });

      results.whatsapp = waStatus;
    }

    // ── Push ──────────────────────────────────────────────────────────────────
    if (
      featureConfig.push_enabled &&
      channelMap["push"]?.enabled &&
      recipient_sebayat_id &&
      featureConfig.push_template
    ) {
      let pushStatus = "failed";
      let providerResponse: Record<string, unknown> = {};
      let errorMessage: string | undefined;

      try {
        const { data: tokenRows } = await supabase
          .from("push_tokens")
          .select("token, mode")
          .eq("sebayat_id", recipient_sebayat_id);

        if (tokenRows && tokenRows.length > 0) {
          const pushMode = channelMap["push"]?.push_mode ?? "expo-go";
          const title = applyTemplate(featureConfig.label, template_vars);
          const body = applyTemplate(featureConfig.push_template, template_vars);

          const messages = tokenRows.map((row: { token: string; mode: string }) => ({
            to: row.token,
            title,
            body,
            sound: "default",
            data: { event, reference_id: template_vars.reference_id },
          }));

          const expoUrl =
            pushMode === "production"
              ? "https://exp.host/--/api/v2/push/send"
              : "https://exp.host/--/api/v2/push/send";

          const response = await fetch(expoUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(messages.length === 1 ? messages[0] : messages),
          });

          providerResponse = await response.json();
          const hasError = (providerResponse as Record<string, unknown>).errors;
          pushStatus = hasError ? "failed" : "sent";
        } else {
          pushStatus = "skipped";
          errorMessage = "No push tokens registered for sebayat";
        }
      } catch (err) {
        errorMessage = String(err);
      }

      await supabase.from("notification_log").insert({
        event_key: event,
        channel: "push",
        recipient_type,
        recipient_sebayat_id: recipient_sebayat_id ?? null,
        status: pushStatus,
        provider_response: providerResponse,
        error_message: errorMessage ?? null,
      });

      results.push = pushStatus;
    }

    return jsonResponse({ success: true, results });
  } catch (err) {
    return jsonResponse({ error: "Internal server error", details: String(err) }, 500);
  }
});
