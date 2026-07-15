# Loyalty Pulse

Smile.io 风格会员积分 Shopify App：**购物返积分**、**VIP 等级倍率**、**积分兑换折扣码**、**推荐双向奖励**、**Customer Account Loyalty Hub**。

独立产品：专注留存与复购。**不使用 Shopify Functions**、**不监听购物车**、**不动态修改购物车行**。

![Shopify](https://img.shields.io/badge/Shopify-App-7AB55C?logo=shopify&logoColor=white)
![Remix](https://img.shields.io/badge/Remix-000?logo=remix&logoColor=white)

## 产品边界

| 覆盖 | 不覆盖 |
|------|--------|
| 积分赚取 / VIP / 兑换 / 推荐 / Loyalty Hub | 购前弹窗、购物车促销、买赠、购后 Upsell、B2B 价、预售、内容/售后中台 |

与 [Conversion Pulse](https://github.com/Alohamonde/conversion-pulse)、[Wholesale Pulse](https://github.com/Alohamonde/wholesale-pulse)、[Preorder Pulse](https://github.com/Alohamonde/preorder-pulse)、[Commerce Ops](https://github.com/Alohamonde/commerce-ops) **互不隶属**；可同店可选搭配，无安装依赖。

## 功能

| 模块 | 说明 |
|------|------|
| 积分赚取 | 购物返点、注册/生日奖励、限时倍数活动 |
| VIP 等级 | 按终身积分分档，赚取倍率加成 |
| 兑换奖励 | 积分换动态折扣码（固定金额 / 百分比 / 免运） |
| 推荐计划 | `?ref=CODE` 归因，首单双方得积分 |
| Loyalty Hub | Customer Account UI — 买家积分主页 |
| 商品页徽章 | Theme block 展示「购买可得 X 积分」 |

## 技术栈

- Remix + Polaris + Prisma + SQLite
- Customer Account UI Extension（`loyalty-hub`）
- Theme App Extension（`loyalty-badge`，极简）
- Shop Metafield `$app:loyalty_pulse` + Customer Metafield `$app:loyalty_tier`
- App Proxy：`member`、`track`

## 快速开始

```bash
git clone https://github.com/Alohamonde/loyalty-pulse.git
cd loyalty-pulse
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

首次进入后台会引导 **3 步启动向导**，完成后同步 Metafield 并启用积分计划。

## 店面启用

1. 主题编辑器 → 商品页添加 **Loyalty Points Badge** 区块
2. Customer Accounts → 启用新版账户 → 添加 **Loyalty Hub** 页面扩展

## 可选搭配（无依赖）

- 店面转化漏斗 → [Conversion Pulse](https://github.com/Alohamonde/conversion-pulse)
- 批发定价 → [Wholesale Pulse](https://github.com/Alohamonde/wholesale-pulse)（标签体系可产品层对齐，非代码依赖）
- 预售 / 到货 → [Preorder Pulse](https://github.com/Alohamonde/preorder-pulse)
- AI 内容 / 售后 → [Commerce Ops](https://github.com/Alohamonde/commerce-ops)

## License

MIT
