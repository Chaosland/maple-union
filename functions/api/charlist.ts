export const onRequestGet: PagesFunction = async (context) => {
  const apiKey = context.request.headers.get('X-Api-Key')
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'API 키 없음' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const BASE = 'https://open.api.nexon.com'

  // OCID 목록 조회
  const listRes = await fetch(`${BASE}/maplestory/v1/character/list`, {
    headers: { 'x-nxopen-api-key': apiKey }
  })
  if (!listRes.ok) {
    const msg = await listRes.text()
    return new Response(JSON.stringify({ ok: false, error: `목록 조회 실패: ${msg}` }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const listJson = await listRes.json() as {
    account_list: Array<{ character_list: Array<{ ocid: string }> }>
  }
  const ocids = (listJson.account_list ?? []).flatMap(a => (a.character_list ?? []).map(c => c.ocid))

  if (ocids.length === 0) {
    return new Response(JSON.stringify({ ok: true, data: [] }), {
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // 5개씩 병렬 조회
  const BATCH = 5
  const results: unknown[] = []
  for (let i = 0; i < ocids.length; i += BATCH) {
    const chunk = ocids.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      chunk.map(ocid =>
        fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`, {
          headers: { 'x-nxopen-api-key': apiKey }
        }).then(r => r.json()).then(d => ({ ...(d as object), ocid }))
      )
    )
    settled.forEach(r => { if (r.status === 'fulfilled') results.push(r.value) })
    if (i + BATCH < ocids.length) await new Promise(r => setTimeout(r, 150))
  }

  return new Response(JSON.stringify({ ok: true, data: results }), {
    headers: { 'Content-Type': 'application/json' }
  })
}
