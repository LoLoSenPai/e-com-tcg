import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";

export async function GET(request: NextRequest) {
  const customer = await getCustomerFromRequest(request);
  if (!customer) {
    return NextResponse.json({ customer: null });
  }
  return NextResponse.json({
    customer: {
      _id: customer._id,
      email: customer.email,
      name: customer.name,
      phone: customer.phone,
      defaultAddress: customer.defaultAddress,
    },
  });
}
