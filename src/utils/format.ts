import type { Metric } from "../metrics.js";

export function formatNumber(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatMoney(value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `$${formatNumber(value)}`;
}

export function formatHours(minutes: number | bigint | null | undefined): string {
  if (minutes === null || minutes === undefined) return "—";
  return `${(Number(minutes) / 60).toFixed(1)} h`;
}

export function formatMetric(metric: Metric, value: number | bigint | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (metric === "hours") return formatHours(value);
  if (metric === "cash" || metric === "worth" || metric === "cashmin") return formatMoney(value);
  if (metric === "kd") return Number(value).toFixed(2);
  if (metric === "winrate") return `${Number(value).toFixed(1)}%`;
  if (metric === "xpmin") return `${Number(value).toFixed(1)} XP/min`;
  return formatNumber(value);
}

export function kd(kills?: bigint | number | null, deaths?: bigint | number | null): number | null {
  if (kills === null || kills === undefined || deaths === null || deaths === undefined) return null;
  if (Number(deaths) === 0) return Number(kills);
  return Number(kills) / Number(deaths);
}

export function winRate(wins?: number | null, matches?: number | null): number | null {
  if (wins === null || wins === undefined || matches === null || matches === undefined || matches === 0) return null;
  return (wins / matches) * 100;
}
