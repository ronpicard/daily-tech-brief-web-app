import {
  effectiveNewsOriginIso2,
  formatCountryOfOriginLabel,
} from './geoLabels.js'
import { upgradeHttpToHttps } from './hnBrief.js'
import { mediaBiasForDomain } from './mediaBias.js'
import {
  DEFAULT_NEWS_REGION,
  NEWS_REGION_ALL,
  normalizeCountrySelection,
} from './newsRegion.js'

const TOPIC_KEY_SET = new Set([
  'tech',
  'economy',
  'housing',
  'land',
  'us',
  'politics',
  'health',
  'finance',
  'global',
])

function normalizeTopicKey(topic) {
  return TOPIC_KEY_SET.has(topic) ? topic : 'tech'
}

const ALLORIGINS = 'https://api.allorigins.win/raw?url='
const RSS2JSON = 'https://api.rss2json.com/v1/api.json?rss_url='
const FEED_TIMEOUT_MS = 7000
const RSS_CACHE_TTL_MS = 1000 * 120
const rssPoolCache = new Map()
const rssPoolInFlight = new Map()

function abortableTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer)
    },
  }
}

async function fetchText(url, signal, init = {}) {
  const r = await fetch(url, { ...init, signal })
  if (!r.ok) throw new Error(String(r.status))
  return r.text()
}

async function fetchViaRss2Json(feedUrl, signal) {
  const r = await fetch(`${RSS2JSON}${encodeURIComponent(feedUrl)}`, { signal })
  if (!r.ok) throw new Error(String(r.status))
  const j = await r.json()
  if (j?.status !== 'ok' || !Array.isArray(j.items)) {
    throw new Error(j?.message || 'rss2json failed')
  }
  return {
    channelTitle: j.feed?.title || '',
    items: j.items
      .map((item) => ({
        title: item.title || 'Untitled',
        link: item.link || item.url || '',
        pubDate: item.pubDate || item.pubdate || '',
        author: item.author || '',
      }))
      .filter((row) => row.link),
    feedUrl,
  }
}

async function fetchFeedXml(url, signal) {
  const fetchViaAllOrigins = () =>
    fetchText(`${ALLORIGINS}${encodeURIComponent(url)}`, signal)

  // Prefer the local Vite proxy in development (fast + no third-party quota).
  if (import.meta.env.DEV) {
    try {
      const text = await fetchText(`/api/rss?u=${encodeURIComponent(url)}`, signal)
      return text
    } catch {
      // fall through
    }
  }

  try {
    return await fetchText(url, signal, {
      mode: 'cors',
      headers: {
        Accept:
          'application/rss+xml, application/atom+xml, application/xml, text/xml, */*',
      },
    })
  } catch {
    // Production browsers usually fail CORS here.
  }

  return fetchViaAllOrigins()
}

async function fetchOneFeed(url) {
  try {
    const timeout = abortableTimeout(FEED_TIMEOUT_MS)
    try {
      return await fetchViaRss2Json(url, timeout.signal)
    } finally {
      timeout.clear()
    }
  } catch {
    // Prefer rss2json; fall back to XML / AllOrigins if it fails or rate-limits.
  }

  const timeout = abortableTimeout(FEED_TIMEOUT_MS)
  try {
    const xml = await fetchFeedXml(url, timeout.signal)
    return parseFeedXml(xml, url)
  } finally {
    timeout.clear()
  }
}

/** Curated RSS/Atom URLs per topic (plus Google News search for breadth). */
export const TOPIC_RSS_URLS = {
  tech: [
    'https://www.theverge.com/rss/index.xml',
    'https://feeds.arstechnica.com/arstechnica/index',
    'https://techcrunch.com/feed/',
    'https://www.wired.com/feed/rss',
  ],
  economy: [
    'https://rss.cnn.com/rss/money_latest.rss',
    'https://feeds.marketwatch.com/marketwatch/topstories/',
    'https://news.google.com/rss/search?q=economy+OR+inflation+OR+Federal+Reserve&hl=en-US&gl=US&ceid=US:en',
  ],
  housing: [
    'https://www.cnbc.com/id/10000116/device/rss/rss.html',
    'https://news.google.com/rss/search?q=housing+OR+mortgage+OR+home+prices&hl=en-US&gl=US&ceid=US:en',
  ],
  land: [
    'https://news.google.com/rss/search?q=land+use+OR+zoning+OR+real+estate+development&hl=en-US&gl=US&ceid=US:en',
  ],
  us: [
    'https://feeds.npr.org/1001/rss.xml',
    'https://rss.cnn.com/rss/cnn_latest.rss',
    'https://news.google.com/rss/search?q=United+States+news&hl=en-US&gl=US&ceid=US:en',
  ],
  politics: [
    'https://rss.cnn.com/rss/cnn_allpolitics.rss',
    'https://thehill.com/homenews/feed/',
    'https://feeds.npr.org/1014/rss.xml',
    'https://news.google.com/rss/search?q=US+politics+OR+Congress&hl=en-US&gl=US&ceid=US:en',
  ],
  health: [
    'https://rss.cnn.com/rss/cnn_health.rss',
    'https://feeds.npr.org/1128/rss.xml',
    'https://news.google.com/rss/search?q=health+OR+CDC+OR+public+health&hl=en-US&gl=US&ceid=US:en',
  ],
  finance: [
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://feeds.marketwatch.com/marketwatch/marketpulse/',
    'https://news.google.com/rss/search?q=stock+market+OR+finance&hl=en-US&gl=US&ceid=US:en',
  ],
  global: [
    'https://feeds.bbci.co.uk/news/world/rss.xml',
    'https://rss.cnn.com/rss/cnn_world.rss',
    'https://news.google.com/rss/search?q=world+news&hl=en-US&gl=US&ceid=US:en',
  ],
}

