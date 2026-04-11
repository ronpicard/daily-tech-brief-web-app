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
import { fetchTopStoriesFromFeeds } from './rssFeeds.js'

const GDELT_DOC_URL = 'https://api.gdeltproject.org/api/v2/doc/doc'

/** Default number of stories to show */
export const DEFAULT_STORY_COUNT = 5

// GDELT Doc API rate limits; ~3s spacing avoids most 429s while loading faster than 5s+ gaps.
const GDELT_MIN_INTERVAL_MS = 3000
let lastGdeltFetchAt = 0
const gdeltCache = new Map()

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttleGdelt() {
  const since = Date.now() - lastGdeltFetchAt
  if (since < GDELT_MIN_INTERVAL_MS) {
    await sleep(GDELT_MIN_INTERVAL_MS - since)
  }
  lastGdeltFetchAt = Date.now()
}

/** Default: RSS/Atom feeds (fast). Optional: GDELT Doc API (slower, broader). */
export const NEWS_SOURCE_FEEDS = 'feeds'
export const NEWS_SOURCE_GDELT = 'gdelt'

export const TOPIC_KEYS = [
  'tech',
  'economy',
  'housing',
  'land',
  'us',
  'politics',
  'health',
  'finance',
  'global',
]

const TOPIC_FILTERS = {
  tech: {
    include: [
      'technology',
      'software',
      'ai',
      'artificial intelligence',
      'chip',
      'semiconductor',
      'cybersecurity',
      'cloud',
      'startup',
      'open source',
    ],
  },
  economy: {
    include: [
      'economy',
      'inflation',
      'recession',
      'gdp',
      'jobs',
      'labor',
      'wages',
      'unemployment',
      'cpi',
      'pce',
      'tariff',
      'trade',
    ],
  },
  housing: {
    include: [
      'housing',
      'mortgage',
      'rent',
      'home price',
      'house price',
      'real estate',
      'fed',
      'rates',
      'interest rate',
      'construction',
      'builders',
    ],
  },
  land: {
    include: [
      'land market',
      'land use',
      'land value',
      'zoning',
      'upzoning',
      'rezoning',
      'permitting',
      'planning',
      'parcel',
      'greenfield',
      'infill',
    ],
  },
  us: {
    include: [
      'u.s.',
      'us ',
      'united states',
      'america',
      'congress',
      'white house',
      'supreme court',
      'senate',
      'house of representatives',
      'federal',
      'election',
      'state',
    ],
  },
  politics: {
    include: [
      'politics',
      'election',
      'campaign',
      'congress',
      'white house',
      'supreme court',
      'senate',
      'house of representatives',
      'governor',
      'policy',
      'bill',
      'regulation',
    ],
  },
  health: {
    include: [
      'health',
      'medicine',
      'medical',
      'hospital',
      'pharma',
      'drug',
      'vaccin',
      'clinical',
      'disease',
      'public health',
      'nutrition',
      'mental health',
    ],
  },
  finance: {
    include: [
      'finance',
      'market',
      'stocks',
      'bonds',
      'treasury',
      'yield',
      'bank',
      'credit',
      'debt',
      'earnings',
      'sec',
      'fed',
      'interest rate',
    ],
  },
  global: {
    include: [
      'global',
      'world',
      'europe',
      'eu',
      'uk',
      'china',
      'india',
      'japan',
      'russia',
      'ukraine',
      'israel',
      'gaza',
      'middle east',
      'africa',
      'latin america',
      'un ',
      'nato',
    ],
  },
}

function normalizeTopicKey(topic) {
  return TOPIC_KEYS.includes(topic) ? topic : 'tech'
}

function topicTerms(topic) {
  const key = normalizeTopicKey(topic)
  return TOPIC_FILTERS[key]?.include || []
}

/**
 * GDELT Doc API rejects many OR-style queries and returns plain text like
 * "Queries containing OR must..." instead of JSON — use space-separated terms.
 */
function buildGdeltTopicQuery(topic) {
  const key = normalizeTopicKey(topic)
  const terms = topicTerms(key)
  if (!terms.length) return key
  const parts = terms
    .slice(0, 6)
    .map((t) => String(t).trim())
    .filter(Boolean)
  return [key, ...parts].slice(0, 7).join(' ')
}

