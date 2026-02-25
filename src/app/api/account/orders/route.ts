import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { getOrdersByCustomerEmail } from "@/lib/orders";

export async function GET(request: NextRequest) {
  const customer = await getCustomerFromRequest(request);
  if (!customer?.email) {
    return NextResponse.json({ orders: [] });
  }
  const orders = await getOrdersByCustomerEmail(customer.email);
  return NextResponse.json({ orders });
}
