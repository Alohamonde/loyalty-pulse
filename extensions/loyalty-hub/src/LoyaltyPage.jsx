import {
  reactExtension,
  BlockStack,
  Text,
  Button,
  Card,
  InlineStack,
  TextField,
  useApi,
} from "@shopify/ui-extensions-react/customer-account";
import { useCallback, useEffect, useState } from "react";

export default reactExtension("customer-account.page.render", () => (
  <LoyaltyPage />
));

function LoyaltyPage() {
  const api = useApi();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [redeeming, setRedeeming] = useState(null);
  const [lastCode, setLastCode] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");

  const requestApi = useCallback(
    async (init = {}) => {
      const token = await api.sessionToken.get();
      const base = data?.config?.appApiBase;
      if (!base) {
        throw new Error("Missing app API base URL in loyalty config");
      }
      return fetch(`${base}/api/loyalty`, {
        ...init,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          ...(init.headers || {}),
        },
      });
    },
    [api.sessionToken, data?.config?.appApiBase],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await api.sessionToken.get();
      const bootstrapRes = await fetch("/api/loyalty", {
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => null);

      let response = bootstrapRes;
      if (!bootstrapRes?.ok) {
        const configOnly = await fetch("/api/loyalty", {
          headers: { Authorization: `Bearer ${token}` },
        });
        response = configOnly;
      }

      if (!response?.ok) {
        setData({ member: null, config: { pointsName: "积分" }, rewards: [] });
        return;
      }

      const json = await response.json();
      setData(json);

      if (json.config?.appApiBase && token) {
        const authed = await fetch(`${json.config.appApiBase}/api/loyalty`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (authed.ok) {
          const full = await authed.json();
          setData(full);
          if (full.member?.birthdayMonth) {
            setBirthMonth(String(full.member.birthdayMonth));
          }
          if (full.member?.birthdayDay) {
            setBirthDay(String(full.member.birthdayDay));
          }
          return;
        }
      }

      if (json.member?.birthdayMonth) {
        setBirthMonth(String(json.member.birthdayMonth));
      }
      if (json.member?.birthdayDay) {
        setBirthDay(String(json.member.birthdayDay));
      }
    } finally {
      setLoading(false);
    }
  }, [api.sessionToken]);

  useEffect(() => {
    load();
  }, [load]);

  async function redeem(rewardId) {
    setRedeeming(rewardId);
    try {
      const response = await requestApi({
        method: "POST",
        body: JSON.stringify({ action: "redeem", rewardId }),
      });
      const json = await response.json();
      if (json.code) {
        setLastCode(json.code);
        await load();
      }
    } finally {
      setRedeeming(null);
    }
  }

  async function saveBirthday() {
    await requestApi({
      method: "POST",
      body: JSON.stringify({
        action: "birthday",
        birthdayMonth: parseInt(birthMonth, 10),
        birthdayDay: parseInt(birthDay, 10),
      }),
    });
    await load();
  }

  if (loading) {
    return <Text>加载中…</Text>;
  }

  const pointsName = data?.config?.pointsName || "积分";
  const member = data?.member;
  const tier = data?.tierProgress?.current;

  return (
    <BlockStack spacing="loose">
      <Text size="large" emphasis="bold">
        我的{pointsName}
      </Text>

      {!member ? (
        <Card padding>
          <Text>完成首笔订单或注册后即可开始赚取{pointsName}。</Text>
        </Card>
      ) : (
        <>
          <Card padding>
            <BlockStack spacing="tight">
              <Text size="extraLarge" emphasis="bold">
                {member.pointsBalance} {pointsName}
              </Text>
              <Text>
                终身 {member.lifetimePoints} · VIP {tier?.name || "Member"}
                {tier?.earnMultiplier > 1 ? ` (${tier.earnMultiplier}x)` : ""}
              </Text>
              {data?.tierProgress?.next ? (
                <Text>
                  距 {data.tierProgress.next.name} 还差{" "}
                  {data.tierProgress.pointsToNext} {pointsName}
                </Text>
              ) : null}
            </BlockStack>
          </Card>

          <Card padding>
            <BlockStack spacing="tight">
              <Text emphasis="bold">推荐好友</Text>
              <Text>分享推荐码：{member.referralCode}</Text>
              <Text size="small">链接：/?ref={member.referralCode}</Text>
            </BlockStack>
          </Card>

          <Card padding>
            <BlockStack spacing="tight">
              <Text emphasis="bold">兑换奖励</Text>
              {lastCode ? (
                <Text>最新折扣码：{lastCode}（结账时使用）</Text>
              ) : null}
              {(data?.rewards || []).map((reward) => (
                <InlineStack
                  key={reward.id}
                  spacing="base"
                  blockAlignment="center"
                >
                  <Text>
                    {reward.name} — {reward.pointsCost} {pointsName}
                  </Text>
                  <Button
                    onPress={() => redeem(reward.id)}
                    loading={redeeming === reward.id}
                    disabled={member.pointsBalance < reward.pointsCost}
                  >
                    兑换
                  </Button>
                </InlineStack>
              ))}
            </BlockStack>
          </Card>

          <Card padding>
            <BlockStack spacing="tight">
              <Text emphasis="bold">生日设置</Text>
              <InlineStack spacing="tight">
                <TextField label="月" value={birthMonth} onChange={setBirthMonth} />
                <TextField label="日" value={birthDay} onChange={setBirthDay} />
              </InlineStack>
              <Button onPress={saveBirthday}>保存生日</Button>
            </BlockStack>
          </Card>

          <Card padding>
            <BlockStack spacing="tight">
              <Text emphasis="bold">近期流水</Text>
              {(data?.transactions || []).map((tx) => (
                <Text key={tx.id}>
                  {tx.source} {tx.delta > 0 ? "+" : ""}
                  {tx.delta} → 余额 {tx.balanceAfter}
                </Text>
              ))}
            </BlockStack>
          </Card>
        </>
      )}
    </BlockStack>
  );
}
