export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url)
  // /api/nexon/maplestory/v1/... 에서 /api/nexon 제거
  const path = url.pathname.replace(/^\/api\/nexon/, '')
  const apiKey = context.request.headers.get('X-Api-Key')

  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'API 키 없음' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const targetUrl = `https://open.api.nexon.com${path}${url.search}`
  const res = await fetch(targetUrl, {
    headers: { 'x-nxopen-api-key': apiKey, 'Accept': 'application/json' }
  })

  const body = await res.text()
  return new Response(body, {
    status: res.status,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    }
  })
}
