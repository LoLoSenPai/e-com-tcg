import type { Customer } from "@/lib/types";

export type PublicCustomerProfile = Pick<
  Customer,
  "email" | "name" | "phone" | "defaultAddress"
>;

export function toPublicCustomerProfile(
  customer:
    | Pick<Customer, "email" | "name" | "phone" | "defaultAddress">
    | null
    | undefined,
): PublicCustomerProfile | null {
  if (!customer) {
    return null;
  }

  return {
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    defaultAddress: customer.defaultAddress,
  };
}
