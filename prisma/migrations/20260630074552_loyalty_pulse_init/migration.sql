-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "pointsName" TEXT NOT NULL DEFAULT '积分',
    "pointsPerCurrency" REAL NOT NULL DEFAULT 10,
    "onboardingComplete" BOOLEAN NOT NULL DEFAULT false,
    "accentColor" TEXT NOT NULL DEFAULT '#7C3AED',
    "referralEnabled" BOOLEAN NOT NULL DEFAULT true,
    "referrerPoints" INTEGER NOT NULL DEFAULT 500,
    "refereePoints" INTEGER NOT NULL DEFAULT 200,
    "bonusMultiplier" REAL NOT NULL DEFAULT 1,
    "bonusEndsAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EarnRule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "points" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Reward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pointsCost" INTEGER NOT NULL,
    "discountValue" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "VipTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "threshold" INTEGER NOT NULL,
    "earnMultiplier" REAL NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "perks" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LoyaltyMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "pointsBalance" INTEGER NOT NULL DEFAULT 0,
    "lifetimePoints" INTEGER NOT NULL DEFAULT 0,
    "tierId" TEXT,
    "referralCode" TEXT NOT NULL,
    "referredByMemberId" TEXT,
    "birthdayMonth" INTEGER,
    "birthdayDay" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PointTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "memberId" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "source" TEXT NOT NULL,
    "earnRuleId" TEXT,
    "rewardId" TEXT,
    "orderId" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "idempotencyKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointTransaction_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "LoyaltyMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReferralEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "referrerMemberId" TEXT NOT NULL,
    "refereeMemberId" TEXT NOT NULL,
    "orderId" TEXT,
    "referrerPoints" INTEGER NOT NULL,
    "refereePoints" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LoyaltyEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "memberId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "EarnRule_shop_idx" ON "EarnRule"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "EarnRule_shop_type_key" ON "EarnRule"("shop", "type");

-- CreateIndex
CREATE INDEX "Reward_shop_idx" ON "Reward"("shop");

-- CreateIndex
CREATE INDEX "VipTier_shop_idx" ON "VipTier"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyMember_referralCode_key" ON "LoyaltyMember"("referralCode");

-- CreateIndex
CREATE INDEX "LoyaltyMember_shop_idx" ON "LoyaltyMember"("shop");

-- CreateIndex
CREATE UNIQUE INDEX "LoyaltyMember_shop_customerId_key" ON "LoyaltyMember"("shop", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "PointTransaction_idempotencyKey_key" ON "PointTransaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PointTransaction_memberId_idx" ON "PointTransaction"("memberId");

-- CreateIndex
CREATE INDEX "PointTransaction_shop_orderId_idx" ON "PointTransaction"("shop", "orderId");

-- CreateIndex
CREATE INDEX "ReferralEvent_shop_idx" ON "ReferralEvent"("shop");

-- CreateIndex
CREATE INDEX "LoyaltyEvent_shop_eventType_idx" ON "LoyaltyEvent"("shop", "eventType");
