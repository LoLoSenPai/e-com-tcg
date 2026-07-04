import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { getOrdersByCustomer } from "@/lib/orders";
import { toPublicAccountOrders } from "@/lib/account-orders";

export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function GET(request: NextRequest) {
  const customer = await getCustomerFromRequest(request);
  if (!customer?._id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401, headers: noStoreHeaders },
    );
  }
  const orders = await getOrdersByCustomer(customer);
  return NextResponse.json(
    { orders: toPublicAccountOrders(orders) },
    { headers: noStoreHeaders },
  );
}
