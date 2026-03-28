// ─── Discord 설정 ────────────────────────────────────────────────────────────
// Discord 서버 개설 후 아래 Webhook URL과 초대 링크를 교체하세요.
//
// Webhook 생성 방법:
//   채널 우클릭 → 채널 편집 → 연동 → 웹후크 → 새 웹후크 → URL 복사
//
// 초대 링크 생성 방법:
//   서버 이름 우클릭 → 초대 링크 → 복사

export const DISCORD_WEBHOOKS = {
  bug:     'https://discord.com/api/webhooks/1487376492789895168/MvJ-6MKzEdlIiPoRt8WagfAbdLhVDZQ4FgI1i69FchwNv6tBv_Iv0LXVyGItRb6IMhuP',
  feature: 'https://discord.com/api/webhooks/1487376444358262844/22Zqa-bXPYyNpxmgWn--MdL4xQwlc8mZtbXZioUFDRJW4q0JG-PjdP-h1p3Ti-NtQgeV',
  other:   'https://discord.com/api/webhooks/1487376203022078082/MuFJNzvHljc9yhnPgc9fx-VTx2ocXa5DrKi6DnH7PQMjVa7bgbQZwWY62vfgMDuMJiBb',
} as const

export const DISCORD_INVITE_URL = 'https://discord.gg/bFu4zY6WTZ'