async function fetchGdeltJson(url) {
  let r
  try {
    r = await fetch(url)
  } catch (e) {
    // In browsers, non-CORS error responses often show up as a generic network failure.
    throw new Error(
      'Could not reach the news source (network/CORS). If you just switched tabs, wait a few seconds and try again.',
    )
  }
  const text = await r.text()
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    const hint = trimmed.slice(0, 160).replace(/\s+/g, ' ')
    throw new Error(
      hint ? `News search error: ${hint}` : `Could not load stories (${r.status})`,
    )
  }
  try {
    return JSON.parse(trimmed)
  } catch {
    throw new Error('News source returned invalid JSON')
  }
}

function gdeltUrlWithQuery(maxRecords, query) {
  const params = new URLSearchParams()
  params.set('mode', 'ArtList')
  params.set('format', 'json')
  params.set('sort', 'HybridRel')
  params.set('timespan', '7d')
  params.set('maxrecords', String(Math.max(10, Math.min(250, maxRecords))))
  params.set('query', query)
  return `${GDELT_DOC_URL}?${params.toString()}`
}

function gdeltUrlForTopic(topic, maxRecords) {
  const key = normalizeTopicKey(topic)
  const q = buildGdeltTopicQuery(key) || key
  return gdeltUrlWithQuery(maxRecords, q)
}

/**
 * @param {object} opts
 * @returns {typeof NEWS_REGION_ALL | string[]}
 */
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

const PREFERRED_NEWS_DOMAINS = [
  'cnn.com',
  'msnbc.com',
  'bbc.co.uk',
  'bbc.com',
  'foxnews.com',
  'msn.com',
  'nbcnews.com',
  'drudgereport.com',
  'apnews.com',
]

