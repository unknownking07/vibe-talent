import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("x-razorpay-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    // Verify webhook signature
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      console.error("Razorpay webhook signature mismatch");
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const event = JSON.parse(body);
    const eventType = event.event;

    if (eventType === "payment.captured") {
      const payment = event.payload.payment.entity;
      const notes = payment.notes || {};

      console.log("[Razorpay Webhook] Payment captured:", {
        payment_id: payment.id,
        order_id: payment.order_id,
        amount: payment.amount,
        currency: payment.currency,
        project_id: notes.project_id,
        project_title: notes.project_title,
        package_label: notes.package_label,
        user_id: notes.user_id,
      });

      // TODO: When promotions table is added, insert the promotion record here
      // For now, the on-chain promote via USDC handles the actual featuring.
      // This webhook logs the fiat payment for tracking/reconciliation.
    }

    if (eventType === "payment.failed") {
      const payment = event.payload.payment.entity;
      console.log("[Razorpay Webhook] Payment failed:", {
        payment_id: payment.id,
        order_id: payment.order_id,
        reason: payment.error_description,
      });
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("Razorpay webhook error:", err);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
