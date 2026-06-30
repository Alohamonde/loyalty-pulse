import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  InlineGrid,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncShopMetafield } from "../models/shop-metafield-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const tiers = await prisma.vipTier.findMany({
    where: { shop: session.shop },
    orderBy: { sortOrder: "asc" },
  });
  return json({ tiers });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");

  await prisma.vipTier.update({
    where: { id },
    data: {
      name: String(formData.get("name") ?? ""),
      threshold: parseInt(String(formData.get("threshold") ?? "0"), 10),
      earnMultiplier: parseFloat(String(formData.get("earnMultiplier") ?? "1")),
      perks: String(formData.get("perks") ?? ""),
    },
  });

  await syncShopMetafield(admin, session.shop);
  return json({ ok: true });
};

export default function VipTiers() {
  const { tiers } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <Page title="VIP 等级">
      <TitleBar title="VIP 等级" />
      <BlockStack gap="400">
        <Text as="p" tone="subdued">
          按终身积分划分等级，高等级会员购物时获得倍率加成（非批发价折扣）。
        </Text>
        {tiers.map((tier) => (
          <Card key={tier.id}>
            <Form method="post">
              <input type="hidden" name="id" value={tier.id} />
              <BlockStack gap="300">
                <TextField
                  label="等级名称"
                  name="name"
                  defaultValue={tier.name}
                  autoComplete="off"
                />
                <InlineGrid columns={2} gap="300">
                  <TextField
                    label="门槛（终身积分）"
                    name="threshold"
                    type="number"
                    defaultValue={String(tier.threshold)}
                    autoComplete="off"
                  />
                  <TextField
                    label="赚取倍率"
                    name="earnMultiplier"
                    type="number"
                    defaultValue={String(tier.earnMultiplier)}
                    autoComplete="off"
                  />
                </InlineGrid>
                <TextField
                  label="权益说明"
                  name="perks"
                  defaultValue={tier.perks}
                  autoComplete="off"
                />
                <Button submit loading={navigation.state !== "idle"}>
                  保存
                </Button>
              </BlockStack>
            </Form>
          </Card>
        ))}
      </BlockStack>
    </Page>
  );
}
