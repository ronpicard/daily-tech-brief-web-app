import { describe, expect, it, vi, afterEach } from 'vitest'
import {
  commentsHref,
  formatRelativeTime,
  hostnameFromUrl,
  storyHref,
  upgradeHttpToHttps,
} from './hnBrief.js'

describe('upgradeHttpToHttps', () => {
  it('upgrades http urls to https', () => {
    expect(upgradeHttpToHttps('http://example.com/a')).toBe('https://example.com/a')
  })

  it('leaves https urls unchanged', () => {
    expect(upgradeHttpToHttps('https://example.com/a')).toBe('https://example.com/a')
  })

  it('returns non-string values unchanged', () => {
    expect(upgradeHttpToHttps(null)).toBe(null)
    expect(upgradeHttpToHttps(undefined)).toBe(undefined)
  })
})

describe('storyHref', () => {
  it('prefers the story url when present', () => {
    expect(storyHref({ url: 'http://example.com/story', objectID: '1' })).toBe(
      'https://example.com/story',
    )
  })

  it('builds a dev.to url from path when needed', () => {
    expect(storyHref({ feed: 'devto', path: '/t/hello', objectID: '1' })).toBe(
      'https://dev.to/t/hello',
    )
  })

  it('falls back to the HN item page', () => {
    expect(storyHref({ objectID: '42' })).toBe(
      'https://news.ycombinator.com/item?id=42',
    )
  })
})

describe('commentsHref', () => {
  it('uses the article url for gdelt and rss stories', () => {
    expect(
      commentsHref({ feed: 'rss', url: 'http://news.example/a', objectID: '1' }),
    ).toBe('https://news.example/a')
  })

  it('uses lobsters short id when comments url is missing', () => {
    expect(commentsHref({ feed: 'lobsters', short_id: 'abc', objectID: '1' })).toBe(
      'https://lobste.rs/s/abc',
    )
  })
})

describe('hostnameFromUrl', () => {
  it('strips www from valid urls', () => {
    expect(hostnameFromUrl('https://www.example.com/path')).toBe('example.com')
  })

  it('returns null for empty or invalid urls', () => {
    expect(hostnameFromUrl('')).toBe(null)
    expect(hostnameFromUrl('not a url')).toBe(null)
  })
})

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns empty string for missing or invalid input', () => {
    expect(formatRelativeTime('')).toBe('')
    expect(formatRelativeTime('not-a-date')).toBe('')
  })

  it('formats recent and older times relative to now', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-22T12:00:00.000Z'))

    expect(formatRelativeTime('2026-08-22T11:59:30.000Z')).toBe('just now')
    expect(formatRelativeTime('2026-08-22T11:45:00.000Z')).toBe('15 min ago')
    expect(formatRelativeTime('2026-08-22T09:00:00.000Z')).toBe('3 hr ago')
    expect(formatRelativeTime('2026-08-21T12:00:00.000Z')).toBe('1 day ago')
    expect(formatRelativeTime('2026-08-20T12:00:00.000Z')).toBe('2 days ago')
  })
})
