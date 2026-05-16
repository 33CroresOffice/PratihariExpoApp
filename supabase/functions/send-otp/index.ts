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

const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
const msg91TemplateId = Deno.env.get("MSG91_TEMPLATE_ID");
const TEST_MODE = Deno.env.get("OTP_TEST_MODE") === "true" || !msg91AuthKey || !msg91TemplateId;
const TEST_OTP = "123456";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { phone, channel = "sms" } = await req.json();

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      return jsonResponse(
        { error: "Valid phone number required (digits only with country code, e.g. 919876543210)" },
        400
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if the requested channel is enabled in app_settings
    const settingKey = channel === "whatsapp" ? "otp_whatsapp_enabled" : "otp_sms_enabled";
    const { data: settingRow } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", settingKey)
      .maybeSingle();
    const channelEnabled = settingRow ? settingRow.value !== false : true;

    if (!channelEnabled) {
      const label = channel === "whatsapp" ? "WhatsApp" : "SMS";
      return jsonResponse(
        { error: `${label} OTP is currently disabled. Please try another method.` },
        403
      );
    }

    if (TEST_MODE) {
      // Skip MSG91 — record a test session so verify can find it
      await supabase.from("otp_sessions").insert({
        phone,
        request_id: "test-mode",
        channel,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

      return jsonResponse({
        success: true,
        message: "OTP sent successfully",
        test_mode: true,
        test_otp: TEST_OTP,
      });
    }

    if (!msg91AuthKey || !msg91TemplateId) {
      return jsonResponse({ error: "MSG91 not configured" }, 500);
    }

    const otpUrl = new URL("https://control.msg91.com/api/v5/otp");
    otpUrl.searchParams.set("template_id", msg91TemplateId);
    otpUrl.searchParams.set("mobile", phone);
    otpUrl.searchParams.set("otp_length", "6");
    otpUrl.searchParams.set("otp_expiry", "10");

    const body = channel === "whatsapp"
      ? JSON.stringify({ channel: "WHATSAPP" })
      : undefined;

    const msg91Response = await fetch(otpUrl.toString(), {
      method: "POST",
      headers: { authkey: msg91AuthKey, "Content-Type": "application/json" },
      body,
    });

    const msg91Data = await msg91Response.json();

    if (msg91Data.type !== "success") {
      return jsonResponse(
        { error: "Failed to send OTP", details: msg91Data.message },
        502
      );
    }

    await supabase.from("otp_sessions").insert({
      phone,
      request_id: msg91Data.message ?? "",
      channel,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    return jsonResponse({ success: true, message: "OTP sent successfully" });
  } catch (_err) {
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
