import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Form, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Card,
  BlockStack,
  TextField,
  Button,
  DataTable,
  Text,
  InlineGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState } from "react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { adjustPoints } from "../models/points-ledger.server";
import { syncMemberTierWithMetafield } from "../models/vip.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  const members = await prisma.loyaltyMember.findMany({
    where: {
      shop: session.shop,
      ...(q
        ? {
            OR: [
              { email: { contains: q } },
              { referralCode: { contains: q.toUpperCase() } },
            ],
          }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
    include: {
      transactions: { orderBy: { createdAt: "desc" }, take: 5 },
    },
  });

  return json({ members, q });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const memberId = String(formData.get("memberId") ?? "");
  const delta = parseInt(String(formData.get("delta") ?? "0"), 10);
  const note = String(formData.get("note") ?? "商家手动调账");

  await adjustPoints({
    shop: session.shop,
    memberId,
    delta,
    note,
  });

  await syncMemberTierWithMetafield(admin, session.shop, memberId);
  return json({ ok: true });
};

export default function Members() {
  const { members, q } = useLoaderData<typeof loader>();
  const navigation = useNavigation();
  const [search, setSearch] = useState(q);

  return (
    <Page title="会员管理">
      <TitleBar title="会员管理" />
      <BlockStack gap="400">
        <Card>
          <Form method="get">
            <InlineGrid columns={["twoThirds", "oneThird"]} gap="300">
              <TextField
                label="搜索邮箱或推荐码"
                name="q"
                value={search}
                onChange={setSearch}
                autoComplete="off"
              />
              <Button submit>搜索</Button>
            </InlineGrid>
          </Form>
        </Card>

        {members.map((member) => (
          <Card key={member.id}>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">
                {member.email || member.customerId}
              </Text>
              <Text as="p">
                余额 {member.pointsBalance} · 终身 {member.lifetimePoints} ·
                推荐码 {member.referralCode}
              </Text>
              <Form method="post">
                <input type="hidden" name="memberId" value={member.id} />
                <InlineGrid columns={3} gap="300">
                  <TextField
                    label="调整积分（可负数）"
                    name="delta"
                    type="number"
                    defaultValue="0"
                    autoComplete="off"
                  />
                  <TextField
                    label="备注"
                    name="note"
                    defaultValue="商家手动调账"
                    autoComplete="off"
                  />
                  <Button submit loading={navigation.state !== "idle"}>
                    调账
                  </Button>
                </InlineGrid>
              </Form>
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["时间", "类型", "变动", "余额"]}
                rows={member.transactions.map((tx) => [
                  new Date(tx.createdAt).toLocaleString(),
                  tx.source,
                  String(tx.delta),
                  String(tx.balanceAfter),
                ])}
              />
            </BlockStack>
          </Card>
        ))}
      </BlockStack>
    </Page>
  );
}
