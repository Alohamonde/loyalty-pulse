# Loyalty Pulse

Smile.io 风格会员积分 Shopify App：**购物返积分**、**VIP 等级倍率**、**积分兑换折扣码**、**推荐双向奖励**、**Customer Account Loyalty Hub**。

与 project1–4、giftdev2 刻意错位：**不使用 Shopify Functions**、**不监听购物车**、**不动态修改购物车行**。

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
- App Proxy：`member`、`track`（无 config 轮询）

## 快速开始

```bash
cd "C:\other projects\project5\loyalty-pulse"
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev
```

首次进入后台会引导 **3 步启动向导**，完成后同步 Metafield 并启用积分计划。

## 店面启用

1. 主题编辑器 → 商品页添加 **Loyalty Points Badge** 区块
2. Customer Accounts → 启用新版账户 → 添加 **Loyalty Hub** 页面扩展

## 差异化矩阵

| 项目 | 定位 |
|------|------|
| project1 | 购前引流 |
| project2 | 购后 Upsell |
| project3 | 购物车凑单 |
| project4 | B2B 批发 |
| giftdev2 | 购中阶梯赠品 |
| **Loyalty Pulse** | **留存 / 复购 / 积分运营** |
