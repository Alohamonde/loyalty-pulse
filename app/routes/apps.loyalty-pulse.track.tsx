import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { recordLoyaltyEvent } from "../models/points-ledger.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const eventType = String(formData.get("eventType") ?? "");
  const memberId = String(formData.get("memberId") ?? "") || undefined;
  const refCode = String(formData.get("refCode") ?? "") || undefined;

  const allowed = ["ref_landing", "badge_view", "hub_view"];
  if (!allowed.includes(eventType)) {
    return json({ error: "Invalid event" }, { status: 400 });
  }

  await recordLoyaltyEvent(shop, eventType, memberId);

  return json({ ok: true, refCode });
};
