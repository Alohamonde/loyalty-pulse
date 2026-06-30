export const SHOP_METAFIELD_NAMESPACE = "$app:loyalty_pulse";
export const SHOP_METAFIELD_KEY = "config";
export const CUSTOMER_METAFIELD_NAMESPACE = "$app:loyalty_tier";
export const CUSTOMER_METAFIELD_KEY = "tier";

export const REFERRAL_COOKIE = "lp_ref";

export function generateReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function parseOrderSubtotal(order: {
  subtotal_price?: string;
  current_subtotal_price?: string;
  total_price?: string;
}): number {
  const raw =
    order.current_subtotal_price ??
    order.subtotal_price ??
    order.total_price ??
    "0";
  return parseFloat(raw) || 0;
}
