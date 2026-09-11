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
    .addStringOption(o => o.setName("player").setDescription("Player ID; SteamID64/profile URL when using Steam").setRequired(true)),

  new SlashCommandBuilder()
    .setName("unlink")
    .setDescription("Remove your WARDOGS link from this Discord server"),

  new SlashCommandBuilder()
    .setName("stats")
    .setDescription("Show latest WARDOGS stats for a linked member or one of your lists")
    .addUserOption(o => o.setName("member").setDescription("Discord member; defaults to you when no list is supplied"))
    .addStringOption(o => o.setName("list").setDescription("Your tracking list to show").setMaxLength(32)),

  new SlashCommandBuilder()
    .setName("hours")
    .setDescription("Show a linked player's WARDOGS hours played on Steam")
    .addUserOption(o => o.setName("member").setDescription("Discord member; defaults to you")),

  new SlashCommandBuilder()
    .setName("list")
    .setDescription("Create and manage named WARDOGS player tracking lists")
    .addSubcommand(s => s
      .setName("create")
      .setDescription("Create a tracking list")
      .addStringOption(o => o.setName("name").setDescription("List name").setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s
      .setName("add")
      .setDescription("Add a Steam player to a tracking list")
      .addStringOption(o => o.setName("name").setDescription("List name").setRequired(true).setMaxLength(32))
      .addStringOption(o => o.setName("player").setDescription("SteamID64, Steam profile URL, or vanity name").setRequired(true)))
    .addSubcommand(s => s
      .setName("remove")
      .setDescription("Remove a player from a tracking list")
      .addStringOption(o => o.setName("name").setDescription("List name").setRequired(true).setMaxLength(32))
      .addStringOption(o => o.setName("player").setDescription("SteamID64, Steam profile URL, or exact tracked name").setRequired(true)))
    .addSubcommand(s => s
      .setName("show")
      .setDescription("Show the players in one tracking list")
      .addStringOption(o => o.setName("name").setDescription("List name").setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s
      .setName("sync")
      .setDescription("Refresh every player in one tracking list")
      .addStringOption(o => o.setName("name").setDescription("List name").setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s
      .setName("delete")
      .setDescription("Delete one of your tracking lists")
      .addStringOption(o => o.setName("name").setDescription("List name").setRequired(true).setMaxLength(32)))
    .addSubcommand(s => s
      .setName("all")
      .setDescription("Show all of your tracking lists")),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Rank WARDOGS players by Discord server, tracking list, or global scope")
    .addStringOption(addMetric)
    .addStringOption(o => o.setName("scope").setDescription("Leaderboard scope").addChoices(
      { name: "Discord server", value: "server" },
      { name: "Tracking list", value: "list" },
      { name: "Global", value: "global" }
    ).setRequired(true))
    .addStringOption(o => o.setName("list").setDescription("Your tracking list; required when scope is Tracking list").setMaxLength(32))
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
