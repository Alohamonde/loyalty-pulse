import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  Checkbox,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getReferralStats } from "../models/referral.server";
import { syncShopMetafield } from "../models/shop-metafield-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const [settings, stats] = await Promise.all([
    prisma.shopSettings.findUniqueOrThrow({ where: { shop: session.shop } }),
    getReferralStats(session.shop),
  ]);
  return json({ settings, stats });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  await prisma.shopSettings.update({
    where: { shop: session.shop },
    data: {
      referralEnabled: formData.get("referralEnabled") === "on",
      referrerPoints: parseInt(String(formData.get("referrerPoints") ?? "500"), 10),
      refereePoints: parseInt(String(formData.get("refereePoints") ?? "200"), 10),
    },
  });

  await syncShopMetafield(admin, session.shop);
  return json({ ok: true });
};

export default function Referrals() {
  const { settings, stats } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <Page title="推荐计划">
      <TitleBar title="推荐计划" />
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="200">
            <Text as="h2" variant="headingMd">
              推荐统计
            </Text>
            <Text as="p">累计转化：{stats.total}</Text>
            <Text as="p">近 30 天：{stats.recent30d}</Text>
            <Text as="p" tone="subdued">
              推荐链接格式：你的店铺域名/?ref=会员推荐码
            </Text>
          </BlockStack>
        </Card>

        <Card>
          <Form method="post">
            <BlockStack gap="300">
              <Checkbox
                label="启用推荐计划"
                name="referralEnabled"
                checked={settings.referralEnabled}
              />
              <TextField
                label="推荐人奖励积分"
                name="referrerPoints"
                type="number"
                defaultValue={String(settings.referrerPoints)}
                autoComplete="off"
              />
              <TextField
                label="被推荐人首单奖励积分"
                name="refereePoints"
                type="number"
                defaultValue={String(settings.refereePoints)}
                autoComplete="off"
              />
              <Button submit variant="primary" loading={navigation.state !== "idle"}>
                保存
              </Button>
            </BlockStack>
          </Form>
        </Card>
      </BlockStack>
    </Page>
  );
}
