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
  InlineGrid,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { getOrCreateShopSettings } from "../models/points-ledger.server";
import { syncShopMetafield } from "../models/shop-metafield-sync.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const settings = await getOrCreateShopSettings(session.shop);
  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();

  const bonusEndsAtRaw = String(formData.get("bonusEndsAt") ?? "");
  const bonusMultiplier = parseFloat(
    String(formData.get("bonusMultiplier") ?? "1"),
  );

  await prisma.shopSettings.update({
    where: { shop: session.shop },
    data: {
      enabled: formData.get("enabled") === "on",
      pointsName: String(formData.get("pointsName") ?? "积分"),
      pointsPerCurrency: parseFloat(
        String(formData.get("pointsPerCurrency") ?? "10"),
      ),
      accentColor: String(formData.get("accentColor") ?? "#7C3AED"),
      bonusMultiplier,
      bonusEndsAt: bonusEndsAtRaw ? new Date(bonusEndsAtRaw) : null,
    },
  });

  await syncShopMetafield(admin, session.shop);
  return json({ ok: true });
};

export default function Settings() {
  const { settings } = useLoaderData<typeof loader>();
  const navigation = useNavigation();

  return (
    <Page title="设置">
      <TitleBar title="设置" />
      <Card>
        <Form method="post">
          <BlockStack gap="400">
            <Checkbox label="启用积分计划" name="enabled" checked={settings.enabled} />
            <TextField
              label="积分名称"
              name="pointsName"
              defaultValue={settings.pointsName}
              autoComplete="off"
            />
            <TextField
              label="每消费 $1 获得积分"
              name="pointsPerCurrency"
              type="number"
              defaultValue={String(settings.pointsPerCurrency)}
              autoComplete="off"
            />
            <TextField
              label="主题色"
              name="accentColor"
              defaultValue={settings.accentColor}
              autoComplete="off"
            />
            <InlineGrid columns={2} gap="300">
              <TextField
                label="限时活动倍率"
                name="bonusMultiplier"
                type="number"
                defaultValue={String(settings.bonusMultiplier)}
                autoComplete="off"
              />
              <TextField
                label="活动结束时间"
                name="bonusEndsAt"
                type="datetime-local"
                defaultValue={
                  settings.bonusEndsAt
                    ? new Date(settings.bonusEndsAt).toISOString().slice(0, 16)
                    : ""
                }
                autoComplete="off"
              />
            </InlineGrid>
            <Button submit variant="primary" loading={navigation.state !== "idle"}>
              保存并同步
            </Button>
          </BlockStack>
        </Form>
      </Card>
    </Page>
  );
}
