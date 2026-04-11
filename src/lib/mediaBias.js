/**
 * Rough outlet-only heuristic (internal 1–10 scale).
 * Surfaced to users as: very left, left, middle, right, very right.
 * Unknown outlets default to middle (internal 5).
 */

const DOMAIN_SCORES = [
  ['theintercept.com', 1],
  ['commondreams.org', 2],
  ['thenation.com', 2],
  ['msnbc.com', 2],
  ['huffpost.com', 2],
  ['motherjones.com', 2],
  ['vox.com', 3],
  ['slate.com', 3],
  ['dailykos.com', 3],
  ['cnn.com', 4],
  ['nytimes.com', 4],
  ['washingtonpost.com', 4],
  ['theguardian.com', 4],
  ['politico.com', 5],
  ['apnews.com', 5],
  ['reuters.com', 5],
  ['bbc.com', 5],
  ['bbc.co.uk', 5],
  ['npr.org', 5],
  ['axios.com', 5],
  ['pbs.org', 5],
  ['nbcnews.com', 5],
  ['usatoday.com', 5],
  ['msn.com', 5],
  ['time.com', 5],
  ['thehill.com', 6],
  ['wsj.com', 6],
  ['economist.com', 6],
  ['nypost.com', 7],
  ['drudgereport.com', 7],
  ['foxnews.com', 8],
  ['washingtonexaminer.com', 8],
  ['nationalreview.com', 8],
  ['dailycaller.com', 9],
  ['newsmax.com', 9],
  ['theepochtimes.com', 9],
  ['breitbart.com', 10],
  ['oann.com', 10],
]

export const BIAS_SCALE_DISCLAIMER =
  'Approximate outlet-only lean (very left → very right). Not article-level analysis.'

function domainMatches(host, pattern) {
  return host === pattern || host.endsWith(`.${pattern}`)
}

/** User-facing bucket from internal 1 (left) … 10 (right). */
export function biasCategoryFromScore(score) {
  const s = Math.max(1, Math.min(10, Math.round(Number(score)) || 5))
  if (s <= 2) return 'Very left'
  if (s <= 4) return 'Left'
  if (s <= 6) return 'Middle'
  if (s <= 8) return 'Right'
  return 'Very right'
}

export function mediaBiasForDomain(domain) {
  const d = String(domain || '')
    .toLowerCase()
    .replace(/^www\./, '')
  if (!d) {
    return { category: biasCategoryFromScore(5) }
  }
  for (const [pattern, score] of DOMAIN_SCORES) {
    if (domainMatches(d, pattern)) {
      return { category: biasCategoryFromScore(score) }
    }
  }
  return { category: biasCategoryFromScore(5) }
}

