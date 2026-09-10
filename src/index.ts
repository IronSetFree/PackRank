import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleCommand } from "./commands/handlers.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { wardogsProvider } from "./providers/index.js";
import { syncAllLinkedPlayers } from "./services/player-service.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

client.once(Events.ClientReady, readyClient => {
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`WARDOGS provider: ${wardogsProvider.name}`);

  const intervalMs = config.SYNC_INTERVAL_MINUTES * 60_000;
  setInterval(async () => {
    const result = await syncAllLinkedPlayers();
    console.log(`WARDOGS sync: ${result.synced} synced, ${result.failed} failed`);
  }, intervalMs).unref();
});

client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  try {
    await handleCommand(interaction);
  } catch (error) {
    console.error(error);
    const message = error instanceof Error ? error.message : "Unexpected error";
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`⚠️ ${message}`).catch(() => undefined);
    } else {
      await interaction.reply({ content: `⚠️ ${message}`, ephemeral: true }).catch(() => undefined);
    }
  }
});

async function shutdown(signal: string) {
  console.log(`${signal} received; shutting down.`);
  client.destroy();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

await client.login(config.DISCORD_TOKEN);
