import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { updateCustomerById } from "@/lib/customers";

export async function PATCH(request: NextRequest) {
  const customer = await getCustomerFromRequest(request);
  if (!customer?._id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const updates = {
    name: body.name ? String(body.name).trim() : undefined,
    phone: body.phone ? String(body.phone).trim() : undefined,
    defaultAddress: body.defaultAddress
      ? {
          line1: body.defaultAddress.line1 || undefined,
          line2: body.defaultAddress.line2 || undefined,
          postalCode: body.defaultAddress.postalCode || undefined,
          city: body.defaultAddress.city || undefined,
          state: body.defaultAddress.state || undefined,
          country: body.defaultAddress.country || undefined,
        }
      : undefined,
    updatedAt: new Date().toISOString(),
  };
  const updated = await updateCustomerById(customer._id, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    customer: {
      _id: updated._id,
      email: updated.email,
      name: updated.name,
      phone: updated.phone,
      defaultAddress: updated.defaultAddress,
    },
  });
}
