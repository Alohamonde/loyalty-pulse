import prisma from "../db.server";
import { generateReferralCode } from "../constants.server";

export async function getOrCreateShopSettings(shop: string) {
  return prisma.shopSettings.upsert({
    where: { shop },
    create: { shop },
    update: {},
  });
}

export async function ensureDefaultEarnRules(shop: string) {
  const defaults = [
    { type: "purchase", points: 0, description: "每消费 $1 获得积分" },
    { type: "signup", points: 100, description: "注册账户奖励" },
    { type: "birthday", points: 200, description: "生日当月奖励" },
  ];

  for (const rule of defaults) {
    await prisma.earnRule.upsert({
      where: { shop_type: { shop, type: rule.type } },
      create: { shop, ...rule },
      update: {},
    });
  }
}

export async function ensureDefaultVipTiers(shop: string) {
  const count = await prisma.vipTier.count({ where: { shop } });
  if (count > 0) return;

  await prisma.vipTier.createMany({
    data: [
      {
        shop,
        name: "Bronze",
        threshold: 0,
        earnMultiplier: 1,
        sortOrder: 0,
        perks: "基础会员",
      },
      {
        shop,
        name: "Silver",
        threshold: 1000,
        earnMultiplier: 1.5,
        sortOrder: 1,
        perks: "1.5x 积分倍率",
      },
      {
        shop,
        name: "Gold",
        threshold: 5000,
        earnMultiplier: 2,
        sortOrder: 2,
        perks: "2x 积分倍率",
      },
    ],
  });
}

export async function ensureDefaultRewards(shop: string) {
  const count = await prisma.reward.count({ where: { shop } });
  if (count > 0) return;

  await prisma.reward.createMany({
    data: [
      {
        shop,
        name: "$10 折扣",
        type: "fixed_amount",
        pointsCost: 1000,
        discountValue: 10,
      },
      {
        shop,
        name: "10% 折扣",
        type: "percentage",
        pointsCost: 500,
        discountValue: 10,
      },
      {
        shop,
        name: "免运费",
        type: "free_shipping",
        pointsCost: 2000,
        discountValue: 0,
      },
    ],
  });
}

async function uniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateReferralCode();
    const existing = await prisma.loyaltyMember.findUnique({
      where: { referralCode: code },
    });
    if (!existing) return code;
  }
  return `${generateReferralCode()}${Date.now().toString(36).slice(-2)}`;
}

export async function getOrCreateMember(input: {
  shop: string;
  customerId: string;
  email?: string;
  referredByMemberId?: string;
}) {
  const existing = await prisma.loyaltyMember.findUnique({
    where: {
      shop_customerId: {
        shop: input.shop,
        customerId: input.customerId,
      },
    },
  });

  if (existing) {
    if (input.email && existing.email !== input.email) {
      return prisma.loyaltyMember.update({
        where: { id: existing.id },
        data: { email: input.email },
      });
    }
    return existing;
  }

  return prisma.loyaltyMember.create({
    data: {
      shop: input.shop,
      customerId: input.customerId,
      email: input.email ?? "",
      referralCode: await uniqueReferralCode(),
      referredByMemberId: input.referredByMemberId,
    },
  });
}

export async function creditPoints(input: {
  shop: string;
  memberId: string;
  delta: number;
  source: string;
  type?: string;
  earnRuleId?: string;
  rewardId?: string;
  orderId?: string;
  note?: string;
  idempotencyKey?: string;
}) {
  if (input.delta <= 0) return null;

  if (input.idempotencyKey) {
    const dup = await prisma.pointTransaction.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
    });
    if (dup) return dup;
  }

  return prisma.$transaction(async (tx) => {
    const member = await tx.loyaltyMember.findUniqueOrThrow({
      where: { id: input.memberId },
    });

    const balanceAfter = member.pointsBalance + input.delta;
    const lifetimePoints = member.lifetimePoints + input.delta;

    await tx.loyaltyMember.update({
      where: { id: member.id },
      data: {
        pointsBalance: balanceAfter,
        lifetimePoints,
      },
    });

    return tx.pointTransaction.create({
      data: {
        memberId: member.id,
        shop: input.shop,
        type: input.type ?? "earn",
        delta: input.delta,
        balanceAfter,
        source: input.source,
        earnRuleId: input.earnRuleId,
        rewardId: input.rewardId,
        orderId: input.orderId,
        note: input.note ?? "",
        idempotencyKey: input.idempotencyKey,
      },
    });
  });
}

export async function debitPoints(input: {
  shop: string;
  memberId: string;
  delta: number;
  source: string;
  rewardId?: string;
  note?: string;
}) {
  if (input.delta <= 0) {
    throw new Error("Debit amount must be positive");
  }

  return prisma.$transaction(async (tx) => {
    const member = await tx.loyaltyMember.findUniqueOrThrow({
      where: { id: input.memberId },
    });

    if (member.pointsBalance < input.delta) {
      throw new Error("Insufficient points");
    }

    const balanceAfter = member.pointsBalance - input.delta;

    await tx.loyaltyMember.update({
      where: { id: member.id },
      data: { pointsBalance: balanceAfter },
    });

    return tx.pointTransaction.create({
      data: {
        memberId: member.id,
        shop: input.shop,
        type: "redeem",
        delta: -input.delta,
        balanceAfter,
        source: input.source,
        rewardId: input.rewardId,
        note: input.note ?? "",
      },
    });
  });
}

export async function adjustPoints(input: {
  shop: string;
  memberId: string;
  delta: number;
  note: string;
}) {
  if (input.delta === 0) return null;

  if (input.delta > 0) {
    return creditPoints({
      shop: input.shop,
      memberId: input.memberId,
      delta: input.delta,
      source: "manual",
      type: "adjust",
      note: input.note,
    });
  }

  return debitPoints({
    shop: input.shop,
    memberId: input.memberId,
    delta: Math.abs(input.delta),
    source: "manual",
    note: input.note,
  });
}

export async function getMemberTransactions(memberId: string, limit = 20) {
  return prisma.pointTransaction.findMany({
    where: { memberId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function recordLoyaltyEvent(
  shop: string,
  eventType: string,
  memberId?: string,
) {
  await prisma.loyaltyEvent.create({
    data: { shop, eventType, memberId },
  });
}

export async function purgeShopData(shop: string) {
  await prisma.loyaltyEvent.deleteMany({ where: { shop } });
  await prisma.referralEvent.deleteMany({ where: { shop } });
  await prisma.pointTransaction.deleteMany({ where: { shop } });
  await prisma.loyaltyMember.deleteMany({ where: { shop } });
  await prisma.vipTier.deleteMany({ where: { shop } });
  await prisma.reward.deleteMany({ where: { shop } });
  await prisma.earnRule.deleteMany({ where: { shop } });
  await prisma.shopSettings.deleteMany({ where: { shop } });
}
