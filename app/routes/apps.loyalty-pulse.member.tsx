import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getMemberTransactions } from "../models/points-ledger.server";
import { getTierProgress } from "../models/vip.server";
import { recordLoyaltyEvent } from "../models/points-ledger.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const shop = session?.shop;

  if (!shop) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer_id");

  if (!customerId) {
    return json({ error: "Missing customer_id" }, { status: 400 });
  }

  const member = await prisma.loyaltyMember.findUnique({
    where: { shop_customerId: { shop, customerId } },
  });

  if (!member) {
    return json({ member: null });
  }

  const [transactions, tierProgress] = await Promise.all([
    getMemberTransactions(member.id, 5),
    getTierProgress(shop, member.id),
  ]);

  await recordLoyaltyEvent(shop, "hub_view", member.id);

  return json({
    member: {
      pointsBalance: member.pointsBalance,
      lifetimePoints: member.lifetimePoints,
      referralCode: member.referralCode,
    },
    tierProgress,
    transactions,
  });
};
