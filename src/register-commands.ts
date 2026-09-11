import { REST, Routes } from "discord.js";
import { commandDefinitions } from "./commands/definitions.js";
import { config } from "./config.js";

const rest = new REST({ version: "10" }).setToken(config.DISCORD_TOKEN);
const body = commandDefinitions.map(command => command.toJSON());

await rest.put(
  Routes.applicationCommands(config.DISCORD_CLIENT_ID),
  { body }
);
console.log(`Deployed ${body.length} global commands.`);

if (config.DISCORD_GUILD_ID) {
  await rest.put(
    Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, config.DISCORD_GUILD_ID),
    { body }
  );
  console.log(`Deployed ${body.length} guild commands to ${config.DISCORD_GUILD_ID}.`);
}
