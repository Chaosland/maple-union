export const onRequestGet: PagesFunction = async (context) => {
  const jsonHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
  }
  const apiKey = context.request.headers.get('X-Api-Key')
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'API 키 없음' }), {
      status: 401,
      headers: jsonHeaders
    })
  }

  const BASE = 'https://open.api.nexon.com'
  const BATCH = 5

  // OCID 목록 조회
  const listRes = await fetch(`${BASE}/maplestory/v1/character/list`, {
    headers: {
      'x-nxopen-api-key': apiKey,
      'Cache-Control': 'no-store, no-cache',
      Pragma: 'no-cache'
    },
    cache: 'no-store'
  })
  if (!listRes.ok) {
    const msg = await listRes.text()
    return new Response(JSON.stringify({ ok: false, error: `목록 조회 실패: ${msg}` }), {
      status: 200,
      headers: jsonHeaders
    })
  }

  const listJson = await listRes.json() as {
    account_list: Array<{ character_list: Array<{ ocid: string }> }>
  }
  const ocids = (listJson.account_list ?? []).flatMap(a => (a.character_list ?? []).map(c => c.ocid))

  if (ocids.length === 0) {
    return new Response(JSON.stringify({ ok: true, data: [] }), {
      headers: jsonHeaders
    })
  }

  // 5개씩 병렬 조회
  const results: unknown[] = []
  for (let i = 0; i < ocids.length; i += BATCH) {
    const chunk = ocids.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      chunk.map(ocid =>
        fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(ocid)}`, {
          headers: {
            'x-nxopen-api-key': apiKey,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          },
          cache: 'no-store'
        }).then(r => r.json()).then(d => ({ ...(d as object), ocid }))
      )
    )
    settled.forEach(r => { if (r.status === 'fulfilled') results.push(r.value) })
    if (i + BATCH < ocids.length) await new Promise(r => setTimeout(r, 150))
  }

  // /id API로 한 번 더 OCID 정합성 체크
  const basics = results as Array<{
    ocid: string
    character_name?: string
    [k: string]: unknown
  }>
  for (let i = 0; i < basics.length; i += BATCH) {
    const chunk = basics.slice(i, i + BATCH)
    const settled = await Promise.allSettled(
      chunk.map(async (c) => {
        const name = c.character_name?.trim()
        if (!name) return c

        const idRes = await fetch(`${BASE}/maplestory/v1/id?character_name=${encodeURIComponent(name)}`, {
          headers: {
            'x-nxopen-api-key': apiKey,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          },
          cache: 'no-store'
        })
        if (!idRes.ok) return c

        const idJson = await idRes.json() as { ocid?: string }
        if (!idJson.ocid) return c

        const basicRes = await fetch(`${BASE}/maplestory/v1/character/basic?ocid=${encodeURIComponent(idJson.ocid)}`, {
          headers: {
            'x-nxopen-api-key': apiKey,
            'Cache-Control': 'no-store, no-cache',
            Pragma: 'no-cache'
          },
          cache: 'no-store'
        })
        if (!basicRes.ok) return c

        const basicJson = await basicRes.json() as Record<string, unknown>
        return { ...basicJson, ocid: idJson.ocid }
      })
    )

    for (let j = 0; j < settled.length; j++) {
      if (settled[j].status === 'fulfilled') {
        basics[i + j] = settled[j].value
      }
    }
    if (i + BATCH < basics.length) await new Promise(r => setTimeout(r, 150))
  }

  return new Response(JSON.stringify({ ok: true, data: basics }), {
    headers: jsonHeaders
  })
}
