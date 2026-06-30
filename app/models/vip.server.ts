import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import {
  CUSTOMER_METAFIELD_KEY,
  CUSTOMER_METAFIELD_NAMESPACE,
} from "../constants.server";

export async function getVipTiers(shop: string) {
  return prisma.vipTier.findMany({
    where: { shop },
    orderBy: { sortOrder: "asc" },
  });
}

export async function resolveMemberTier(shop: string, memberId: string) {
  const member = await prisma.loyaltyMember.findUniqueOrThrow({
    where: { id: memberId },
  });
  const tiers = await getVipTiers(shop);

  let matched = tiers[0] ?? {
    id: "",
    name: "Member",
    threshold: 0,
    earnMultiplier: 1,
    perks: "",
  };

  for (const tier of tiers) {
    if (member.lifetimePoints >= tier.threshold) {
      matched = tier;
    }
  }

  return matched;
}

export async function syncMemberTier(shop: string, memberId: string) {
  const member = await prisma.loyaltyMember.findUniqueOrThrow({
    where: { id: memberId },
  });
  const tier = await resolveMemberTier(shop, memberId);

  if (member.tierId !== tier.id) {
    await prisma.loyaltyMember.update({
      where: { id: memberId },
      data: { tierId: tier.id || null },
    });
  }

  return tier;
}

export async function syncCustomerTierMetafield(
  admin: AdminApiContext,
  customerId: string,
  tier: { name: string; earnMultiplier: number; perks: string },
) {
  const mutation = `#graphql
    mutation SetCustomerTier($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message }
      }
    }`;

  const response = await admin.graphql(mutation, {
    variables: {
      metafields: [
        {
          ownerId: `gid://shopify/Customer/${customerId}`,
          namespace: CUSTOMER_METAFIELD_NAMESPACE,
          key: CUSTOMER_METAFIELD_KEY,
          type: "json",
          value: JSON.stringify({
            name: tier.name,
            earnMultiplier: tier.earnMultiplier,
            perks: tier.perks,
          }),
        },
      ],
    },
  });

  const json = await response.json();
  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length) {
    console.warn("Customer tier metafield sync failed:", errors[0].message);
  }
}

export async function syncMemberTierWithMetafield(
  admin: AdminApiContext,
  shop: string,
  memberId: string,
) {
  const member = await prisma.loyaltyMember.findUniqueOrThrow({
    where: { id: memberId },
  });
  const tier = await syncMemberTier(shop, memberId);
  await syncCustomerTierMetafield(admin, member.customerId, tier);
  return tier;
}

export async function getTierProgress(shop: string, memberId: string) {
  const member = await prisma.loyaltyMember.findUniqueOrThrow({
    where: { id: memberId },
  });
  const tiers = await getVipTiers(shop);
  const current = await resolveMemberTier(shop, memberId);
  const currentIndex = tiers.findIndex((t) => t.id === current.id);
  const next = currentIndex >= 0 ? tiers[currentIndex + 1] : tiers[1];

  return {
    current,
    next,
    lifetimePoints: member.lifetimePoints,
    pointsToNext: next
      ? Math.max(0, next.threshold - member.lifetimePoints)
      : 0,
  };
}
