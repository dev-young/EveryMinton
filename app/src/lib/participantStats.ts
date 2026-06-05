import { Participant, Schedule } from "@/types";

export function getScheduleStatReferenceAt(schedule: Schedule, now: Date = new Date()): Date {
  if (schedule.status !== "completed") return now;
  return getScheduleEndAt(schedule);
}

export function shouldShowWaitingTime(schedule: Schedule): boolean {
  return schedule.status !== "completed";
}

export function calculateGamesPerHour(participant: Participant, referenceAt: Date = new Date()): number {
  if (!participant.joinedAt) return 0;

  const minutesElapsed = (referenceAt.getTime() - participant.joinedAt.getTime()) / 60000;
  if (minutesElapsed <= 0) return 0;

  return (participant.gamesPlayed / minutesElapsed) * 60;
}

export function calculateWaitMinutes(participant: Participant, referenceAt: Date = new Date()): number {
  const reference = participant.lastGameEndedAt ?? participant.joinedAt;
  if (!reference) return 0;

  return Math.max(0, Math.floor((referenceAt.getTime() - reference.getTime()) / 60000));
}

function getScheduleEndAt(schedule: Schedule): Date {
  return new Date(`${schedule.date}T${schedule.endTime}:00`);
}
