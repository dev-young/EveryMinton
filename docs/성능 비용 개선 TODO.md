# 성능/비용 개선 TODO

현재 코드 기준으로 확인한 성능 및 Firestore 비용 개선 후보입니다.
우선순위는 예상 효과와 구현 난이도를 함께 고려했습니다.

## P1. 일정 상세 화면 전체 재조회 줄이기

- [ ] 게임 시작/종료/취소 후 `schedule`, `participants`, `members`, `games` 전체를 다시 읽는 흐름을 개선한다.
- [ ] `members`는 상세 화면 진입 시 1회 로드 후 캐시하고, 경기 운영 중에는 `participants`와 `games`만 갱신한다.
- [ ] 쓰기 성공 후 가능한 경우 서버 재조회 대신 로컬 상태를 갱신한다.
- [ ] 관련 파일:
  - `app/src/components/schedule/ScheduleDetailClient.tsx`
  - `app/src/components/schedule/CourtsTab.tsx`

기대 효과:
- 경기 시작/종료 같은 빈번한 액션마다 발생하는 Firestore 읽기 수 감소
- 운영 화면 반응성 개선

검증:
- 게임 시작, 종료, 진행중 취소, 대기 게임 삭제 후 화면 상태가 즉시 일관되게 보이는지 확인
- 관리자 화면과 조회 전용 화면의 데이터 노출 범위가 달라지지 않는지 확인

## P1. 완료된 게임 전체 조회 분리

- [ ] 코트/대기 화면에서는 `waiting`, `in_progress` 게임만 조회하도록 분리한다.
- [ ] 완료된 게임 기록은 별도 탭, 더보기, 페이지네이션 중 하나로 분리한다.
- [ ] 기존 `getActiveGames()`를 실제 화면 조회에 활용하거나, 화면 목적별 repository 메서드를 추가한다.
- [ ] 관련 파일:
  - `app/src/repositories/firebase/game.repository.ts`
  - `app/src/components/schedule/ScheduleDetailClient.tsx`
  - `app/src/components/schedule/CourtsTab.tsx`

기대 효과:
- 일정이 길게 운영되어 완료 게임이 누적되어도 상세 화면 진입 비용이 선형 증가하지 않음
- 조회 전용 공유 화면의 새로고침 비용 감소

검증:
- 진행중/대기중 게임 표시가 기존과 동일한지 확인
- 완료 게임 개수가 필요한 화면에서만 추가 조회되는지 확인

## P2. 홈/회원 목록 무제한 조회 제한

- [ ] 홈 일정 목록은 최근 N개 또는 상태별 query + `limit`로 제한한다.
- [ ] 완료 일정은 기본 목록에서 제한하고, 필요 시 더보기 흐름을 추가한다.
- [ ] 회원 목록은 현재 규모에서는 전체 조회를 유지해도 되지만, 수백 명 이상을 고려해 검색/필터 전략을 정한다.
- [ ] 관련 파일:
  - `app/src/app/(main)/page.tsx`
  - `app/src/app/(main)/members/page.tsx`
  - `app/src/repositories/firebase/schedule.repository.ts`
  - `app/src/repositories/firebase/member.repository.ts`

기대 효과:
- 앱 첫 화면 진입 시 Firestore 읽기 수 상한 설정
- 장기 사용 시 완료 일정 누적으로 인한 비용 증가 완화

검증:
- 진행중/예정 일정이 누락되지 않는지 확인
- 완료 일정 표시 정책이 제품 요구사항과 맞는지 확인

## P2. 자동 매칭 계산 비용 줄이기

- [ ] `generateMatches()` 내부에서 `members.find()` 반복 조회를 `Map` 기반 조회로 바꾼다.
- [ ] 자동 매칭 미리보기 생성 시 불필요한 재계산이 발생하지 않도록 입력 데이터를 memoize한다.
- [ ] 관련 파일:
  - `app/src/lib/matching.ts`
  - `app/src/components/schedule/AutoMatchModal.tsx`

기대 효과:
- 참여자 수가 늘어도 자동 매칭 미리보기 지연 감소
- 옵션 변경 시 렌더링 부담 감소

검증:
- 같은 참여자/설정에서 매칭 결과의 정책이 기존과 동일하게 유지되는지 확인
- `includePlayingMembers`, `gameCount`, 우선순위 변경 시 미리보기가 정상 갱신되는지 확인

## P2. 참여자 추가 모달 검색/정렬 최적화

- [ ] 기본 정렬된 회원 목록을 memoize하고, 검색 시 매번 전체 복사/정렬하지 않도록 정리한다.
- [ ] 이름 검색용 보조 데이터가 필요할지 검토한다.
- [ ] 관련 파일:
  - `app/src/components/schedule/AddParticipantModal.tsx`

기대 효과:
- 모임원 수 증가 시 검색 입력 지연 감소
- 참여자 일괄 추가 화면의 렌더링 부담 감소

검증:
- 검색어 분리 규칙과 3글자 이름 축약 검색 동작이 기존과 동일한지 확인
- 신규 모임원 추가 후 목록 정렬과 검색 결과가 정상 갱신되는지 확인

## P3. 빌드 네트워크 의존성 제거 검토

- [ ] `next/font/google` 사용으로 네트워크가 막힌 환경에서 빌드가 실패할 수 있는 문제를 검토한다.
- [ ] 로컬 폰트 또는 시스템 폰트 전환 여부를 결정한다.
- [ ] 관련 파일:
  - `app/src/app/layout.tsx`

기대 효과:
- CI, 로컬, 제한된 네트워크 환경에서 빌드 안정성 개선
- 외부 폰트 요청 의존성 감소

검증:
- 네트워크 제한 환경에서 `npm run build`가 성공하는지 확인
- 실제 화면의 한글/영문 폰트 렌더링이 어색하지 않은지 확인

## P3. 정적 검사 경고 정리

- [ ] 미사용 변수 경고를 제거한다.
- [ ] 관련 파일:
  - `app/src/components/schedule/MatchingSettingsTab.tsx`
  - `app/src/components/schedule/WaitingTab.tsx`

기대 효과:
- 이후 lint 결과에서 실제 문제를 더 쉽게 식별

검증:
- `npm run lint`

