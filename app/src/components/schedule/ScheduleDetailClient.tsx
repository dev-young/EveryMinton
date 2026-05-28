"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Game, Member, MatchingPriority, Participant, Schedule } from "@/types";
import { gameRepository, memberRepository, participantRepository, scheduleRepository } from "@/repositories";
import { ParticipantsTab } from "@/components/schedule/ParticipantsTab";
import { ScheduleInfoTab } from "@/components/schedule/ScheduleInfoTab";
import { CourtsTab } from "@/components/schedule/CourtsTab";
import { WaitingTab } from "@/components/schedule/WaitingTab";
import { MatchingSettingsTab } from "@/components/schedule/MatchingSettingsTab";
import { AddParticipantModal } from "@/components/schedule/AddParticipantModal";
import { ManualMatchModal } from "@/components/schedule/ManualMatchModal";
import { AutoMatchModal } from "@/components/schedule/AutoMatchModal";
import { MemberAddModal } from "@/components/MemberAddModal";
import { useToast } from "@/components/Toast";

type Mode = "admin" | "view";

interface Props {
  scheduleId: string;
  mode: Mode;
}

type Tab = "courts" | "waiting" | "participants" | "settings" | "info";

interface ScheduleDetailData {
  schedule: Schedule | null;
  participants: Participant[];
  members: Member[];
  games: Game[];
}

