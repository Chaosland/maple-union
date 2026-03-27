# 메이플 유니온 도우미

메이플스토리 유니온 육성 현황을 한눈에 확인하고 최적 배치를 계산해주는 데스크탑 앱입니다.

## 다운로드

**[최신 버전 다운로드](https://github.com/Chaosland/maple-union/releases/latest)**

`메이플 유니온 도우미 Setup x.x.x.exe` 를 받아서 설치하면 됩니다.

- Windows 10/11 x64 전용
- Nexon Open API 서비스 키 필요 ([발급 방법](#api-키-발급))

---

## 주요 기능

### 서버별 유니온 현황
- 월드별 탭으로 전체 캐릭터 조회
- 등급 필터 (SSS / SS / S / A / B / 미달) + 이상/미만 조건
- 테이블 뷰 / 카드 뷰 전환
- 서버별 본캐 자동 탐지 및 수동 변경
- 유니온 등급 + 레벨 합산 + 다음 등급까지 프로그레스바

### 유니온 효과 합산
- 상위 42캐릭터 기준 효과 자동 계산
- STR / DEX / LUK / INT / HP / MP 등 전 스탯 표시
- 동일 직업 중복 제거 (최고 레벨 1개만 적용)
- 노비스1 ~ 슈프림5 등급 기준표

### 유니온 배치기
- 22×20 보드 시각화
- 자동 배치 알고리즘 (MCV 휴리스틱 + 백트래킹)
- 직업별 블록 모양 / 4방향 회전 지원
- 실시간 배치 애니메이션

### 자동 업데이트
- 앱 실행 시 백그라운드 업데이트 체크
- 변경된 부분만 다운로드 (차분 업데이트)
- 사이드바 > 업데이트 체크 버튼으로 수동 확인 가능

---

## API 키 발급

1. [Nexon Open API](https://openapi.nexon.com) 접속 후 로그인
2. **애플리케이션 등록** → 서비스 키 발급
3. 앱 실행 후 서비스 키 입력

> 서비스 키는 기기 내 암호화 저장되며 외부로 전송되지 않습니다.

---

## 기술 스택

| 항목 | 내용 |
|------|------|
| 프레임워크 | Electron 29 + React 18 + TypeScript |
| 빌드 | Vite + vite-plugin-electron |
| 스타일 | Tailwind CSS |
| 상태관리 | Zustand |
| API 키 저장 | electron.safeStorage (OS 수준 암호화) |
| 자동 업데이트 | electron-updater (GitHub Releases) |

---

## 개발 환경 실행

```bash
npm install
npm start
```

## 배포 빌드

```bash
npm run dist
```

`release/` 폴더에 설치 파일이 생성됩니다.

---

## 라이선스

MIT
