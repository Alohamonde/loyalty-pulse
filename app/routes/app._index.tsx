import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineGrid,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getLoyaltyStats,
  syncShopMetafield,
} from "../models/shop-metafield-sync.server";
import {
  getOrCreateShopSettings,
  ensureDefaultEarnRules,
  ensureDefaultRewards,
  ensureDefaultVipTiers,
} from "../models/points-ledger.server";
import { getReferralStats } from "../models/referral.server";
import { getVipTiers } from "../models/vip.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;

  await Promise.all([
    getOrCreateShopSettings(shop),
    ensureDefaultEarnRules(shop),
    ensureDefaultRewards(shop),
    ensureDefaultVipTiers(shop),
  ]);

  const settings = await getOrCreateShopSettings(shop);

  if (!settings.onboardingComplete) {
    throw new Response(null, {
      status: 302,
      headers: { Location: "/app/onboarding" },
    });
  }

  await syncShopMetafield(admin, shop);

  const [stats, referralStats, tiers] = await Promise.all([
    getLoyaltyStats(shop),
    getReferralStats(shop),
    getVipTiers(shop),
  ]);

  const tierNameMap = Object.fromEntries(tiers.map((t) => [t.id, t.name]));

  return json({ stats, referralStats, tierNameMap, settings });
};

export default function Index() {
  const { stats, referralStats, tierNameMap, settings } =
    useLoaderData<typeof loader>();

  return (
    <Page title="Loyalty Pulse" subtitle="会员积分运营仪表盘">
      <TitleBar title="Loyalty Pulse" />
      <BlockStack gap="500">
        {!settings.enabled ? (
          <Banner tone="warning">
            <p>积分计划已暂停，买家将无法赚取或兑换积分。</p>
          </Banner>
        ) : null}

        <Layout>
          <Layout.Section>
            <InlineGrid columns={{ xs: 1, sm: 2, md: 3 }} gap="400">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    活跃会员
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.activeMembers}
                  </Text>
                  <Text as="p" tone="subdued">
                    共 {stats.memberCount} 名会员
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    累计发放积分
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.pointsIssued.toLocaleString()}
                  </Text>
                  <Text as="p" tone="subdued">
                    已兑换 {stats.pointsRedeemed.toLocaleString()}
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    推荐转化
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {referralStats.total}
                  </Text>
                  <Text as="p" tone="subdued">
                    近 30 天 {referralStats.recent30d} 次
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Loyalty Hub 访问
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.hubViews}
                  </Text>
                  <Text as="p" tone="subdued">
                    买家积分主页曝光
                  </Text>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    奖励兑换
                  </Text>
                  <Text as="p" variant="heading2xl">
                    {stats.redemptions}
                  </Text>
                  <Text as="p" tone="subdued">
                    动态折扣码已发放
                  </Text>
                </BlockStack>
              </Card>
            </InlineGrid>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  VIP 分布
                </Text>
                {stats.tierCounts.length === 0 ? (
                  <Text as="p" tone="subdued">
                    尚无会员数据
                  </Text>
                ) : (
                  stats.tierCounts.map((row) => (
                    <Text as="p" key={row.tierId ?? "none"}>
                      {row.tierId
                        ? (tierNameMap[row.tierId] ?? "未知等级")
                        : "未分级"}
                      ：{row._count} 人
                    </Text>
                  ))
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
