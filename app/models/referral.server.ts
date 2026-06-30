import prisma from "../db.server";
import {
  creditPoints,
  getOrCreateShopSettings,
  recordLoyaltyEvent,
} from "./points-ledger.server";

export async function findMemberByReferralCode(shop: string, code: string) {
  return prisma.loyaltyMember.findFirst({
    where: { shop, referralCode: code.toUpperCase() },
  });
}

export async function linkReferralOnSignup(input: {
  shop: string;
  refereeMemberId: string;
  referralCode: string;
}) {
  const settings = await getOrCreateShopSettings(input.shop);
  if (!settings.referralEnabled) return;

  const referrer = await findMemberByReferralCode(
    input.shop,
    input.referralCode,
  );
  if (!referrer || referrer.id === input.refereeMemberId) return;

  const referee = await prisma.loyaltyMember.findUnique({
    where: { id: input.refereeMemberId },
  });
  if (!referee || referee.referredByMemberId) return;

  await prisma.loyaltyMember.update({
    where: { id: referee.id },
    data: { referredByMemberId: referrer.id },
  });
}

export async function processReferralOnFirstOrder(input: {
  shop: string;
  refereeMemberId: string;
  referralCode: string;
  orderId: string;
}) {
  const settings = await getOrCreateShopSettings(input.shop);
  if (!settings.referralEnabled) return;

  const existingOrderReferral = await prisma.referralEvent.findFirst({
    where: { shop: input.shop, orderId: input.orderId },
  });
  if (existingOrderReferral) return;

  const referee = await prisma.loyaltyMember.findUnique({
    where: { id: input.refereeMemberId },
  });
  if (!referee) return;

  let referrerId = referee.referredByMemberId;
  if (!referrerId) {
    const referrer = await findMemberByReferralCode(
      input.shop,
      input.referralCode,
    );
    if (!referrer || referrer.id === referee.id) return;
    referrerId = referrer.id;
    await prisma.loyaltyMember.update({
      where: { id: referee.id },
      data: { referredByMemberId: referrerId },
    });
  }

  const priorPurchase = await prisma.pointTransaction.findFirst({
    where: {
      shop: input.shop,
      memberId: referee.id,
      source: "purchase",
      NOT: { orderId: input.orderId },
    },
  });
  if (priorPurchase) return;

  const referrerPoints = settings.referrerPoints;
  const refereePoints = settings.refereePoints;

  if (referrerPoints > 0) {
    await creditPoints({
      shop: input.shop,
      memberId: referrerId,
      delta: referrerPoints,
      source: "referral",
      orderId: input.orderId,
      idempotencyKey: `referral:referrer:${input.shop}:${orderId}`,
      note: "推荐好友首单奖励",
    });
  }

  if (refereePoints > 0) {
    await creditPoints({
      shop: input.shop,
      memberId: referee.id,
      delta: refereePoints,
      source: "referral",
      orderId: input.orderId,
      idempotencyKey: `referral:referee:${input.shop}:${orderId}`,
      note: "被推荐首单奖励",
    });
  }

  await prisma.referralEvent.create({
    data: {
      shop: input.shop,
      referrerMemberId: referrerId,
      refereeMemberId: referee.id,
      orderId: input.orderId,
      referrerPoints,
      refereePoints,
    },
  });

  await recordLoyaltyEvent(input.shop, "referral_conversion", referee.id);
}

export async function getReferralStats(shop: string) {
  const [total, recent] = await Promise.all([
    prisma.referralEvent.count({ where: { shop } }),
    prisma.referralEvent.count({
      where: {
        shop,
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return { total, recent30d: recent };
}
