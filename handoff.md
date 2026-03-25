# 메이플 유니온 도우미 — 개발 현황 handoff

> 작성 기준: 2026-03-25
> 프로젝트 경로: `C:\Users\woo85\Desktop\maple-union`

---

## 1. 프로젝트 개요

**Electron + React 18 + TypeScript + Vite** 기반 데스크탑 앱.
Nexon Open API(서비스 키, OAuth 없음)를 사용해 메이플스토리 유니온 현황을 시각화한다.

### 기술 스택
| 항목 | 내용 |
|------|------|
| 프레임워크 | Electron + React 18 + TypeScript |
| 빌드 | Vite + vite-plugin-electron/simple |
| 스타일링 | Tailwind CSS (커스텀 토큰: bg-bg-dark / bg-bg-card / bg-bg-deep / text-accent / text-muted / text-subtle) |
| 상태관리 | Zustand (`appStore.ts`) |
| API 키 저장 | `electron.safeStorage` (암호화) |
| 캐릭터 데이터 | `localStorage` (savedCharacters, mainCharsByWorld, mapleM_level_\{world\}) |

---

## 2. 파일 구조

```
src/renderer/src/
├── App.tsx                          # 루트: 사이드바 + 페이지 라우팅
├── main.tsx
├── index.css                        # Tailwind + CSS 변수 (다크/라이트 테마)
├── hooks/
│   └── useTheme.ts                  # 다크/라이트 모드 토글
├── store/
│   └── appStore.ts                  # Zustand 전역 상태
├── types/
│   └── index.ts                     # Character, SavedCharacter, UnionBlock, ClassType 등
├── utils/
│   ├── classData.ts                 # ALL_CLASSES, guessClassType, levelToTileCount
│   ├── unionEffects.ts              # 직업별 유니온 효과 수치, 중복제거, 별칭 매핑
│   ├── unionGrades.ts               # UNION_GRADE_TABLE (노비스1~슈프림5, 슬롯 수)
│   └── unionRecommender.ts          # 유니온 추천 (미완성)
├── components/
│   ├── CharacterCard.tsx            # 캐릭터 카드 컴포넌트
│   ├── UnionBoard.tsx               # Canvas 기반 간이 유니온 보드 (레거시)
│   └── UnionStatsPanel.tsx          # 오른쪽 패널: 등급/효과 합산/M캐릭
└── screens/
    ├── ApiKeyScreen.tsx             # API 키 입력 화면
    ├── CharacterListScreen.tsx      # 서버별 유니온 현황 (메인 화면)
    ├── UnionPlacerScreen.tsx        # 유니온 배치기
    ├── UnionRecommendationScreen.tsx
    └── UnionStatusScreen.tsx
```

---

## 3. 핵심 기능 구현 현황

### 3-1. App.tsx — 사이드바 네비게이션
- 햄버거 메뉴 → 슬라이드 사이드바 (overlay 배경 클릭 시 닫힘)
- 페이지: `union-status` (서버별 유니온 현황) / `union-placer` (유니온 배치기)
- 사이드바 하단: 다크/라이트 모드 토글

### 3-2. CharacterListScreen.tsx — 서버별 유니온 현황
- **월드 탭** (스페셜 월드 제외)
- **등급 필터**: SSS/SS/S/A/B/미달 선택 + 이상/미만 operator
- **뷰 토글**: 테이블 뷰 / 카드 뷰 (캐릭터 이미지 포함)
- **스플릿 레이아웃**: 좌 50% 캐릭터 목록 + 우 50% UnionStatsPanel
- **본캐 설정**: 월드별 최고레벨 캐릭터 자동 탐지, 수동 변경 가능
- 재시작 시 API 키 있으면 전체 불러오기 자동 실행

### 3-3. UnionStatsPanel.tsx — 유니온 현황 패널
- **현재 등급 카드**: 등급 이미지(`public/union_grades/*.webp`) + 레벨 합산 + 다음 등급 프로그레스바
- **메이플스토리 M**: 레벨만 입력 가능 (합산 미반영, localStorage 저장)
- **유니온 효과 합산**: 상위 42캐릭 기준, 주능치 2열 그리드 + 보조스탯 리스트
  - 표시 순서: STR, DEX / LUK, INT / 최대HP%, 최대MP% / 최대HP+ / 이후 보조스탯
- **등급 기준표**: 노비스1~슈프림5 전체 (이미지+달성여부 dimming)

