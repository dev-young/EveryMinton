"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Member, Gender, LevelGrade, LevelSubGrade } from "@/types";
import { memberRepository } from "@/repositories";
import { scoreToLevelInfo } from "@/lib/level";
import { MemberAddModal } from "@/components/MemberAddModal";
import { MemberListItem } from "@/components/MemberListItem";

export default function MembersPage() {
  const router = useRouter();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterGender, setFilterGender] = useState<Gender | "all">("all");
  const [filterLevel, setFilterLevel] = useState<LevelGrade | "all">("all");
  const [showAddModal, setShowAddModal] = useState(false);
  const [prefillName, setPrefillName] = useState("");
  const [lastGender, setLastGender] = useState<Gender>("male");
  const [lastGrade, setLastGrade] = useState<LevelGrade>("D");
  const [lastSubGrade, setLastSubGrade] = useState<LevelSubGrade>("중");

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    try {
      setLoading(true);
      const data = await memberRepository.getAll();
      setMembers(data);
    } catch (error) {
      console.error("모임원 목록 로드 실패:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleModalClose() {
    setShowAddModal(false);
    setPrefillName("");
  }

  async function handleMemberSaved() {
    handleModalClose();
    await loadMembers();
  }

  // 필터링
  const filteredMembers = members.filter((m) => {
    if (searchQuery && !m.name.includes(searchQuery)) return false;
    if (filterGender !== "all" && m.gender !== filterGender) return false;
    if (filterLevel !== "all") {
      const info = scoreToLevelInfo(m.level);
      if (info.grade !== filterLevel) return false;
    }
    return true;
  });

  const maleCount = members.filter((m) => m.gender === "male").length;
  const femaleCount = members.filter((m) => m.gender === "female").length;

  return (
    <div className="p-4">
      {/* 검색 + 등록 */}
      <div className="flex gap-2 mb-3.5">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="이름으로 검색"
          className="flex-1 px-3.5 py-2.5 border border-[var(--color-border)] rounded-lg text-sm bg-white focus:outline-none focus:border-[var(--color-primary)]"
        />
        <button
          onClick={() => {
            if (searchQuery && filteredMembers.length === 0) {
              setPrefillName(searchQuery);
            } else {
              setPrefillName("");
            }
            setShowAddModal(true);
          }}
          className="bg-[var(--color-accent)] text-white px-4 py-2.5 rounded-lg text-sm font-bold whitespace-nowrap active:bg-[var(--color-accent-dark)]"
        >
          + 등록
        </button>
      </div>

      {/* 필터 */}
      <div className="flex gap-1.5 mb-3.5 overflow-x-auto pb-1 scrollbar-hide">
        <FilterChip
          label="전체"
          active={filterGender === "all" && filterLevel === "all"}
          onClick={() => {
            setFilterGender("all");
            setFilterLevel("all");
          }}
        />
        <FilterChip
          label="남성"
          active={filterGender === "male"}
          onClick={() =>
            setFilterGender(filterGender === "male" ? "all" : "male")
          }
        />
        <FilterChip
          label="여성"
          active={filterGender === "female"}
          onClick={() =>
            setFilterGender(filterGender === "female" ? "all" : "female")
          }
        />
        {(["A", "B", "C", "D", "E"] as LevelGrade[]).map((grade) => (
          <FilterChip
            key={grade}
            label={`${grade}급`}
            active={filterLevel === grade}
            onClick={() =>
              setFilterLevel(filterLevel === grade ? "all" : grade)
            }
          />
        ))}
      </div>

      {/* 인원 수 */}
      <p className="text-xs text-[var(--color-text-muted)] mb-2.5 font-medium">
        전체 {members.length}명 (남 {maleCount} · 여 {femaleCount})
      </p>

      {/* 목록 */}
      {loading ? (
        <div className="text-center py-10 text-[var(--color-text-muted)] text-sm">
          로딩중...
        </div>
      ) : filteredMembers.length === 0 ? (
        <div className="text-center py-10 text-[var(--color-text-muted)]">
          <p className="text-4xl mb-3">🏸</p>
          <p className="text-sm">
            {members.length === 0
              ? "등록된 모임원이 없습니다"
              : "검색 결과가 없습니다"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-[var(--color-border)]">
          {filteredMembers.map((member) => (
            <MemberListItem
              key={member.id}
              member={member}
              onClick={(selectedMember) => router.push(`/members/${selectedMember.id}`)}
            />
          ))}
        </div>
      )}

      {/* 등록/수정 모달 */}
      {showAddModal && (
        <MemberAddModal
          member={null}
          defaultName={prefillName}
          defaultGender={lastGender}
          defaultGrade={lastGrade}
          defaultSubGrade={lastSubGrade}
          onClose={handleModalClose}
          onSaved={handleMemberSaved}
          onSavedContinue={loadMembers}
          onLastValues={(gender, grade, subGrade) => {
            setLastGender(gender);
            setLastGrade(grade);
            setLastSubGrade(subGrade);
          }}
        />
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap border transition-colors ${
        active
          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)]"
          : "bg-white text-[var(--color-text-secondary)] border-[var(--color-border)]"
      }`}
    >
      {label}
    </button>
  );
}
