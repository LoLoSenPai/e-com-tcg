import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { toPublicCustomerProfile } from "@/lib/public-customer";

export async function GET(request: NextRequest) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) {
    return NextResponse.json({ customer: null });
  }
  return NextResponse.json({
    customer: toPublicCustomerProfile(customer),
  });
}
