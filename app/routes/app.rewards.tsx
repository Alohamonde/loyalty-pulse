import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  Select,
  Checkbox,
  InlineGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncShopMetafield } from "../models/shop-metafield-sync.server";
import { REWARD_TYPE_LABELS, REWARD_TYPES, type RewardType } from "../constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rewards = await prisma.reward.findMany({
    where: { shop: session.shop },
    orderBy: { pointsCost: "asc" },
  });
  return json({ rewards });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "save");

  if (intent === "create") {
    await prisma.reward.create({
      data: {
        shop: session.shop,
        name: String(formData.get("name") ?? "新奖励"),
        type: String(formData.get("type") ?? "fixed_amount"),
        pointsCost: parseInt(String(formData.get("pointsCost") ?? "1000"), 10),
        discountValue: parseFloat(String(formData.get("discountValue") ?? "10")),
      },
    });
  } else {
    const id = String(formData.get("id") ?? "");
    await prisma.reward.update({
      where: { id },
      data: {
        enabled: formData.get("enabled") === "on",
        name: String(formData.get("name") ?? ""),
        pointsCost: parseInt(String(formData.get("pointsCost") ?? "0"), 10),
        discountValue: parseFloat(String(formData.get("discountValue") ?? "0")),
      },
    });
  }

  await syncShopMetafield(admin, session.shop);
  return json({ ok: true });
};

export default function Rewards() {
  const { rewards } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <Page title="兑换奖励">
      <TitleBar title="兑换奖励" />
      <BlockStack gap="400">
        <Card>
          <Form method="post">
            <input type="hidden" name="intent" value="create" />
            <BlockStack gap="300">
              <TextField label="奖励名称" name="name" autoComplete="off" />
              <Select
                label="类型"
                name="type"
                options={REWARD_TYPES.map((type) => ({
                  label: REWARD_TYPE_LABELS[type],
                  value: type,
                }))}
              />
              <InlineGrid columns={2} gap="300">
                <TextField
                  label="所需积分"
                  name="pointsCost"
                  type="number"
                  defaultValue="1000"
                  autoComplete="off"
                />
                <TextField
                  label="折扣值（金额或 %）"
                  name="discountValue"
                  type="number"
                  defaultValue="10"
                  autoComplete="off"
                />
              </InlineGrid>
              <Button submit variant="primary" loading={navigation.state !== "idle"}>
                添加奖励
              </Button>
            </BlockStack>
          </Form>
        </Card>

        {rewards.map((reward) => (
          <Card key={reward.id}>
            <Form method="post">
              <input type="hidden" name="id" value={reward.id} />
              <BlockStack gap="300">
                <Checkbox label="启用" name="enabled" checked={reward.enabled} />
                <TextField
                  label="名称"
                  name="name"
                  defaultValue={reward.name}
                  autoComplete="off"
                />
                <TextField
                  label="所需积分"
                  name="pointsCost"
                  type="number"
                  defaultValue={String(reward.pointsCost)}
                  autoComplete="off"
                />
                <TextField
                  label="折扣值"
                  name="discountValue"
                  type="number"
                  defaultValue={String(reward.discountValue)}
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
