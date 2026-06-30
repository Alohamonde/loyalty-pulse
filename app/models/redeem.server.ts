import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import prisma from "../db.server";
import { debitPoints, recordLoyaltyEvent } from "./points-ledger.server";

function randomCode(prefix: string) {
  return `${prefix}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function redeemReward(input: {
  admin: AdminApiContext;
  shop: string;
  memberId: string;
  rewardId: string;
}) {
  const reward = await prisma.reward.findFirst({
    where: { id: input.rewardId, shop: input.shop, enabled: true },
  });
  if (!reward) {
    throw new Error("Reward not found");
  }

  const member = await prisma.loyaltyMember.findFirst({
    where: { id: input.memberId, shop: input.shop },
  });
  if (!member) {
    throw new Error("Member not found");
  }

  if (member.pointsBalance < reward.pointsCost) {
    throw new Error("Insufficient points");
  }

  const code = randomCode("LP");

  let mutation: string;
  let variables: Record<string, unknown>;

  if (reward.type === "free_shipping") {
    mutation = `#graphql
      mutation CreateFreeShippingCode($basicCodeDiscount: DiscountCodeFreeShippingInput!) {
        discountCodeFreeShippingCreate(freeShippingCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`;
    variables = {
      basicCodeDiscount: {
        title: `Loyalty ${code}`,
        code,
        startsAt: new Date().toISOString(),
        usageLimit: 1,
        appliesOncePerCustomer: true,
        customerSelection: { all: true },
        destination: { all: true },
      },
    };
  } else {
    mutation = `#graphql
      mutation CreateBasicCode($basicCodeDiscount: DiscountCodeBasicInput!) {
        discountCodeBasicCreate(basicCodeDiscount: $basicCodeDiscount) {
          codeDiscountNode { id }
          userErrors { field message }
        }
      }`;
    const value =
      reward.type === "percentage"
        ? { percentage: reward.discountValue / 100 }
        : {
            discountAmount: {
              amount: reward.discountValue,
              appliesOnEachItem: false,
            },
          };

    variables = {
      basicCodeDiscount: {
        title: `Loyalty ${code}`,
        code,
        startsAt: new Date().toISOString(),
        usageLimit: 1,
        appliesOncePerCustomer: true,
        customerSelection: { all: true },
        customerGets: { value, items: { all: true } },
      },
    };
  }

  const response = await input.admin.graphql(mutation, { variables });
  const json = await response.json();
  const root =
    reward.type === "free_shipping"
      ? json.data?.discountCodeFreeShippingCreate
      : json.data?.discountCodeBasicCreate;
  const userErrors = root?.userErrors ?? [];
  if (userErrors.length) {
    throw new Error(userErrors[0].message || "Failed to create discount code");
  }

  await debitPoints({
    shop: input.shop,
    memberId: member.id,
    delta: reward.pointsCost,
    source: "redeem",
    rewardId: reward.id,
    note: `兑换：${reward.name} → ${code}`,
  });

  await recordLoyaltyEvent(input.shop, "reward_redeemed", member.id);

  const updated = await prisma.loyaltyMember.findUniqueOrThrow({
    where: { id: member.id },
  });

  return {
    code,
    reward,
    pointsBalance: updated.pointsBalance,
  };
}
