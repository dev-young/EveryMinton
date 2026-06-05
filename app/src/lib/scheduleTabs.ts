export type ScheduleDetailTab = "courts" | "waiting" | "participants" | "settings" | "info";

export function normalizeScheduleDetailTab(
  tab: string | null | undefined,
  isReadOnly = false
): ScheduleDetailTab {
  if (tab === "waiting" || tab === "participants" || tab === "info") return tab;
  if (!isReadOnly && tab === "settings") return tab;
  return "courts";
}
