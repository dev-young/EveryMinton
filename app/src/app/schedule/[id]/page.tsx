"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Schedule, Participant, Member, Game, MatchingPriority } from "@/types";
import { scheduleRepository, participantRepository, memberRepository, gameRepository } from "@/repositories";
import { ParticipantsTab } from "@/components/schedule/ParticipantsTab";
import { ScheduleInfoTab } from "@/components/schedule/ScheduleInfoTab";
import { CourtsTab } from "@/components/schedule/CourtsTab";
import { WaitingTab } from "@/components/schedule/WaitingTab";
import { MatchingSettingsTab } from "@/components/schedule/MatchingSettingsTab";
import { AddParticipantModal } from "@/components/schedule/AddParticipantModal";
import { ManualMatchModal } from "@/components/schedule/ManualMatchModal";
import { AutoMatchModal } from "@/components/schedule/AutoMatchModal";
import { MemberAddModal } from "@/components/MemberAddModal";

type Tab = "courts" | "waiting" | "participants" | "settings" | "info";

function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["일", "월", "화", "수", "목", "금", "토"];
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  return `${month}월 ${day}일 (${dayOfWeek})`;
}

export default function ScheduleDetailPage() {
  const params = useParams();
  const router = useRouter();
  const scheduleId = params.id as string;

  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("courts");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [showManualMatch, setShowManualMatch] = useState(false);
  const [manualMatchInitialIds, setManualMatchInitialIds] = useState<string[]>([]);
  const [editingGameId, setEditingGameId] = useState<string | undefined>(undefined);
  const [showAutoMatch, setShowAutoMatch] = useState(false);
  const [showMemberAdd, setShowMemberAdd] = useState(false);
  const [memberAddName, setMemberAddName] = useState("");
  const [priorities, setPriorities] = useState<MatchingPriority[]>([
    "games_per_hour",
    "avoid_repeat",
    "gender_balance",
    "level_balance",
  ]);

  const loadData = useCallback(async (showLoading = false) => {
    try {
      if (showLoading) setLoading(true);
      const [scheduleData, participantsData, membersData, gamesData] = await Promise.all([
        scheduleRepository.getById(scheduleId),
        participantRepository.getAll(scheduleId),
        memberRepository.getAll(),
        gameRepository.getAll(scheduleId),
      ]);
      setSchedule(scheduleData);
      setParticipants(participantsData);
      setMembers(membersData);
      setGames(gamesData);
    } catch (error) {
      console.error("데이터 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }, [scheduleId]);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // 참여자의 Member 정보를 가져오는 헬퍼
  function getMember(memberId: string): Member | undefined {
    return members.find((m) => m.id === memberId);
  }

  // 상태별 참여자 수
  const waitingCount = participants.filter((p) => p.status === "waiting").length;
  const playingCount = participants.filter((p) => p.status === "playing").length;
  const registeredCount = participants.filter((p) => p.status === "registered").length;

  if (loading) {
    return (
      <div className="text-center py-16 text-[var(--color-text-muted)] text-sm">
        로딩중...
      </div>
    );
  }

  if (!schedule) {
    return (
      <div className="text-center py-16 text-[var(--color-text-muted)]">
        <p className="text-sm">일정을 찾을 수 없습니다</p>
        <button
          onClick={() => router.push("/")}
          className="mt-4 text-sm text-[var(--color-primary)] font-semibold"
        >
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  const dateDisplay = formatDateShort(schedule.date);

  return (
    <div className="flex flex-col min-h-screen">
      {/* 헤더 */}
      <header className="bg-gradient-to-r from-[#0066B3] to-[#004d8a] text-white px-4 py-3.5 flex items-center gap-3">
        <button
          onClick={() => router.push("/")}
          className="text-lg"
        >
          ❮
        </button>
        <h1 className="text-base font-bold">{dateDisplay}</h1>
      </header>

      {/* 탭 */}
      <div className="flex bg-white border-b border-[var(--color-border)] sticky top-0 z-40">
        <TabButton label="코트" active={activeTab === "courts"} onClick={() => setActiveTab("courts")} />
        <TabButton label="대기" active={activeTab === "waiting"} onClick={() => setActiveTab("waiting")} />
        <TabButton label="참여자" active={activeTab === "participants"} onClick={() => setActiveTab("participants")} />
        <TabButton label="매칭설정" active={activeTab === "settings"} onClick={() => setActiveTab("settings")} />
        <TabButton label="일정정보" active={activeTab === "info"} onClick={() => setActiveTab("info")} />
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 p-4">
        {activeTab === "courts" && (
          <CourtsTab
            scheduleId={scheduleId}
            schedule={schedule}
            games={games}
            participants={participants}
            getMember={getMember}
            onManualMatch={() => { setManualMatchInitialIds([]); setEditingGameId(undefined); setShowManualMatch(true); }}
            onAutoMatch={() => setShowAutoMatch(true)}
            onEditGame={(playerIds, gameId) => { setManualMatchInitialIds(playerIds); setEditingGameId(gameId); setShowManualMatch(true); }}
            onRefresh={loadData}
          />
        )}
        {activeTab === "waiting" && (
          <WaitingTab
            participants={participants}
            getMember={getMember}
          />
        )}
        {activeTab === "participants" && (
          <ParticipantsTab
            scheduleId={scheduleId}
            participants={participants}
            getMember={getMember}
            onAddClick={() => setShowAddParticipant(true)}
            onRefresh={loadData}
          />
        )}
        {activeTab === "settings" && (
          <MatchingSettingsTab
            priorities={priorities}
            onPrioritiesChange={setPriorities}
          />
        )}
        {activeTab === "info" && (
          <ScheduleInfoTab
            schedule={schedule}
            participantCount={participants.length}
            gameCount={games.length}
            onRefresh={loadData}
          />
        )}
      </div>

      {/* 참여자 추가 모달 */}
      {showAddParticipant && (
        <AddParticipantModal
          scheduleId={scheduleId}
          members={members}
          existingParticipants={participants}
          onClose={() => setShowAddParticipant(false)}
          onSaved={() => {
            setShowAddParticipant(false);
            loadData();
          }}
          onAddMember={(name) => {
            setShowAddParticipant(false);
            setMemberAddName(name);
            setShowMemberAdd(true);
          }}
        />
      )}

      {/* 수동 매칭 모달 */}
      {showManualMatch && (
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
            setShowManualMatch(false);
            loadData();
          }}
        />
      )}

      {/* 자동 매칭 모달 */}
      {showAutoMatch && (
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

      {/* 모임원 등록 모달 */}
      {showMemberAdd && (
        <MemberAddModal
          member={null}
          defaultName={memberAddName}
          onClose={() => setShowMemberAdd(false)}
          onSaved={() => {
            setShowMemberAdd(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-3 text-xs font-semibold border-b-2 transition-colors ${
        active
          ? "text-[var(--color-primary)] border-[var(--color-primary)]"
          : "text-[var(--color-text-muted)] border-transparent"
      }`}
    >
      {label}
    </button>
  );
}
