import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildVietQrPayload,
  resolveBankBin,
  validateDonationRequest,
  validateQrRequest,
} from "./vietqr.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonResponse({ error: "Invalid request body" }, 400);
    }

    const isDonation = "donationAmount" in body;
    let amount: number;
    let orderCode: string;
    try {
      if (isDonation) {
        amount = validateDonationRequest(body as Record<string, unknown>).amount;
        orderCode = `BAR${crypto.randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;
      } else {
        orderCode = validateQrRequest(body as Record<string, unknown>).orderCode;
      }
    } catch (error) {
      return jsonResponse(
        { error: error instanceof Error ? error.message : "Invalid request body" },
        400,
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase server credentials are missing" }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    if (isDonation) {
      const { data: settings, error } = await supabase
        .from("donation_settings")
        .select("is_enabled")
        .eq("id", true)
        .maybeSingle();
      if (error) throw error;
      if (!settings?.is_enabled) {
        return jsonResponse({ error: "Donations are not enabled" }, 403);
      }
    } else {
      const { data: order, error } = await supabase
        .from("orders")
        .select("order_code, total_amount, order_status")
        .eq("order_code", orderCode)
        .maybeSingle();

      if (error) throw error;
      if (!order) return jsonResponse({ error: "Order not found" }, 404);
      if (order.order_status === "CANCELLED") {
        return jsonResponse({ error: "This order was cancelled" }, 400);
      }
      amount = Number(order.total_amount);
    }

    const bankCode = Deno.env.get("PAYMENT_BANK_CODE") ?? "";
    const bankBin = resolveBankBin(bankCode, Deno.env.get("PAYMENT_BANK_BIN"));
    const accountNumber = Deno.env.get("PAYMENT_BANK_ACCOUNT") ?? "";
    const accountName = Deno.env.get("PAYMENT_BANK_NAME") ?? "";
    if (!accountNumber || !accountName) {
      return jsonResponse({ error: "Payment configuration is incomplete" }, 500);
    }

    const qrPayload = buildVietQrPayload(bankBin, accountNumber, amount, orderCode);
    return jsonResponse({
      orderCode,
      amount,
      paymentMethod: "BANK",
      qrPayload,
      bankName: bankCode,
      accountNumber,
      accountName,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Could not generate payment QR" },
      500,
    );
  }
});
