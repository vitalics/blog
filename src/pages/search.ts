import type { APIRoute } from 'astro'
import { actions } from 'astro:actions'
import posthog from 'posthog-js'

const analytics = posthog.init(import.meta.env.PUBLIC_POSTHOG, {
  api_host: 'https://us.i.posthog.com',
})

const DEFAULT_SEARCH_HEADERS = new Headers({
  'Content-Type': 'application/json',
  'Cache-Control':
    'public, max-age=604800, stale-while-revalidate=86400, immutable',
  'Access-Control-Request-Method': 'GET',
  'Transfer-Encoding': 'gzip, deflate, chunked',
})

export const GET: APIRoute = async ({ url, request }) => {
  const searchString = url.searchParams.get('q')
  const kind = url.searchParams.get('kind') ?? 'all'

  if (
    kind &&
    kind !== 'all' &&
    kind !== 'blog' &&
    kind !== 'tags' &&
    kind !== 'authors'
  ) {
    new Response(
      JSON.stringify({
        posts: [],
        authors: [],
        tags: [],
        debug: {
          q: searchString,
        },
      }),
    )
  }

  const { data, error } = await actions.search({
    q: searchString!,
    kind: kind as never,
  })

  if (error) {
    analytics?.captureException(error, {
      query: searchString,
      headers: request.headers,
    })
    return new Response(JSON.stringify(error), {
      headers: DEFAULT_SEARCH_HEADERS,
    })
  }

  analytics?.capture('search', {
    headers: request.headers,
  })
  return new Response(JSON.stringify(data), { headers: DEFAULT_SEARCH_HEADERS })
}
