import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getRazorpay } from "@/lib/razorpay";

// Prices in cents (USD) matching the USDC contract prices
const PACKAGE_PRICES_CENTS: Record<number, number> = {
  0: 50,    // 1 Day  — $0.50
  1: 100,   // 3 Days — $1.00
  2: 200,   // 7 Days — $2.00
  3: 500,   // 30 Days — $5.00
  4: 1500,  // Lifetime — $15.00
};

const PACKAGE_LABELS: Record<number, string> = {
  0: "1 Day",
  1: "3 Days",
  2: "7 Days",
  3: "30 Days",
  4: "Lifetime",
};

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { project_id, project_title, package_index } = body;

    if (!project_id || !project_title || package_index == null) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const priceInCents = PACKAGE_PRICES_CENTS[package_index];
    if (!priceInCents) {
      return NextResponse.json({ error: "Invalid package" }, { status: 400 });
    }

    const razorpay = getRazorpay();
    const order = await razorpay.orders.create({
      amount: priceInCents, // Razorpay expects smallest currency unit (cents for USD)
      currency: "USD",
      notes: {
        user_id: user.id,
        project_id,
        project_title,
        package_index: String(package_index),
        package_label: PACKAGE_LABELS[package_index],
      },
    });

    return NextResponse.json({
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
    });
  } catch (err) {
    console.error("Razorpay create order error:", err);
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }
}
