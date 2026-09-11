import { createServer, type Server } from "node:http";
import { Client, Events, GatewayIntentBits } from "discord.js";
import { handleCommand } from "./commands/handlers.js";
import { registerCommands } from "./commands/register.js";
import { config } from "./config.js";
import { prisma } from "./db.js";
import { wardogsProvider } from "./providers/index.js";
import { syncAllLinkedPlayers } from "./services/player-service.js";

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

let discordReady = false;
let healthServer: Server | undefined;

function startHealthServer() {
  const port = Number(process.env.PORT ?? 3000);

  healthServer = createServer(async (request, response) => {
    if (request.url === "/health") {
      try {
        await prisma.$queryRawUnsafe("SELECT 1");
        const healthy = discordReady;
        response.statusCode = healthy ? 200 : 503;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({
          status: healthy ? "ok" : "starting",
          discord: discordReady ? "ready" : "not_ready",
          provider: wardogsProvider.name
        }));
      } catch (error) {
        response.statusCode = 503;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ status: "error", database: "unavailable" }));
        console.error("Health check database error", error);
      }
      return;
    }

    if (request.url === "/") {
      response.statusCode = 200;
      response.setHeader("content-type", "text/plain; charset=utf-8");
      response.end("PackRank is running.\n");
      return;
    }

    response.statusCode = 404;
    response.end("Not found\n");
  });

  healthServer.listen(port, "0.0.0.0", () => {
    console.log(`Health server listening on port ${port}`);
  });
}

client.once(Events.ClientReady, async readyClient => {
  discordReady = true;
  console.log(`Logged in as ${readyClient.user.tag}`);
  console.log(`WARDOGS provider: ${wardogsProvider.name}`);

  try {
    await registerCommands();
    console.log("Discord slash commands are registered.");
  } catch (error) {
    console.error("Failed to register Discord slash commands", error);
  }

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
  discordReady = false;
  client.destroy();

  if (healthServer) {
    await new Promise<void>(resolve => healthServer?.close(() => resolve()));
  }

  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

startHealthServer();
await client.login(config.DISCORD_TOKEN);
