import type { ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { handleOrderPaid } from "../models/earn-engine.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic, payload, admin } = await authenticate.webhook(request);

  console.log(`Received ${topic} webhook for ${shop}`);

  await handleOrderPaid(
    shop,
    payload as {
      id?: number;
      customer?: { id?: number; email?: string } | null;
      subtotal_price?: string;
      current_subtotal_price?: string;
      total_price?: string;
      note_attributes?: Array<{ name: string; value: string }>;
    },
    admin,
  );

  return new Response();
};
