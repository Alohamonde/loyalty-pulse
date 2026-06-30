import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import { parseOrderSubtotal } from "../constants.server";
import {
  creditPoints,
  getOrCreateMember,
  getOrCreateShopSettings,
  recordLoyaltyEvent,
} from "./points-ledger.server";
import { resolveMemberTier, syncMemberTier, syncMemberTierWithMetafield } from "./vip.server";
import { processReferralOnFirstOrder } from "./referral.server";

export async function handleCustomerCreate(
  shop: string,
  customer: {
    id?: number | string;
    email?: string;
  },
) {
  if (!customer.id) return;

  const settings = await getOrCreateShopSettings(shop);
  if (!settings.enabled) return;

  const customerId = String(customer.id);
  const member = await getOrCreateMember({
    shop,
    customerId,
    email: customer.email,
  });

  const signupRule = await prisma.earnRule.findUnique({
    where: { shop_type: { shop, type: "signup" } },
  });

  if (!signupRule?.enabled || signupRule.points <= 0) return;

  const idempotencyKey = `signup:${shop}:${customerId}`;
  const existing = await prisma.pointTransaction.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return;

  await creditPoints({
    shop,
    memberId: member.id,
    delta: signupRule.points,
    source: "signup",
    earnRuleId: signupRule.id,
    idempotencyKey,
    note: signupRule.description,
  });

  await syncMemberTier(shop, member.id);
  await recordLoyaltyEvent(shop, "signup_bonus", member.id);
}

export async function handleOrderPaid(
  shop: string,
  order: {
    id?: number | string;
    customer?: { id?: number | string; email?: string } | null;
    subtotal_price?: string;
    current_subtotal_price?: string;
    total_price?: string;
    note_attributes?: Array<{ name: string; value: string }>;
  },
  admin?: AdminApiContext,
) {
  const settings = await getOrCreateShopSettings(shop);
  if (!settings.enabled) return;

  const customerId = order.customer?.id ? String(order.customer.id) : null;
  if (!customerId) return;

  const orderId = order.id ? String(order.id) : undefined;
  const member = await getOrCreateMember({
    shop,
    customerId,
    email: order.customer?.email,
  });

  const purchaseRule = await prisma.earnRule.findUnique({
    where: { shop_type: { shop, type: "purchase" } },
  });

  if (purchaseRule?.enabled) {
    const subtotal = parseOrderSubtotal(order);
    const tier = await resolveMemberTier(shop, member.id);
    const bonusMultiplier =
      settings.bonusEndsAt && settings.bonusEndsAt > new Date()
        ? settings.bonusMultiplier
        : 1;

    const basePoints = Math.floor(subtotal * settings.pointsPerCurrency);
    const earned = Math.floor(
      basePoints * tier.earnMultiplier * bonusMultiplier,
    );

    if (earned > 0) {
      const idempotencyKey = `purchase:${shop}:${orderId}:${purchaseRule.id}`;
      await creditPoints({
        shop,
        memberId: member.id,
        delta: earned,
        source: "purchase",
        earnRuleId: purchaseRule.id,
        orderId,
        idempotencyKey,
        note: `订单消费 $${subtotal.toFixed(2)}`,
      });
      await recordLoyaltyEvent(shop, "points_earned", member.id);
    }
  }

  const refCode = order.note_attributes?.find(
    (attr) => attr.name === "_lp_ref" || attr.name === "lp_ref",
  )?.value;

  if (refCode && orderId) {
    await processReferralOnFirstOrder({
      shop,
      refereeMemberId: member.id,
      referralCode: refCode,
      orderId,
    });
  }

  await maybeAwardBirthdayBonus(shop, member.id);
  if (admin) {
    await syncMemberTierWithMetafield(admin, shop, member.id);
  } else {
    await syncMemberTier(shop, member.id);
  }
}

async function maybeAwardBirthdayBonus(shop: string, memberId: string) {
  const member = await prisma.loyaltyMember.findUnique({
    where: { id: memberId },
  });
  if (!member?.birthdayMonth || !member.birthdayDay) return;

  const now = new Date();
  if (
    now.getMonth() + 1 !== member.birthdayMonth ||
    now.getDate() !== member.birthdayDay
  ) {
    return;
  }

  const birthdayRule = await prisma.earnRule.findUnique({
    where: { shop_type: { shop, type: "birthday" } },
  });
  if (!birthdayRule?.enabled || birthdayRule.points <= 0) return;

  const year = now.getFullYear();
  const idempotencyKey = `birthday:${shop}:${member.customerId}:${year}`;
  const existing = await prisma.pointTransaction.findUnique({
    where: { idempotencyKey },
  });
  if (existing) return;

  await creditPoints({
    shop,
    memberId,
    delta: birthdayRule.points,
    source: "birthday",
    earnRuleId: birthdayRule.id,
    idempotencyKey,
    note: birthdayRule.description,
  });
}