function topicFeedUrls(topic) {
  const key = normalizeTopicKey(topic)
  return TOPIC_RSS_URLS[key] || TOPIC_RSS_URLS.tech
}

function parseNewsScopeFromOpts(opts) {
  if (opts.newsScope === NEWS_REGION_ALL) return NEWS_REGION_ALL
  if (Array.isArray(opts.newsScope)) {
    return normalizeCountrySelection(opts.newsScope)
  }
  if (Array.isArray(opts.newsCountries)) {
    return normalizeCountrySelection(opts.newsCountries)
  }
  const nr = opts.newsRegion
  if (typeof nr === 'string' && nr.trim()) {
    const u = nr.trim().toUpperCase()
    if (u === NEWS_REGION_ALL) return NEWS_REGION_ALL
    return normalizeCountrySelection([u])
  }
  return [DEFAULT_NEWS_REGION]
}

function textContent(el) {
  return el?.textContent?.trim() || ''
}

function parseFeedXml(xml, feedUrl) {
  const doc = new DOMParser().parseFromString(xml, 'text/xml')
  if (doc.querySelector('parsererror')) return { channelTitle: '', items: [] }

  const channelTitle =
    textContent(doc.querySelector('channel > title')) ||
    textContent(doc.querySelector('feed > title')) ||
    ''

  const out = []
  const items = [...doc.getElementsByTagName('item')]
  for (const item of items) {
    const title = textContent(item.querySelector('title')) || 'Untitled'
    let link = textContent(item.querySelector('link'))
    if (!link) {
      const guid = item.querySelector('guid')
      if (guid && /^https?:\/\//i.test(textContent(guid))) link = textContent(guid)
    }
    if (!link) continue
    const pub =
      textContent(item.querySelector('pubDate')) ||
      textContent(item.getElementsByTagName('dc:date')[0]) ||
      ''
    const author =
      textContent(item.querySelector('author')) ||
      textContent(item.getElementsByTagName('dc:creator')[0]) ||
      ''
    out.push({ title, link, pubDate: pub, author })
  }

  const entries = [...doc.getElementsByTagName('entry')]
  for (const entry of entries) {
    const title = textContent(entry.querySelector('title')) || 'Untitled'
    let link = ''
    const links = entry.getElementsByTagName('link')
    for (let i = 0; i < links.length; i++) {
      const l = links[i]
      const rel = l.getAttribute('rel')
      const href = l.getAttribute('href')
      if (href && (rel === 'alternate' || rel == null || rel === '')) {
        link = href
        break
      }
    }
    if (!link) continue
    const pub =
      textContent(entry.querySelector('updated')) ||
      textContent(entry.querySelector('published')) ||
      ''
    const author = textContent(entry.querySelector('author > name'))
    out.push({ title, link, pubDate: pub, author })
  }

  return { channelTitle, items: out, feedUrl }
}

function hashId(s) {
  let h = 0
  const str = String(s)
  for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0
  return `rss-${Math.abs(h).toString(36)}`
}

function domainFromUrl(url) {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function normalizeRssRow(row, channelTitle, attachOutletBias) {
  const url = upgradeHttpToHttps(row.link)
  const domain = domainFromUrl(url)
  const code = effectiveNewsOriginIso2('', domain)
  const sourceCountryLabel = code ? formatCountryOfOriginLabel(code) : ''
  const t = row.title || 'Untitled'
  const base = {
    objectID: hashId(url || t),
    title: t,
    url,
    author: row.author || channelTitle || domain || 'Feed',
    points: null,
    num_comments: null,
    created_at: row.pubDate,
    feed: 'rss',
    domain,
    sourceLanguage: 'en',
    sourceCountryRaw: code || '',
    sourceCountryLabel,
  }
  if (attachOutletBias) {
    base.biasLabel = mediaBiasForDomain(domain).category
  }
  return base
}

function parseStoryDate(isoish) {
  const t = Date.parse(isoish || '')
  return Number.isFinite(t) ? t : 0
}

function dedupePick(pool, n) {
  const seen = new Set()
  const out = []
  for (const s of pool) {
    const key = (s.url || s.title || String(s.objectID)).toLowerCase().slice(0, 240)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
    if (out.length >= n) break
  }
  return out
}

/**
 * Prefer country-matched items; fill remaining slots from the rest (RSS rarely has GDELT-style country tags).
 */
function applyCountryPreference(pool, scope, n) {
  if (scope === NEWS_REGION_ALL) {
    pool.sort((a, b) => parseStoryDate(b.created_at) - parseStoryDate(a.created_at))
    return dedupePick(pool, n)
  }
  const allow = new Set(scope)
  const inR = []
  const outR = []
  for (const h of pool) {
    const bucket = allow.has(effectiveNewsOriginIso2(h.sourceCountryRaw, h.domain))
      ? inR
      : outR
    bucket.push(h)
  }
  inR.sort((a, b) => parseStoryDate(b.created_at) - parseStoryDate(a.created_at))
  outR.sort((a, b) => parseStoryDate(b.created_at) - parseStoryDate(a.created_at))
  return dedupePick([...inR, ...outR], n)
}

/**
 * Fetch topic feeds in parallel and return as soon as we can fill `limit`.
 * Remaining feeds keep running in the background to warm the cache.
 */
async function loadTopicStories(topic, attachOutletBias, scope, limit) {
  const cached = rssPoolCache.get(topic)
  if (cached && Date.now() - cached.at < RSS_CACHE_TTL_MS) {
    return applyCountryPreference(
      cached.items.map((item) => ({ ...item })),
      scope,
      limit,
    )
  }

  const cacheKey = `${topic}|${limit}|${scope === NEWS_REGION_ALL ? 'all' : scope.join('+')}`
  const existingRequest = rssPoolInFlight.get(cacheKey)
  if (existingRequest) return existingRequest

  const request = (async () => {
    const urls = topicFeedUrls(topic)
    const pool = []
    let settled = false
    let resolveReady
    const ready = new Promise((resolve) => {
      resolveReady = resolve
    })

    const finish = (picked) => {
      if (settled) return
      settled = true
      resolveReady(picked)
    }

    const consider = () => {
      if (settled) return
      const picked = applyCountryPreference(
        pool.map((item) => ({ ...item })),
        scope,
        limit,
      )
      if (picked.length >= limit) finish(picked)
    }

    const tasks = urls.map(async (url) => {
      try {
        const { channelTitle, items } = await fetchOneFeed(url)
        for (const row of items) {
          pool.push(normalizeRssRow(row, channelTitle, attachOutletBias))
        }
        consider()
      } catch {
        // Slow or dead feeds are skipped; others can still fill the list.
      }
    })

    void Promise.allSettled(tasks).then(() => {
      if (pool.length > 0) {
        rssPoolCache.set(topic, { at: Date.now(), items: pool.slice() })
      }
      if (!settled) {
        finish(
          applyCountryPreference(
            pool.map((item) => ({ ...item })),
            scope,
            limit,
          ),
        )
      }
    })

    const picked = await ready
    if (!picked || picked.length === 0) {
      throw new Error(
        'Could not load RSS feeds (network or CORS). Try “GDELT search” in Settings, or use dev server with /api/rss proxy.',
      )
    }
    return picked
  })()

  rssPoolInFlight.set(cacheKey, request)
  try {
    return await request
  } finally {
    if (rssPoolInFlight.get(cacheKey) === request) {
      rssPoolInFlight.delete(cacheKey)
    }
  }
}

/**
 * @param {object} opts - topic, limit, newsScope | newsCountries | newsRegion
 */
export async function fetchTopStoriesFromFeeds(opts = {}) {
  const n =
    typeof opts.limit === 'number' && Number.isFinite(opts.limit)
      ? Math.max(1, Math.min(30, Math.round(opts.limit)))
      : 5
  const topic = normalizeTopicKey(opts.topic)
  const attachOutletBias = topic === 'politics'
  const scope = parseNewsScopeFromOpts(opts)

  const picked = await loadTopicStories(topic, attachOutletBias, scope, n)
  if (picked.length === 0) {
    throw new Error('No stories matched after combining feeds.')
  }

  return picked
}
