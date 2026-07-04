import { NextRequest, NextResponse } from "next/server";
import { getCustomerFromRequest } from "@/lib/customer-auth";
import { updateCustomerById } from "@/lib/customers";
import { toPublicCustomerProfile } from "@/lib/public-customer";

function cleanOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

export async function PATCH(request: NextRequest) {
  const customer = await getCustomerFromRequest(request);
  if (!customer?._id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => ({}));
  const defaultAddress = body.defaultAddress
    ? {
        line1: cleanOptionalString(body.defaultAddress.line1),
        line2: cleanOptionalString(body.defaultAddress.line2),
        postalCode: cleanOptionalString(body.defaultAddress.postalCode),
        city: cleanOptionalString(body.defaultAddress.city),
        state: cleanOptionalString(body.defaultAddress.state),
        country: cleanOptionalString(body.defaultAddress.country),
      }
    : undefined;
  const hasAddress = Boolean(
    defaultAddress && Object.values(defaultAddress).some(Boolean),
  );
  const updates = {
    name: cleanOptionalString(body.name),
    phone: cleanOptionalString(body.phone),
    defaultAddress: hasAddress ? defaultAddress : undefined,
    updatedAt: new Date().toISOString(),
  };
  const updated = await updateCustomerById(customer._id, updates);
  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    customer: toPublicCustomerProfile(updated),
  });
}
