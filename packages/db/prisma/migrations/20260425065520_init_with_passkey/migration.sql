-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "vibe_stack";

-- CreateTable
CREATE TABLE "vibe_stack"."VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "issuedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VerificationToken_pkey" PRIMARY KEY ("identifier")
);

-- CreateTable
CREATE TABLE "vibe_stack"."User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "image" TEXT,
    "lastLogin" TIMESTAMPTZ(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_stack"."Account" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_stack"."Passkey" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "credential_id" TEXT NOT NULL,
    "credential_public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "credential_device_type" TEXT NOT NULL,
    "credential_backed_up" BOOLEAN NOT NULL,
    "transports" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "name" TEXT,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Passkey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vibe_stack"."PasskeyChallenge" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "challenge" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasskeyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "vibe_stack"."User"("email");

-- CreateIndex
CREATE INDEX "Account_user_id_idx" ON "vibe_stack"."Account"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "vibe_stack"."Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Passkey_credential_id_key" ON "vibe_stack"."Passkey"("credential_id");

-- CreateIndex
CREATE INDEX "Passkey_user_id_idx" ON "vibe_stack"."Passkey"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "PasskeyChallenge_challenge_key" ON "vibe_stack"."PasskeyChallenge"("challenge");

-- CreateIndex
CREATE INDEX "PasskeyChallenge_user_id_idx" ON "vibe_stack"."PasskeyChallenge"("user_id");

-- AddForeignKey
ALTER TABLE "vibe_stack"."Account" ADD CONSTRAINT "Account_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vibe_stack"."Passkey" ADD CONSTRAINT "Passkey_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "vibe_stack"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
