import { ScheduleDetailClient } from "@/components/schedule/ScheduleDetailClient";

interface Props {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ tab?: string }> | { tab?: string };
}

export default async function ViewSchedulePage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const initialTab = resolvedSearchParams.tab === "participants" ? "participants" : undefined;

  return <ScheduleDetailClient scheduleId={resolvedParams.id} mode="view" initialTab={initialTab} />;
}
