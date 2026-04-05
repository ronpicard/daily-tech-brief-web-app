export function storyHref(hit) {
  if (hit.url) return hit.url
  if (hit.feed === 'devto' && hit.path) return `https://dev.to${hit.path}`
  return `https://news.ycombinator.com/item?id=${hit.objectID}`
}

export function commentsHref(hit) {
  if (hit.feed === 'devto' && hit.path) {
    return `https://dev.to${hit.path}`
  }
  if (hit.feed === 'lobsters') {
    if (hit.lobstersCommentsUrl) return hit.lobstersCommentsUrl
    if (hit.short_id) return `https://lobste.rs/s/${hit.short_id}`
  }
  return `https://news.ycombinator.com/item?id=${hit.objectID}`
}

export function hostnameFromUrl(url) {
  if (!url) return null
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

export function formatStoryTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function formatStoryWhenLong(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(d)
}

export function formatRelativeTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const t = d.getTime()
  if (Number.isNaN(t)) return ''
  let sec = Math.round((Date.now() - t) / 1000)
  if (sec < 45) return 'just now'
  if (sec < 3600) {
    const m = Math.max(1, Math.round(sec / 60))
    return `${m} min ago`
  }
  if (sec < 86400) {
    const h = Math.round(sec / 3600)
    return `${h} hr ago`
  }
  const days = Math.round(sec / 86400)
  return `${days} day${days === 1 ? '' : 's'} ago`
}
