import { SlashCommandBuilder } from "discord.js";
import { metricChoices } from "../metrics.js";

const addMetric = (option: any) => option
  .setName("metric")
  .setDescription("Statistic to rank")
  .setRequired(true)
  .addChoices(...metricChoices.map(([name, value]) => ({ name, value })));

export const commandDefinitions = [
  new SlashCommandBuilder()
    .setName("link")
    .setDescription("Link your Discord account to a WARDOGS player")
    .addStringOption(o => o.setName("player").setDescription("WARDOGS player name").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Remove your WARDOGS link from this Discord server"),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show a linked player's latest WARDOGS stats")
    .addUserOption(o => o.setName("member").setDescription("Discord member; defaults to you")),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Show the Discord-server or global WARDOGS leaderboard")
    .addStringOption(addMetric)
    .addStringOption(o => o.setName("scope").setDescription("Leaderboard scope").addChoices(
      { name: "Discord server", value: "server" },
      { name: "Global", value: "global" }
    ).setRequired(true))
    .addIntegerOption(o => o.setName("limit").setDescription("Number of players (1-25)").setMinValue(1).setMaxValue(25)),

  new SlashCommandBuilder()
    .setName("rank")
    .setDescription("Show a member's Discord-server and global rank for one metric")
    .addStringOption(addMetric)
    .addUserOption(o => o.setName("member").setDescription("Discord member; defaults to you")),

  new SlashCommandBuilder()
    .setName("compare")
    .setDescription("Compare two linked Discord members")
    .addUserOption(o => o.setName("member").setDescription("Member to compare against yourself").setRequired(true)),

  new SlashCommandBuilder()
    .setName("progress")
    .setDescription("Show stat gains over a recent period")
    .addUserOption(o => o.setName("member").setDescription("Discord member; defaults to you"))
    .addIntegerOption(o => o.setName("days").setDescription("Lookback window").setMinValue(1).setMaxValue(90)),

  new SlashCommandBuilder()
    .setName("sync")
    .setDescription("Refresh your linked WARDOGS stats now")
] as const;
