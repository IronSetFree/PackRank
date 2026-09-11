export const metricChoices = [
  ["Hours Played", "hours"],
  ["Wardog Level", "level"],
  ["XP", "xp"],
  ["Cash", "cash"],
  ["Account Worth", "worth"],
  ["Kills", "kills"],
  ["Deaths", "deaths"],
  ["K/D", "kd"],
  ["Wins", "wins"],
  ["Win Rate", "winrate"],
  ["Unlocks", "unlocks"],
  ["Gold", "gold"],
  ["Assault", "assault"],
  ["Medic", "medic"],
  ["Recon", "recon"],
  ["Support", "support"],
  ["Driver", "driver"],
  ["Pilot", "pilot"],
  ["XP/min", "xpmin"],
  ["$/min", "cashmin"]
] as const;

export type Metric = (typeof metricChoices)[number][1];

export const metricLabel = (metric: Metric): string =>
  metricChoices.find(([, value]) => value === metric)?.[0] ?? metric;
