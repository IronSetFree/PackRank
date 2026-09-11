-- CreateTable
CREATE TABLE "TrackList" (
    "id" BIGSERIAL NOT NULL,
    "guildId" TEXT NOT NULL,
    "ownerDiscordUserId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrackList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrackListMember" (
    "id" BIGSERIAL NOT NULL,
    "listId" BIGINT NOT NULL,
    "playerId" BIGINT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrackListMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrackList_guildId_ownerDiscordUserId_name_key" ON "TrackList"("guildId", "ownerDiscordUserId", "name");

-- CreateIndex
CREATE INDEX "TrackList_guildId_ownerDiscordUserId_idx" ON "TrackList"("guildId", "ownerDiscordUserId");

-- CreateIndex
CREATE UNIQUE INDEX "TrackListMember_listId_playerId_key" ON "TrackListMember"("listId", "playerId");

-- CreateIndex
CREATE INDEX "TrackListMember_playerId_idx" ON "TrackListMember"("playerId");

-- AddForeignKey
ALTER TABLE "TrackListMember" ADD CONSTRAINT "TrackListMember_listId_fkey" FOREIGN KEY ("listId") REFERENCES "TrackList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrackListMember" ADD CONSTRAINT "TrackListMember_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "WardogsPlayer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