function domainFromUrl(url) {
  if (!url) return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function isPreferredDomain(domain) {
  if (!domain) return false
  return PREFERRED_NEWS_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

/** Same ordering + dedupe as final pick; used to stop extra GDELT round-trips early. */
function canFillStorySlotsFromPool(candidates, limit) {
  const sorted = [...candidates].sort((a, b) => {
    const ap = isPreferredDomain(a.domain) ? 0 : 1
    const bp = isPreferredDomain(b.domain) ? 0 : 1
    if (ap !== bp) return ap - bp
    return 0
  })
  const seen = new Set()
  let got = 0
  for (const s of sorted) {
    const key = (s.url || s.title || String(s.objectID)).toLowerCase().slice(0, 240)
    if (seen.has(key)) continue
    seen.add(key)
    got++
    if (got >= limit) return true
  }
  return false
}

function normalizeGdeltArticle(a, idx, attachOutletBias) {
  const url = a?.url ? upgradeHttpToHttps(a.url) : ''
  const title = a?.title || a?.url || 'Untitled'
  const dt = a?.seendate || a?.datetime || a?.date || ''
  const domain = a?.domain || domainFromUrl(url)
  const sourceLanguage =
    a?.language || a?.lang || a?.sourceLanguage || ''
  const sourceCountryRaw =
    a?.sourcecountry ||
    a?.sourceCountry ||
    a?.country ||
    a?.sourcecountrycode ||
    ''
  const sourceCountryLabel = formatCountryOfOriginLabel(sourceCountryRaw)
  const id = a?.url
    ? `gdelt-${String(a.url).slice(0, 220)}`
    : `gdelt-${dt || 'x'}-${idx}`
  const base = {
    objectID: id,
    title,
    url,
    author: domain || 'News',
    points: null,
    num_comments: null,
    created_at: dt,
    feed: 'gdelt',
    domain,
    sourceLanguage,
    sourceCountryRaw,
    sourceCountryLabel,
  }
  if (attachOutletBias) {
    const bias = mediaBiasForDomain(domain)
    base.biasLabel = bias.category
  }
  return base
}

export async function fetchTopStories(opts = {}) {
  const source =
    opts.newsSource === NEWS_SOURCE_GDELT ? NEWS_SOURCE_GDELT : NEWS_SOURCE_FEEDS
  if (source === NEWS_SOURCE_FEEDS) {
    return fetchTopStoriesFromFeeds(opts)
  }
  return fetchTopStoriesFromGdelt(opts)
}

async function fetchTopStoriesFromGdelt(opts = {}) {
  const n =
    typeof opts.limit === 'number' && Number.isFinite(opts.limit)
      ? Math.max(1, Math.min(30, Math.round(opts.limit)))
      : DEFAULT_STORY_COUNT
  const topic = normalizeTopicKey(opts.topic)
  const attachOutletBias = topic === 'politics'
  const scope = parseNewsScopeFromOpts(opts)

  // If we're filtering by country, fetch a larger pool to survive filtering.
  const maxRec =
    scope === NEWS_REGION_ALL
      ? Math.max(50, n * 8)
      : Math.max(160, n * Math.max(16, scope.length * 8))

  const cacheKey =
    scope === NEWS_REGION_ALL
      ? `${topic}|${n}|all`
      : `${topic}|${n}|${scope.join('+')}`
  const cached = gdeltCache.get(cacheKey)
  if (cached && Date.now() - cached.at < 1000 * 60) {
    // Return a shallow copy so callers can safely mutate (e.g., translation fields).
    return cached.items.map((x) => ({ ...x }))
  }

  const baseQ = buildGdeltTopicQuery(topic)
  const queriesToTry = []
  if (scope !== NEWS_REGION_ALL && scope.length === 1) {
    const c = scope[0]
    queriesToTry.push(`${baseQ} sourcecountry:${c}`)
    queriesToTry.push(`${topic} sourcecountry:${c}`)
  }
  queriesToTry.push(baseQ)
  queriesToTry.push(topic)

  let normalized = []

  if (scope === NEWS_REGION_ALL) {
    let j = null
    let raw = []
    for (const q of queriesToTry) {
      await throttleGdelt()
      try {
        j = await fetchGdeltJson(gdeltUrlWithQuery(maxRec, q))
        raw = Array.isArray(j?.articles) ? j.articles : []
        if (raw.length > 0) break
      } catch {
        j = null
      }
    }
    if (raw.length === 0) {
      throw new Error(
        j
          ? 'No stories matched this topic'
          : 'Could not load stories from the news source',
      )
    }
    normalized = raw.map((a, i) =>
      normalizeGdeltArticle(a, i, attachOutletBias),
    )
  } else {
    const allow = new Set(scope)
    let best = []

    for (const q of queriesToTry) {
      await throttleGdelt()
      let j
      try {
        j = await fetchGdeltJson(gdeltUrlWithQuery(maxRec, q))
      } catch {
        continue
      }
      const raw = Array.isArray(j?.articles) ? j.articles : []
      if (raw.length === 0) continue

      const norm = raw.map((a, i) =>
        normalizeGdeltArticle(a, i, attachOutletBias),
      )
      const filtered = norm.filter((h) =>
        allow.has(effectiveNewsOriginIso2(h.sourceCountryRaw, h.domain)),
      )
      if (filtered.length > best.length) best = filtered
      if (canFillStorySlotsFromPool(filtered, n)) {
        best = filtered
        break
      }
    }

    if (best.length === 0) {
      throw new Error(
        'No stories matched this topic for your selected countries. Try “All countries” or add regions in Settings.',
      )
    }
    normalized = best
  }

  // Prefer requested outlets, but keep global variety if not enough.
  normalized.sort((a, b) => {
    const ap = isPreferredDomain(a.domain) ? 0 : 1
    const bp = isPreferredDomain(b.domain) ? 0 : 1
    if (ap !== bp) return ap - bp
    return 0
  })

  const picked = []
  const seen = new Set()
  for (const s of normalized) {
    if (picked.length >= n) break
    const key = (s.url || s.title || String(s.objectID)).toLowerCase().slice(0, 240)
    if (seen.has(key)) continue
    seen.add(key)
    picked.push(s)
  }

  if (picked.length === 0) throw new Error('No stories matched this topic')

  gdeltCache.set(cacheKey, { at: Date.now(), items: picked.map((x) => ({ ...x })) })
  return picked
}

export function feedLabel(feed) {
  if (feed === 'gdelt') return 'GDELT'
  if (feed === 'rss') return 'Feeds'
  return 'News'
}
