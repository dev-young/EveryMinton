import { ScheduleDetailClient } from "@/components/schedule/ScheduleDetailClient";

interface Props {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ViewSchedulePage({ params }: Props) {
  const resolvedParams = await params;
  return <ScheduleDetailClient scheduleId={resolvedParams.id} mode="view" />;
}
