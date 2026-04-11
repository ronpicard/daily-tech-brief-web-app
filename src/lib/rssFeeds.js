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

const ALLORIGINS =
  'https://api.allorigins.win/raw?url='

const rssCache = new Map()

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

async function fetchFeedXml(url) {
  const tryDirect = async () => {
    const r = await fetch(url, {
      mode: 'cors',
      headers: { Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' },
    })
    if (!r.ok) throw new Error(String(r.status))
    return r.text()
  }

  try {
    return await tryDirect()
  } catch {
    // ignore
  }

  if (import.meta.env.DEV) {
    try {
      const proxy = `/api/rss?u=${encodeURIComponent(url)}`
      const r = await fetch(proxy)
      if (!r.ok) throw new Error(String(r.status))
      return r.text()
    } catch {
      // ignore
    }
  }

  const r = await fetch(`${ALLORIGINS}${encodeURIComponent(url)}`)
  if (!r.ok) throw new Error(String(r.status))
  return r.text()
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

async function fetchOneFeed(url) {
  const xml = await fetchFeedXml(url)
  return parseFeedXml(xml, url)
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

  const cacheKey = `rss|${topic}|${n}|${scope === NEWS_REGION_ALL ? 'all' : scope.join('+')}`
  const cached = rssCache.get(cacheKey)
  if (cached && Date.now() - cached.at < 1000 * 120) {
    return cached.items.map((x) => ({ ...x }))
  }

  const urls = topicFeedUrls(topic)
  const concurrency = 4
  const chunks = []
  for (let i = 0; i < urls.length; i += concurrency) {
    chunks.push(urls.slice(i, i + concurrency))
  }

  const allItems = []
  for (const batch of chunks) {
    const results = await Promise.allSettled(batch.map((u) => fetchOneFeed(u)))
    for (const r of results) {
      if (r.status !== 'fulfilled') continue
      const { channelTitle, items } = r.value
      for (const row of items) {
        allItems.push(normalizeRssRow(row, channelTitle, attachOutletBias))
      }
    }
  }

  if (allItems.length === 0) {
    throw new Error(
      'Could not load RSS feeds (network or CORS). Try “GDELT search” in Settings, or use dev server with /api/rss proxy.',
    )
  }

  const picked = applyCountryPreference(allItems, scope, n)
  if (picked.length === 0) {
    throw new Error('No stories matched after combining feeds.')
  }

  rssCache.set(cacheKey, { at: Date.now(), items: picked.map((x) => ({ ...x })) })
  return picked
}