### 3-4. unionEffects.ts — 유니온 효과 수치
- **스프레드시트 정확 수치** (메이플스토리 내 캐릭터 육성현황 관리시트 ver2.1) 기반
- **주요 특이 직업**:
  - 아크메이지(불,독) → 최대MP%
  - 다크나이트 → 최대HP%
  - 소울마스터/미하일 → 최대HP flat (2500/2000/1000/500/250)
  - 블래스터 → 방어율무시
  - 데몬슬레이어 → 상태이상저항
  - 데몬어벤져 → 보스데미지
  - 메카닉 → 버프지속시간
  - 제논 → STR+DEX+LUK 동시 (각 50/40/20/10/5)
  - 팬텀 → 메소획득, 은월 → 크리데미지, 렌 → 이동속도
  - 캡틴 → 소환수지속시간
- **CLASS_ALIAS_MAP**: 1~3차 전직명 → 4차 최종 전직명 자동 매핑
  - 검사→히어로, 파이터/크루세이더→히어로, 페이지/화이트나이트→팔라딘
  - 스피어맨/드래곤나이트→다크나이트
  - 위자드(불,독)/파이어메이지→아크메이지(불,독), 위자드(얼,번)/아이스메이지→아크메이지(얼,번)
  - 클레릭/프리스트→비숍, 아처/헌터/레인저→보우마스터, 사수/사냥꾼→신궁
  - 로그/어쌔신/허밋→나이트로드, 밴딧/치프밴딧→섀도어
  - 해적/인파이터/버커니어→바이퍼, 건슬링어/발키리→캡틴
- **calcUnionEffects() 중복제거**: 동일 직업(별칭 해소 후 canonical 기준) 최고레벨만 효과 적용
- **EFFECT_DISPLAY_ORDER**: STR, DEX, LUK, INT, HP_PCT, MP_PCT, HP_FLAT, CRIT_RATE, CRIT_DMG, BOSS_DMG, IED, BUFF_DUR, COOLDOWN, STATUS_RES, SUMMON, PROB_DMG, MESO, EXP_RATE, MOVE_SPD, HP_REGEN, MP_REGEN

### 3-5. unionGrades.ts — 등급 기준표
- UNION_GRADE_TABLE: 노비스1~슈프림5 (총 25단계)
- 슬롯 수: 9→10→11→12→13 (노비스) → 18~22 (베테랑) → 27~31 (마스터) → 36~40 (그랜드마스터) → 41~45 (슈프림)
- 등급 색상: 노비스=gray / 베테랑=green / 마스터=blue / 그랜드마스터=purple / 슈프림=amber

### 3-6. CharacterCard.tsx — 카드 뷰
- 캐릭터 이미지: `transform: translateY(16px) scale(3)`, `transformOrigin: center 70%`
- 직업 계열별 테두리 색상 (CLASS_TYPE_COLORS)

### 3-7. appStore.ts — Zustand 스토어
- `status`: init / no-key / ready
- `savedCharacters`: localStorage 영속 (서버별 최대 50캐릭)
- `mainCharsByWorld`: localStorage 영속 (자동탐지 + 수동 설정 병합)
- `loadAllCharacters()`: 전체 불러오기 + 진행률 콜백 + 스페셜월드 제외
- `loadUnionData(char)`: 유니온 info + raider 동시 fetch
- `unionRaider`: Nexon `/user/union-raider` 응답 (block_position 포함)

---

## 4. 유니온 배치기 (UnionPlacerScreen.tsx)

### 보드 스펙
- **크기**: 22열 × 20행 = 440칸
- **셀 크기**: 26×26px (CSS 고정)
- **전체 유효 칸**: 440개 (빈 칸 없음)

### 구역 맵 (이미지 기준)
| 위치 | 구역 | 색상 |
|------|------|------|
| 꼭짓점 (맨해튼 거리 ≤6) | 상태이상내성 / 획득경험치 / 버프지속시간 / 일반데미지 | 초록/노랑/파랑 |
| 좌우 변 (col≤3 or col≥18) | 크리티컬 데미지/확률 / 방어율무시/보스데미지 | 주황/빨강 |
| 좌우 전이 (col 4-6, 15-17) | 위와 동일 | |
| 중앙 스탯 열 (row 5-12, col 7-14) | STR/DEX/MP/INT/HP/LUK/마력/공격력 | 각 스탯 색상 |
| 나머지 | inner (투명) | |

