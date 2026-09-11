import { prisma } from "../db.js";
import { config } from "../config.js";
import { wardogsProvider } from "../providers/index.js";
import type { PlayerStats } from "../providers/types.js";

export interface LinkPlayerResult {
  player: {
    id: bigint;
    providerPlayerId: string;
    displayName: string;
    createdAt: Date;
    updatedAt: Date;
  };
  statsCaptured: boolean;
}

export async function linkPlayer(guildId: string, discordUserId: string, query: string): Promise<LinkPlayerResult | null> {
  const identity = await wardogsProvider.resolvePlayer(query);
  if (!identity) return null;

  const player = await prisma.wardogsPlayer.upsert({
    where: { providerPlayerId: identity.id },
    create: { providerPlayerId: identity.id, displayName: identity.displayName },
    update: { displayName: identity.displayName }
  });

  const claimedBy = await prisma.discordLink.findUnique({
    where: { guildId_playerId: { guildId, playerId: player.id } }
  });
  if (claimedBy && claimedBy.discordUserId !== discordUserId) {
    throw new Error(`${identity.displayName} is already linked to another Discord member in this server.`);
  }

  await prisma.discordLink.upsert({
    where: { guildId_discordUserId: { guildId, discordUserId } },
    create: { guildId, discordUserId, playerId: player.id },
    update: { playerId: player.id, linkedAt: new Date() }
  });

  // A valid Steam identity should remain linked even when WARDOGS does not
  // publish user stats through Steam yet. Capture an initial snapshot when
  // possible, including Steam playtime-only snapshots.
  try {
    const initialStats = await wardogsProvider.getPlayerStats(identity.id);
    await saveStatsSnapshot(player.id, initialStats);
    return { player, statsCaptured: true };
  } catch (error) {
    console.warn(`Linked ${identity.id}, but initial WARDOGS stats were unavailable.`, error);
    return { player, statsCaptured: false };
  }
}

export async function unlinkPlayer(guildId: string, discordUserId: string): Promise<boolean> {
  const result = await prisma.discordLink.deleteMany({ where: { guildId, discordUserId } });
  return result.count > 0;
}

async function saveStatsSnapshot(playerDbId: bigint, stats: PlayerStats): Promise<void> {
  await prisma.$transaction([
    prisma.wardogsPlayer.update({
      where: { id: playerDbId },
      data: { displayName: stats.player.displayName }
    }),
    prisma.statSnapshot.create({
      data: {
        playerId: playerDbId,
        season: stats.season || config.WARDOGS_SEASON,
        capturedAt: stats.capturedAt,
        playtimeMinutes: stats.playtimeMinutes,
        wardogLevel: stats.wardogLevel,
        totalXp: stats.totalXp === undefined ? undefined : BigInt(stats.totalXp),
        cash: stats.cash === undefined ? undefined : BigInt(stats.cash),
        accountWorth: stats.accountWorth === undefined ? undefined : BigInt(stats.accountWorth),
        gold: stats.gold,
        unlocks: stats.unlocks,
        kills: stats.kills === undefined ? undefined : BigInt(stats.kills),
        deaths: stats.deaths === undefined ? undefined : BigInt(stats.deaths),
        matches: stats.matches,
        wins: stats.wins,
        assaultLevel: stats.assaultLevel,
        medicLevel: stats.medicLevel,
        reconLevel: stats.reconLevel,
        supportLevel: stats.supportLevel,
        driverLevel: stats.driverLevel,
        pilotLevel: stats.pilotLevel,
        xpPerMinute: stats.xpPerMinute,
        cashPerMinute: stats.cashPerMinute
      }
    })
  ]);
}

export async function syncPlayer(playerDbId: bigint, providerPlayerId: string): Promise<PlayerStats> {
  const stats = await wardogsProvider.getPlayerStats(providerPlayerId);
  await saveStatsSnapshot(playerDbId, stats);
  return stats;
}

export async function syncAllLinkedPlayers(): Promise<{ synced: number; failed: number }> {
  const players = await prisma.wardogsPlayer.findMany({
    where: { links: { some: {} } },
    select: { id: true, providerPlayerId: true }
  });

  let synced = 0;
  let failed = 0;

  for (const player of players) {
    try {
      await syncPlayer(player.id, player.providerPlayerId);
      synced++;
    } catch (error) {
      failed++;
      console.error(`Failed to sync ${player.providerPlayerId}`, error);
    }
  }

  return { synced, failed };
}

export async function getLinkedPlayer(guildId: string, discordUserId: string) {
  return prisma.discordLink.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId } },
    include: {
      player: {
        include: { snapshots: { orderBy: { capturedAt: "desc" }, take: 1 } }
      }
    }
  });
}

export async function getPlayerProgress(guildId: string, discordUserId: string, days: number) {
  const link = await prisma.discordLink.findUnique({
    where: { guildId_discordUserId: { guildId, discordUserId } },
    include: { player: true }
  });
  if (!link) return null;

  const now = new Date();
  const since = new Date(now.getTime() - days * 86_400_000);
  const [latest, start] = await Promise.all([
    prisma.statSnapshot.findFirst({ where: { playerId: link.playerId }, orderBy: { capturedAt: "desc" } }),
    prisma.statSnapshot.findFirst({
      where: { playerId: link.playerId, capturedAt: { gte: since } },
      orderBy: { capturedAt: "asc" }
    })
  ]);

  return { player: link.player, latest, start, days };
}
