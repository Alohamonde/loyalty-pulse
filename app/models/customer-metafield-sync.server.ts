import type { AdminApiContext } from "@shopify/shopify-app-remix/server";
import { syncCustomerTierMetafield } from "./vip.server";

export { syncCustomerTierMetafield };

export async function syncCustomerTierForMember(
  admin: AdminApiContext,
  shop: string,
  memberId: string,
  customerId: string,
  tier: { name: string; earnMultiplier: number; perks: string },
) {
  await syncCustomerTierMetafield(admin, customerId, tier);
}