### 등급/직업별 블록 모양 (이미지 2번 기준)
| 직업 | B(1) | A(2) | S(3) | SS(4) | SSS(5) |
|------|------|------|------|-------|--------|
| 전사 | ■ | ■■ | ⌐형 | 긴⌐ | L형 |
| 마법사 | ■ | ■■ | ∟형 | T형(⊤) | +십자형 |
| 궁수/메이플M | ■ | ■■ | ─── | ──── | ───── |
| 도적/제논 | ■ | ■■ | ∟형 | Z형 | T형(⊤) |
| 해적 | ■ | ■■ | L형 | J형 | 역L형 |

- **제논**: 해적 직업이지만 **도적 모양** 사용
- **메이플스토리 M**: **궁수 모양** 사용

### 자동 배치 알고리즘
1. **블록 수**: 현재 서버 유니온 등급의 슬롯 수 = 배치 가능 블록 수
2. **MCV 휴리스틱**: 칸 수 많은 블록(SSS=5칸)부터 먼저 배치
3. **4방향 회전**: 각 블록을 0°/90°/180°/270° 모든 방향 시도
4. **백트래킹**: 배치 불가 시 이전 단계로 후퇴
5. **역순 재시도**: 정방향 실패 시 블록 순서 역순으로 재탐색
6. **비동기 애니메이션**: 400 스텝마다 `setTimeout(0)` yield → 실시간 UI 업데이트

---

## 5. 유니온 등급 이미지

- **경로**: `public/union_grades/*.webp` (총 25개)
- **파일명 형식**: `novis1-5.webp`, `veteran1-5.webp`, `master1-5.webp`, `grandmaster1-5.webp`, `supreme1-5.webp`
- **원본 위치**: `C:\Users\woo85\Desktop\union_img\`
- UnionStatsPanel에서 `./union_grades/{prefix}{step}.webp` 형식으로 참조
- `onError` 시 `display:none` 처리

---

## 6. 데이터 흐름

```
Nexon Open API
  └─ IPC main process (x-nxopen-api-key 헤더)
       └─ window.api.nexon.* / window.api.chars.* / window.api.creds.*
            └─ appStore.ts (Zustand)
                 ├─ savedCharacters → CharacterListScreen → UnionStatsPanel
                 │                                        → UnionPlacerScreen (블록 생성)
                 └─ unionRaider (block_position) → (현재 미사용 in placer)
```

---

## 7. 알려진 미완성 / 보류 항목

| 항목 | 상태 | 비고 |
|------|------|------|
| `union_grades/` 이미지 복사 | ⚠ 필요 | `C:\Users\woo85\Desktop\union_img\` → `public/union_grades/` 복사 필요 |
| 유니온 배치기 — 실제 Nexon 배치 데이터 연동 | ⬜ 미구현 | `unionRaider.union_raider_block`의 `block_position` 활용 가능 |
| 유니온 배치기 — 수동 배치 (드래그&드롭) | ⬜ 미구현 | |
| 유니온 배치기 — 존별 최적화 (어느 존을 몇 칸 채울지) | ⬜ 미구현 | |
| 아크(Arc) 직업 classData.ts 오류 | ⚠ 알려진 버그 | `type: 'mage'`로 등록되어 있으나 실제로는 `STR` 계열 해적 |
| CharacterCard 카드뷰 — 이미지 10% 추가 하향 | ✅ 완료 | `translateY(16px)` 적용됨 |
| 등급 이미지 UnionStatsPanel 적용 | ✅ 완료 | `gradeImgSrc()` 함수로 참조 |
| UnionRecommendationScreen | ⬜ 미구현 | `unionRecommender.ts` 기본 구조만 있음 |

---

## 8. 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 + Electron 패키징
npm run package   # (설정되어 있는 경우)
```

---

## 9. 주요 설계 원칙

- **스페셜 월드 제외**: `['스페셜', 'Special', '스페셜월드', '테스트', 'Test']`
- **레벨 합산**: 서버별 상위 42캐릭터, 메이플M 미반영
- **유니온 슬롯**: `UNION_GRADE_TABLE[].slots` = 배치 가능 블록 수 (9~45)
- **개인 등급**: level>249→SSS / >199→SS / >139→S / >99→A / >59→B / 미달
- **중복 직업 처리**: 별칭 해소 후 canonical 직업명 기준, 최고레벨 1개만 효과 적용
