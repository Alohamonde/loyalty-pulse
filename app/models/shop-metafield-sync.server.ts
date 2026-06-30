import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import {
  SHOP_METAFIELD_KEY,
  SHOP_METAFIELD_NAMESPACE,
} from "../constants.server";

export async function buildStorefrontConfig(shop: string) {
  const [settings, earnRules, rewards, vipTiers] = await Promise.all([
    prisma.shopSettings.findUnique({ where: { shop } }),
    prisma.earnRule.findMany({ where: { shop, enabled: true } }),
    prisma.reward.findMany({
      where: { shop, enabled: true },
      orderBy: { pointsCost: "asc" },
    }),
    prisma.vipTier.findMany({
      where: { shop },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  return {
    enabled: settings?.enabled ?? false,
    pointsName: settings?.pointsName ?? "积分",
    pointsPerCurrency: settings?.pointsPerCurrency ?? 10,
    accentColor: settings?.accentColor ?? "#7C3AED",
    appApiBase: process.env.SHOPIFY_APP_URL ?? "",
    bonusMultiplier:
      settings?.bonusEndsAt && settings.bonusEndsAt > new Date()
        ? settings.bonusMultiplier
        : 1,
    earnRules: earnRules.map((rule) => ({
      type: rule.type,
      points: rule.points,
      description: rule.description,
    })),
    rewards: rewards.map((reward) => ({
      id: reward.id,
      name: reward.name,
      type: reward.type,
      pointsCost: reward.pointsCost,
      discountValue: reward.discountValue,
    })),
    vipTiers: vipTiers.map((tier) => ({
      name: tier.name,
      threshold: tier.threshold,
      earnMultiplier: tier.earnMultiplier,
      perks: tier.perks,
    })),
    referral: {
      enabled: settings?.referralEnabled ?? true,
      referrerPoints: settings?.referrerPoints ?? 500,
      refereePoints: settings?.refereePoints ?? 200,
    },
  };
}

export async function syncShopMetafield(admin: AdminApiContext, shop: string) {
  const config = await buildStorefrontConfig(shop);

  const shopQuery = await admin.graphql(`#graphql
    query {
      shop { id }
    }`);
  const shopJson = await shopQuery.json();
  const shopId = shopJson.data?.shop?.id;
  if (!shopId) {
    throw new Error("Could not resolve shop id");
  }

  const mutation = `#graphql
    mutation SetShopConfig($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: SHOP_METAFIELD_NAMESPACE,
          key: SHOP_METAFIELD_KEY,
          type: "json",
          value: JSON.stringify(config),
        },
      ],
    },
  });

  const json = await response.json();
  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) {
    throw new Error(errors[0].message || "Metafield sync failed");
  }

  return config;
}

export async function getLoyaltyStats(shop: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    memberCount,
    pointsIssued,
    pointsRedeemed,
    referralConversions,
    hubViews,
    redemptions,
    tierCounts,
  ] = await Promise.all([
    prisma.loyaltyMember.count({ where: { shop } }),
    prisma.pointTransaction.aggregate({
      where: { shop, delta: { gt: 0 } },
      _sum: { delta: true },
    }),
    prisma.pointTransaction.aggregate({
      where: { shop, type: "redeem" },
      _sum: { delta: true },
    }),
    prisma.referralEvent.count({ where: { shop } }),
    prisma.loyaltyEvent.count({
      where: { shop, eventType: "hub_view" },
    }),
    prisma.loyaltyEvent.count({
      where: { shop, eventType: "reward_redeemed" },
    }),
    prisma.loyaltyMember.groupBy({
      by: ["tierId"],
      where: { shop },
      _count: true,
    }),
  ]);

  const activeMembers = await prisma.loyaltyMember.count({
    where: {
      shop,
      updatedAt: { gte: thirtyDaysAgo },
    },
  });

  return {
    memberCount,
    activeMembers,
    pointsIssued: pointsIssued._sum.delta ?? 0,
    pointsRedeemed: Math.abs(pointsRedeemed._sum.delta ?? 0),
    referralConversions,
    hubViews,
    redemptions,
    tierCounts,
  };
}
