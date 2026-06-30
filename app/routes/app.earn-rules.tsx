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
  DataTable,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncShopMetafield } from "../models/shop-metafield-sync.server";
import { EARN_RULE_LABELS, type EarnRuleType } from "../constants";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const rules = await prisma.earnRule.findMany({
    where: { shop: session.shop },
    orderBy: { type: "asc" },
  });
  return json({ rules });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const id = String(formData.get("id") ?? "");

  const rule = await prisma.earnRule.findFirst({
    where: { id, shop: session.shop },
  });
  if (!rule) {
    return json({ error: "Not found" }, { status: 404 });
  }

  await prisma.earnRule.update({
    where: { id },
    data: {
      enabled: formData.get("enabled") === "on",
      points: parseInt(String(formData.get("points") ?? rule.points), 10),
      description: String(formData.get("description") ?? rule.description),
    },
  });

  await syncShopMetafield(admin, session.shop);
  return json({ ok: true });
};

export default function EarnRules() {
  const { rules } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <Page title="赚取规则">
      <TitleBar title="赚取规则" />
      <BlockStack gap="400">
        {rules.map((rule) => (
          <Card key={rule.id}>
            <Form method="post">
              <input type="hidden" name="id" value={rule.id} />
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  {EARN_RULE_LABELS[rule.type as EarnRuleType] ?? rule.type}
                </Text>
                <Checkbox
                  label="启用"
                  name="enabled"
                  checked={rule.enabled}
                  onChange={() => {}}
                  value="on"
                />
                {rule.type !== "purchase" ? (
                  <TextField
                    label="奖励积分"
                    name="points"
                    type="number"
                    defaultValue={String(rule.points)}
                    autoComplete="off"
                  />
                ) : (
                  <Text as="p" tone="subdued">
                    购物返点比率请在「设置」或启动向导中配置（每 $1 =
                    N 积分）。
                  </Text>
                )}
                <TextField
                  label="说明"
                  name="description"
                  defaultValue={rule.description}
                  autoComplete="off"
                />
                <Button submit loading={navigation.state !== "idle"}>
                  保存
                </Button>
              </BlockStack>
            </Form>
          </Card>
        ))}

        <Card>
          <DataTable
            columnContentTypes={["text", "text", "text"]}
            headings={["类型", "状态", "说明"]}
            rows={rules.map((rule) => [
              EARN_RULE_LABELS[rule.type as EarnRuleType] ?? rule.type,
              rule.enabled ? "启用" : "停用",
              rule.description,
            ])}
          />
        </Card>
      </BlockStack>
    </Page>
  );
}
