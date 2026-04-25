import { CheckoutSuccessClient } from "@/components/checkout-success-client";

type CheckoutSuccessPageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function CheckoutSuccessPage({
  searchParams,
}: CheckoutSuccessPageProps) {
  const params = await searchParams;

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-16">
      <CheckoutSuccessClient sessionId={params.session_id} />
    </main>
  );
}
