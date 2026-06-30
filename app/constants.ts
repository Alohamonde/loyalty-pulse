export const EARN_RULE_TYPES = [
  "purchase",
  "signup",
  "birthday",
] as const;

export type EarnRuleType = (typeof EARN_RULE_TYPES)[number];

export const REWARD_TYPES = [
  "fixed_amount",
  "percentage",
  "free_shipping",
] as const;

export type RewardType = (typeof REWARD_TYPES)[number];

export const EARN_RULE_LABELS: Record<EarnRuleType, string> = {
  purchase: "购物返积分",
  signup: "注册奖励",
  birthday: "生日奖励",
};

export const REWARD_TYPE_LABELS: Record<RewardType, string> = {
  fixed_amount: "固定金额折扣",
  percentage: "百分比折扣",
  free_shipping: "免运费",
};
