import "jsr:@supabase/functions-js/edge-runtime.d.ts";

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
    const { phone, channel = "sms" } = await req.json();

    if (!phone || !/^\d{10,15}$/.test(phone)) {
      return jsonResponse({ error: "Valid phone number required" }, 400);
    }

    if (TEST_MODE) {
      return jsonResponse({
        success: true,
        message: "OTP resent successfully",
        test_mode: true,
        test_otp: TEST_OTP,
      });
    }

    const msg91AuthKey = Deno.env.get("MSG91_AUTH_KEY");
    if (!msg91AuthKey) {
      return jsonResponse({ error: "MSG91 not configured" }, 500);
    }

    const retryType = channel === "voice" ? "voice" : "text";

    const retryUrl = new URL("https://control.msg91.com/api/v5/otp/retry");
    retryUrl.searchParams.set("mobile", phone);
    retryUrl.searchParams.set("retrytype", retryType);

    const msg91Response = await fetch(retryUrl.toString(), {
      method: "POST",
      headers: { authkey: msg91AuthKey, "Content-Type": "application/json" },
    });

    const msg91Data = await msg91Response.json();

    if (msg91Data.type !== "success") {
      return jsonResponse(
        { error: "Failed to resend OTP", details: msg91Data.message },
        502
      );
    }

    return jsonResponse({ success: true, message: "OTP resent successfully" });
  } catch (_err) {
    return jsonResponse({ error: "Internal server error" }, 500);
  }
});
