-- CreateTable
CREATE TABLE "WardogsPlayer" (
    "id" BIGSERIAL NOT NULL,
    "providerPlayerId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WardogsPlayer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscordLink" (
    "id" BIGSERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "discordUserId" TEXT NOT NULL,
    "playerId" BIGINT NOT NULL,
    "linkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscordLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StatSnapshot" (
    "id" BIGSERIAL NOT NULL,
    "playerId" BIGINT NOT NULL,
    "season" TEXT NOT NULL,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "wardogLevel" INTEGER,
    "totalXp" BIGINT,
    "cash" BIGINT,
    "accountWorth" BIGINT,
    "gold" INTEGER,
    "unlocks" INTEGER,
    "kills" BIGINT,
    "deaths" BIGINT,
    "matches" INTEGER,
    "wins" INTEGER,
    "assaultLevel" INTEGER,
    "medicLevel" INTEGER,
    "reconLevel" INTEGER,
    "supportLevel" INTEGER,
    "driverLevel" INTEGER,
    "pilotLevel" INTEGER,
    "xpPerMinute" DOUBLE PRECISION,
    "cashPerMinute" DOUBLE PRECISION,

    CONSTRAINT "StatSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GlobalRank" (
    "id" BIGSERIAL NOT NULL,
    "playerId" BIGINT NOT NULL,
    "season" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPlayers" INTEGER,
    "source" TEXT NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GlobalRank_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WardogsPlayer_providerPlayerId_key" ON "WardogsPlayer"("providerPlayerId");

-- CreateIndex
CREATE INDEX "WardogsPlayer_displayName_idx" ON "WardogsPlayer"("displayName");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLink_guildId_discordUserId_key" ON "DiscordLink"("guildId", "discordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "DiscordLink_guildId_playerId_key" ON "DiscordLink"("guildId", "playerId");

-- CreateIndex
CREATE INDEX "DiscordLink_playerId_idx" ON "DiscordLink"("playerId");

-- CreateIndex
CREATE INDEX "StatSnapshot_playerId_capturedAt_idx" ON "StatSnapshot"("playerId", "capturedAt" DESC);

-- CreateIndex
CREATE INDEX "StatSnapshot_season_capturedAt_idx" ON "StatSnapshot"("season", "capturedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GlobalRank_playerId_season_metric_source_key" ON "GlobalRank"("playerId", "season", "metric", "source");

-- CreateIndex
CREATE INDEX "GlobalRank_season_metric_rank_idx" ON "GlobalRank"("season", "metric", "rank");

-- AddForeignKey
ALTER TABLE "DiscordLink" ADD CONSTRAINT "DiscordLink_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WardogsPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StatSnapshot" ADD CONSTRAINT "StatSnapshot_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WardogsPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GlobalRank" ADD CONSTRAINT "GlobalRank_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WardogsPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
