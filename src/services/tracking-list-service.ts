import { prisma } from "../db.js";
import { wardogsProvider } from "../providers/index.js";
import { syncPlayer } from "./player-service.js";

const MAX_PLAYERS_PER_LIST = 50;

function normalizeListName(name: string): string {
  const normalized = name.trim().toLowerCase();
  if (!normalized) throw new Error("List name cannot be empty.");
  if (normalized.length > 32) throw new Error("List names can be at most 32 characters.");
  return normalized;
}

async function getOwnedList(guildId: string, ownerDiscordUserId: string, name: string) {
  return prisma.trackList.findUnique({
    where: {
      guildId_ownerDiscordUserId_name: {
        guildId,
        ownerDiscordUserId,
        name: normalizeListName(name)
      }
    }
  });
}

export async function createTrackingList(guildId: string, ownerDiscordUserId: string, name: string) {
  const normalizedName = normalizeListName(name);
  const existing = await getOwnedList(guildId, ownerDiscordUserId, normalizedName);
  if (existing) throw new Error(`You already have a tracking list named **${normalizedName}**.`);

  return prisma.trackList.create({
    data: { guildId, ownerDiscordUserId, name: normalizedName }
  });
}

export async function listTrackingLists(guildId: string, ownerDiscordUserId: string) {
  return prisma.trackList.findMany({
    where: { guildId, ownerDiscordUserId },
    include: { _count: { select: { members: true } } },
    orderBy: { name: "asc" }
  });
}

export async function addPlayerToTrackingList(
  guildId: string,
  ownerDiscordUserId: string,
  listName: string,
  query: string
) {
  const list = await getOwnedList(guildId, ownerDiscordUserId, listName);
  if (!list) throw new Error(`You don't have a tracking list named **${normalizeListName(listName)}**.`);

  const identity = await wardogsProvider.resolvePlayer(query);
  if (!identity) throw new Error(`I couldn't resolve **${query}** to a Steam player.`);

  const player = await prisma.wardogsPlayer.upsert({
    where: { providerPlayerId: identity.id },
    create: { providerPlayerId: identity.id, displayName: identity.displayName },
    update: { displayName: identity.displayName }
  });

  const existing = await prisma.trackListMember.findUnique({
    where: { listId_playerId: { listId: list.id, playerId: player.id } }
  });
  if (existing) return { player, alreadyTracked: true, synced: false };

  const memberCount = await prisma.trackListMember.count({ where: { listId: list.id } });
  if (memberCount >= MAX_PLAYERS_PER_LIST) {
    throw new Error(`Tracking lists are limited to ${MAX_PLAYERS_PER_LIST} players.`);
  }

  await prisma.trackListMember.create({
    data: { listId: list.id, playerId: player.id }
  });

  let synced = false;
  try {
    await syncPlayer(player.id, player.providerPlayerId);
    synced = true;
  } catch (error) {
    console.warn(`Added ${player.providerPlayerId} to tracking list ${list.id}, but the initial sync failed.`, error);
  }

  return { player, alreadyTracked: false, synced };
}

export async function removePlayerFromTrackingList(
  guildId: string,
  ownerDiscordUserId: string,
  listName: string,
  query: string
): Promise<string | null> {
  const list = await prisma.trackList.findUnique({
    where: {
      guildId_ownerDiscordUserId_name: {
        guildId,
        ownerDiscordUserId,
        name: normalizeListName(listName)
      }
    },
    include: { members: { include: { player: true } } }
  });
  if (!list) throw new Error(`You don't have a tracking list named **${normalizeListName(listName)}**.`);

  const normalizedQuery = query.trim().toLowerCase();
  let member = list.members.find(entry =>
    entry.player.providerPlayerId === query.trim() ||
    entry.player.displayName.toLowerCase() === normalizedQuery
  );

  if (!member) {
    try {
      const identity = await wardogsProvider.resolvePlayer(query);
      if (identity) member = list.members.find(entry => entry.player.providerPlayerId === identity.id);
    } catch {
      // Fall back to the local list lookup above.
    }
  }

  if (!member) return null;
  await prisma.trackListMember.delete({ where: { id: member.id } });
  return member.player.displayName;
}

export async function deleteTrackingList(guildId: string, ownerDiscordUserId: string, name: string): Promise<boolean> {
  const list = await getOwnedList(guildId, ownerDiscordUserId, name);
  if (!list) return false;
  await prisma.trackList.delete({ where: { id: list.id } });
  return true;
}

export async function getTrackingList(guildId: string, ownerDiscordUserId: string, name: string) {
  return prisma.trackList.findUnique({
    where: {
      guildId_ownerDiscordUserId_name: {
        guildId,
        ownerDiscordUserId,
        name: normalizeListName(name)
      }
    },
    include: {
      members: {
        include: {
          player: {
            include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } }
          }
        },
        orderBy: { addedAt: "asc" }
      }
    }
  });
}

export async function syncTrackingList(guildId: string, ownerDiscordUserId: string, name: string) {
  const list = await prisma.trackList.findUnique({
    where: {
      guildId_ownerDiscordUserId_name: {
        guildId,
        ownerDiscordUserId,
        name: normalizeListName(name)
      }
    },
    include: { members: { include: { player: true } } }
  });
  if (!list) throw new Error(`You don't have a tracking list named **${normalizeListName(name)}**.`);

  let synced = 0;
  let failed = 0;
  for (const member of list.members) {
    try {
      await syncPlayer(member.player.id, member.player.providerPlayerId);
      synced++;
    } catch (error) {
      failed++;
      console.warn(`Failed to sync tracked player ${member.player.providerPlayerId}.`, error);
    }
  }

  return { listName: list.name, total: list.members.length, synced, failed };
}
