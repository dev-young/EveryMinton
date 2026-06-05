import { ScheduleDetailClient } from "@/components/schedule/ScheduleDetailClient";
import { normalizeScheduleDetailTab } from "@/lib/scheduleTabs";

interface Props {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function ScheduleDetailPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTab = normalizeScheduleDetailTab(resolvedSearchParams.tab);

  return <ScheduleDetailClient scheduleId={resolvedParams.id} mode="admin" initialTab={initialTab} />;
}
