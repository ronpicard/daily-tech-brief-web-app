const HN_URL =
  'https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30'
const DEVTO_URL = 'https://dev.to/api/articles?per_page=30&top=7'
const LOBSTERS_URL =
  typeof import.meta !== 'undefined' && import.meta.env?.DEV
    ? '/api/lobsters-hottest'
    : 'https://lobste.rs/hottest.json'

/** How many stories to show after merging feeds */
export const STORY_TARGET_COUNT = 25

function normalizeDevto(a) {
  return {
    objectID: `devto-${a.id}`,
    title: a.title,
    url: a.url || (a.path ? `https://dev.to${a.path}` : ''),
    author: a.user?.username || a.user?.name || 'someone',
    points: a.positive_reactions_count ?? a.public_reactions_count ?? 0,
    num_comments: a.comments_count ?? 0,
    created_at: a.published_at || a.published_timestamp || a.created_at,
    feed: 'devto',
    path: a.path || '',
  }
}

function normalizeLobsters(s) {
  const submitter =
    typeof s.submitter_user === 'string'
      ? s.submitter_user
      : s.submitter_user?.username || 'someone'
  return {
    objectID: `lobsters-${s.short_id}`,
    title: s.title,
    url: s.url,
    author: submitter,
    points: s.score ?? 0,
    num_comments: s.comment_count ?? 0,
    created_at: s.created_at,
    feed: 'lobsters',
    short_id: s.short_id,
    lobstersCommentsUrl: s.comments_url || '',
  }
}

function tagHn(h) {
  return { ...h, feed: 'hn' }
}

/**
 * Top N stories interleaved from Hacker News (Algolia), Dev.to, and Lobsters.
 * Falls back if a source fails (e.g. browser CORS).
 */
export async function fetchTopStories() {
  const n = STORY_TARGET_COUNT

  const [hnR, devR, lobR] = await Promise.allSettled([
    fetch(HN_URL).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    }),
    fetch(DEVTO_URL).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    }),
    fetch(LOBSTERS_URL).then((r) => {
      if (!r.ok) throw new Error(String(r.status))
      return r.json()
    }),
  ])

  const hnHits =
    hnR.status === 'fulfilled' && Array.isArray(hnR.value?.hits)
      ? hnR.value.hits.map(tagHn)
      : []

  const devArticles =
    devR.status === 'fulfilled' && Array.isArray(devR.value)
      ? devR.value.map(normalizeDevto)
      : []

  const lobStories =
    lobR.status === 'fulfilled' && Array.isArray(lobR.value)
      ? lobR.value.map(normalizeLobsters)
      : []

  if (
    hnHits.length === 0 &&
    devArticles.length === 0 &&
    lobStories.length === 0
  ) {
    throw new Error('Could not load stories from any source')
  }

  const picked = []
  const seen = new Set()

  const tryAdd = (s) => {
    if (!s || picked.length >= n) return
    const key = (s.url || s.title || String(s.objectID)).toLowerCase().slice(0, 240)
    if (seen.has(key)) return
    seen.add(key)
    picked.push(s)
  }

  const rounds = Math.max(n * 2, 40)
  for (let r = 0; r < rounds && picked.length < n; r++) {
    tryAdd(hnHits[r])
    tryAdd(devArticles[r])
    tryAdd(lobStories[r])
  }

  for (const h of hnHits) tryAdd(h)
  for (const d of devArticles) tryAdd(d)
  for (const l of lobStories) tryAdd(l)

  if (picked.length === 0) {
    throw new Error('No stories available')
  }

  return picked.slice(0, n)
}

export function feedLabel(feed) {
  if (feed === 'devto') return 'Dev.to'
  if (feed === 'lobsters') return 'Lobsters'
  return 'HN'
}
