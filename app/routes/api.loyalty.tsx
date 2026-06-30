import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getMemberTransactions, getOrCreateMember } from "../models/points-ledger.server";
import { getTierProgress } from "../models/vip.server";
import { buildStorefrontConfig } from "../models/shop-metafield-sync.server";
import { redeemReward } from "../models/redeem.server";
import { syncMemberTierWithMetafield } from "../models/vip.server";
import { recordLoyaltyEvent } from "../models/points-ledger.server";

async function resolveCustomerId(request: Request, sessionToken: { sub: string }) {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("customerId");
  if (fromQuery) return fromQuery;

  const sub = sessionToken.sub;
  if (sub.includes("Customer")) {
    return sub.split("/").pop() ?? "";
  }
  return sub;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { sessionToken, cors } =
    await authenticate.public.customerAccount(request);
  const shop = sessionToken.dest.replace("https://", "");
  const customerId = await resolveCustomerId(request, sessionToken);

  if (!customerId) {
    return cors(json({ error: "Missing customer" }, { status: 400 }));
  }

  let member = await prisma.loyaltyMember.findUnique({
    where: { shop_customerId: { shop, customerId } },
  });

  if (!member) {
    member = await getOrCreateMember({ shop, customerId });
  }

  if (!member) {
    const config = await buildStorefrontConfig(shop);
    return cors(
      json({
        member: null,
        config,
        rewards: config.rewards,
      }),
    );
  }

  const [transactions, tierProgress, config] = await Promise.all([
    getMemberTransactions(member.id, 10),
    getTierProgress(shop, member.id),
    buildStorefrontConfig(shop),
  ]);

  await recordLoyaltyEvent(shop, "hub_view", member.id);

  return cors(
    json({
      member: {
        id: member.id,
        pointsBalance: member.pointsBalance,
        lifetimePoints: member.lifetimePoints,
        referralCode: member.referralCode,
        birthdayMonth: member.birthdayMonth,
        birthdayDay: member.birthdayDay,
      },
      tierProgress,
      transactions,
      rewards: config.rewards,
      config,
    }),
  );
};

export const action = async ({ request }: ActionFunctionArgs) => {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const { sessionToken, cors, admin } =
    await authenticate.public.customerAccount(request);
  const shop = sessionToken.dest.replace("https://", "");
  const customerId = await resolveCustomerId(request, sessionToken);

  let body: {
    action?: string;
    rewardId?: string;
    birthdayMonth?: number;
    birthdayDay?: number;
  };
  try {
    body = await request.json();
  } catch {
    return cors(json({ error: "Invalid JSON" }, { status: 400 }));
  }

  const member = await prisma.loyaltyMember.findUnique({
    where: { shop_customerId: { shop, customerId } },
  });

  if (!member) {
    return cors(json({ error: "Member not found" }, { status: 404 }));
  }

  if (body.action === "redeem" && body.rewardId) {
    try {
      const result = await redeemReward({
        admin,
        shop,
        memberId: member.id,
        rewardId: body.rewardId,
      });
      await syncMemberTierWithMetafield(admin, shop, member.id);
      return cors(
        json({
          ok: true,
          code: result.code,
          pointsBalance: result.pointsBalance,
        }),
      );
    } catch (error) {
      return cors(
        json(
          {
            error:
              error instanceof Error ? error.message : "Redeem failed",
          },
          { status: 400 },
        ),
      );
    }
  }

  if (body.action === "birthday") {
    await prisma.loyaltyMember.update({
      where: { id: member.id },
      data: {
        birthdayMonth: body.birthdayMonth,
        birthdayDay: body.birthdayDay,
      },
    });
    return cors(json({ ok: true }));
  }

  return cors(json({ error: "Unknown action" }, { status: 400 }));
};
