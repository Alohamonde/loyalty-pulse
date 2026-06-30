import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  TextField,
  Button,
  Text,
  ProgressBar,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useEffect, useState } from "react";
import { authenticate } from "../shopify.server";
import {
  ensureDefaultEarnRules,
  ensureDefaultRewards,
  ensureDefaultVipTiers,
  getOrCreateShopSettings,
} from "../models/points-ledger.server";
import { syncShopMetafield } from "../models/shop-metafield-sync.server";
import prisma from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  await Promise.all([
    getOrCreateShopSettings(shop),
    ensureDefaultEarnRules(shop),
    ensureDefaultRewards(shop),
    ensureDefaultVipTiers(shop),
  ]);

  const settings = await getOrCreateShopSettings(shop);
  if (settings.onboardingComplete) {
    return redirect("/app");
  }

  return json({ settings });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const step = Number(formData.get("step") ?? 1);

  if (step === 1) {
    const pointsName = String(formData.get("pointsName") ?? "积分");
    await prisma.shopSettings.update({
      where: { shop },
      data: { pointsName },
    });
    return json({ step: 2, ok: true });
  }

  if (step === 2) {
    const pointsPerCurrency = parseFloat(
      String(formData.get("pointsPerCurrency") ?? "10"),
    );
    await prisma.shopSettings.update({
      where: { shop },
      data: { pointsPerCurrency },
    });
    return json({ step: 3, ok: true });
  }

  if (step === 3) {
    await prisma.shopSettings.update({
      where: { shop },
      data: { onboardingComplete: true, enabled: true },
    });
    await syncShopMetafield(admin, shop);
    return redirect("/app");
  }

  return json({ error: "Invalid step" }, { status: 400 });
};

export default function Onboarding() {
  const { settings } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const [pointsName, setPointsName] = useState(settings.pointsName);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(
    String(settings.pointsPerCurrency),
  );

  useEffect(() => {
    if (actionData && "step" in actionData && actionData.step) {
      setStep(actionData.step);
    }
  }, [actionData]);

  const busy = navigation.state !== "idle";
  const progress = (step / 3) * 100;

  return (
    <Page title="启动积分计划" narrowWidth>
      <TitleBar title="启动向导" />
      <BlockStack gap="500">
        <ProgressBar progress={progress} size="small" />
        <Banner tone="info">
          <p>
            3 步完成积分计划上线。与转化类 App 不同，Loyalty Pulse
            专注会员留存与复购。
          </p>
        </Banner>

        {step === 1 ? (
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="step" value="1" />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      第 1 步：命名你的积分
                    </Text>
                    <TextField
                      label="积分名称"
                      name="pointsName"
                      value={pointsName}
                      onChange={setPointsName}
                      autoComplete="off"
                    />
                    <Button submit variant="primary" loading={busy}>
                      下一步
                    </Button>
                  </BlockStack>
                </Form>
              </Card>
            </Layout.Section>
          </Layout>
        ) : null}

        {step === 2 ? (
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="step" value="2" />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      第 2 步：设置购物返点
                    </Text>
                    <TextField
                      label="每消费 $1 获得积分"
                      name="pointsPerCurrency"
                      type="number"
                      value={pointsPerCurrency}
                      onChange={setPointsPerCurrency}
                      autoComplete="off"
                    />
                    <Button submit variant="primary" loading={busy}>
                      下一步
                    </Button>
                  </BlockStack>
                </Form>
              </Card>
            </Layout.Section>
          </Layout>
        ) : null}

        {step === 3 ? (
          <Layout>
            <Layout.Section>
              <Card>
                <Form method="post">
                  <input type="hidden" name="step" value="3" />
                  <BlockStack gap="400">
                    <Text as="h2" variant="headingMd">
                      第 3 步：发布计划
                    </Text>
                    <Text as="p" tone="subdued">
                      将同步默认 VIP 等级与兑换奖励，并写入店面 Metafield。
                      买家主入口为 Customer Account Loyalty Hub。
                    </Text>
                    <Button submit variant="primary" loading={busy}>
                      发布积分计划
                    </Button>
                  </BlockStack>
                </Form>
              </Card>
            </Layout.Section>
          </Layout>
        ) : null}
      </BlockStack>
    </Page>
  );
}