function formatDateShort(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${days[date.getDay()]})`;
}

async function getVisibleMembers(participants: Participant[], games: Game[]): Promise<Member[]> {
  const memberIds = new Set<string>();

  participants.forEach((participant) => memberIds.add(participant.memberId));
  games.forEach((game) => {
    [...game.team1, ...game.team2].forEach((memberId) => memberIds.add(memberId));
  });

  return memberRepository.getByIds([...memberIds]);
}

async function fetchScheduleDetailData(scheduleId: string, isReadOnly: boolean): Promise<ScheduleDetailData> {
  if (isReadOnly) {
    const [schedule, participants, games] = await Promise.all([
      scheduleRepository.getById(scheduleId),
      participantRepository.getAll(scheduleId),
      gameRepository.getAll(scheduleId),
    ]);

    return {
      schedule,
      participants,
      members: await getVisibleMembers(participants, games),
      games,
    };
  }

  const [schedule, participants, members, games] = await Promise.all([
    scheduleRepository.getById(scheduleId),
    participantRepository.getAll(scheduleId),
    memberRepository.getAll(),
    gameRepository.getAll(scheduleId),
  ]);

  return {
    schedule,
    participants,
    members,
    games,
  };
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function ScheduleDetailClient({ scheduleId, mode }: Props) {
  const router = useRouter();
  const { showToast } = useToast();
  const isReadOnly = mode === "view";

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("courts");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [manualMatchInitialIds, setManualMatchInitialIds] = useState<string[]>([]);
  const [editingGameId, setEditingGameId] = useState<string | undefined>(undefined);
  const [showAutoMatch, setShowAutoMatch] = useState(false);
  const [showMemberAdd, setShowMemberAdd] = useState(false);
  const [memberAddName, setMemberAddName] = useState("");
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [priorities, setPriorities] = useState<MatchingPriority[]>([
    "games_per_hour",
    "avoid_repeat",
    "gender_balance",
    "level_balance",
  ]);

  const applyData = useCallback((data: ScheduleDetailData) => {
    setSchedule(data.schedule);
    setParticipants(data.participants);
    setMembers(data.members);
    setGames(data.games);
  }, []);

  const loadData = useCallback(async () => {
    try {
      applyData(await fetchScheduleDetailData(scheduleId, isReadOnly));
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [applyData, isReadOnly, scheduleId]);

  const refreshViewData = useCallback(async () => {
    try {
      setRefreshing(true);
      applyData(await fetchScheduleDetailData(scheduleId, true));
    } catch (error) {
      console.error("데이터 갱신 실패:", error);
      showToast("정보 갱신에 실패했습니다.");
    } finally {
      setRefreshing(false);
    }
  }, [applyData, scheduleId, showToast]);

  useEffect(() => {
    let ignore = false;

    fetchScheduleDetailData(scheduleId, isReadOnly)
      .then((data) => {
        if (!ignore) applyData(data);
      })
      .catch((error) => {
        console.error("데이터 로드 실패:", error);
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [applyData, isReadOnly, scheduleId]);

  const memberMap = useMemo(
    () => new Map(members.map((member) => [member.id, member])),
    [members]
  );

  const getMember = useCallback(
    (memberId: string): Member | undefined => memberMap.get(memberId),
    [memberMap]
  );

  async function copyShareLink() {
    try {
      const url = `${window.location.origin}/view/schedule/${scheduleId}`;
      await copyText(url);
      showToast("조회 링크를 복사했습니다.", "success");
    } catch (error) {
      console.error("링크 복사 실패:", error);
      showToast("링크 복사에 실패했습니다.");
    }
  }

  if (loading) {
    return <div className="py-16 text-center text-sm text-[var(--color-text-muted)]">로딩중...</div>;
  }

  if (!schedule) {
    return (
      <div className="py-16 text-center text-[var(--color-text-muted)]">
        <p className="text-sm">일정을 찾을 수 없습니다</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm font-semibold text-[var(--color-primary)]"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const dateDisplay = formatDateShort(schedule.date);
  const titleDisplay = schedule.name || dateDisplay;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 bg-gradient-to-r from-[#0066B3] to-[#004d8a] px-4 py-3.5 text-white">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {!isReadOnly && (
            <button
              onClick={() => router.push("/")}
              className="flex h-7 w-7 shrink-0 items-center justify-center text-lg leading-none"
              aria-label="뒤로가기"
            >
              ❮
            </button>
          )}
          <h1 className="truncate text-base font-bold leading-7">{titleDisplay}</h1>
        </div>

        {!isReadOnly && (
          <button
            onClick={copyShareLink}
            className="shrink-0 rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-xs font-semibold"
          >
            링크 복사
          </button>
        )}
      </header>

      <div className="sticky top-0 z-40 flex border-b border-[var(--color-border)] bg-white">
        <TabButton label="코트" active={activeTab === "courts"} onClick={() => setActiveTab("courts")} />
        <TabButton label="대기" active={activeTab === "waiting"} onClick={() => setActiveTab("waiting")} />
        <TabButton
          label="참여자"
          active={activeTab === "participants"}
          onClick={() => setActiveTab("participants")}
        />
        {!isReadOnly && (
          <TabButton
            label="매칭설정"
            active={activeTab === "settings"}
            onClick={() => setActiveTab("settings")}
          />
        )}
        <TabButton label="일정정보" active={activeTab === "info"} onClick={() => setActiveTab("info")} />
      </div>

      <div className={`flex-1 p-4 ${isReadOnly ? "pb-24" : ""}`}>
        {activeTab === "courts" && (
          <CourtsTab
            scheduleId={scheduleId}
            schedule={schedule}
            games={games}
            participants={participants}
            getMember={getMember}
            readOnly={isReadOnly}
            onManualMatch={() => {
              setManualMatchInitialIds([]);
              setEditingGameId(undefined);
              setShowManualMatch(true);
            }}
            onAutoMatch={() => setShowAutoMatch(true)}
            onEditGame={(playerIds, gameId) => {
              setManualMatchInitialIds(playerIds);
              setEditingGameId(gameId);
              setShowManualMatch(true);
            }}
            onRefresh={loadData}
          />
        )}

        {activeTab === "waiting" && <WaitingTab participants={participants} getMember={getMember} />}

        {activeTab === "participants" && (
          <ParticipantsTab
            scheduleId={scheduleId}
            participants={participants}
            getMember={getMember}
            readOnly={isReadOnly}
            onAddClick={() => {
              setParticipantSearchQuery("");
              setShowAddParticipant(true);
            }}
            onRefresh={loadData}
          />
        )}

        {!isReadOnly && activeTab === "settings" && (
          <MatchingSettingsTab priorities={priorities} onPrioritiesChange={setPriorities} />
        )}

        {activeTab === "info" && (
          <ScheduleInfoTab
            schedule={schedule}
            participantCount={participants.length}
            gameCount={games.length}
            readOnly={isReadOnly}
            onRefresh={loadData}
          />
        )}
      </div>

      {!isReadOnly && showAddParticipant && (
        <AddParticipantModal
          scheduleId={scheduleId}
          members={members}
          existingParticipants={participants}
          searchQuery={participantSearchQuery}
          suspendHistoryClose={showMemberAdd}
          onSaved={() => {
            setShowAddParticipant(false);
            loadData();
          }}
          onAddMember={(name) => {
            setMemberAddName(name);
            setShowMemberAdd(true);
          }}
          onSearchQueryChange={setParticipantSearchQuery}
        />
      )}

      {!isReadOnly && showManualMatch && schedule && (
        <ManualMatchModal
          scheduleId={scheduleId}
          schedule={schedule}
          participants={participants}
          games={games}
          getMember={getMember}
          initialSelectedIds={manualMatchInitialIds}
          editingGameId={editingGameId}
          onClose={() => setShowManualMatch(false)}
          onSaved={() => {
            loadData();
          }}
        />
      )}

      {!isReadOnly && showAutoMatch && schedule && (
        <AutoMatchModal
          scheduleId={scheduleId}
          schedule={schedule}
          participants={participants}
          members={members}
          games={games}
          priorities={priorities}
          onClose={() => setShowAutoMatch(false)}
          onSaved={() => {
            setShowAutoMatch(false);
            loadData();
          }}
        />
      )}

      {!isReadOnly && showMemberAdd && (
        <MemberAddModal
          member={null}
          defaultName={memberAddName}
          manageHistory={false}
          onClose={() => setShowMemberAdd(false)}
          onSavedName={(savedName) => {
            setParticipantSearchQuery(savedName);
          }}
          onSaved={() => {
            setShowMemberAdd(false);
            loadData();
          }}
        />
      )}

      {isReadOnly && (
        <div className="fixed bottom-4 left-1/2 z-30 w-[calc(100%-32px)] max-w-3xl -translate-x-1/2">
          <button
            type="button"
            onClick={refreshViewData}
            disabled={refreshing}
            className="w-full rounded-xl bg-[var(--color-primary)] py-3.5 text-sm font-bold text-white shadow-lg active:bg-[var(--color-primary-dark)] disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            {refreshing ? "갱신중..." : "새로고침"}
          </button>
        </div>
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 border-b-2 py-3 text-sm font-semibold transition-colors ${
        active
          ? "border-[var(--color-primary)] text-[var(--color-primary)]"
          : "border-transparent text-[var(--color-text-muted)]"
      }`}
    >
      {label}
    </button>
  );
}
