import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import {
  DEFAULT_NEWS_REGION,
  NEWS_REGION_ALL,
  loadStoredCountrySelection,
  normalizeCountrySelection,
  resolveNewsScope,
} from './newsRegion.js'

describe('normalizeCountrySelection', () => {
  it('uppercases, dedupes, sorts, and maps UK to GB', () => {
    expect(normalizeCountrySelection(['uk', 'US', 'us', 'DE'])).toEqual([
      'DE',
      'GB',
      'US',
    ])
  })

  it('defaults to US when selection is empty or invalid', () => {
    expect(normalizeCountrySelection([])).toEqual([DEFAULT_NEWS_REGION])
    expect(normalizeCountrySelection(['ZZ'])).toEqual([DEFAULT_NEWS_REGION])
    expect(normalizeCountrySelection(null)).toEqual([DEFAULT_NEWS_REGION])
  })
})

describe('resolveNewsScope', () => {
  it('returns worldwide scope when worldwide is enabled', () => {
    expect(resolveNewsScope(true, ['US'])).toBe(NEWS_REGION_ALL)
  })

  it('returns normalized country list when worldwide is off', () => {
    expect(resolveNewsScope(false, ['ca', 'us'])).toEqual(['CA', 'US'])
  })
})

describe('loadStoredCountrySelection', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      store: {},
      getItem(key) {
        return Object.prototype.hasOwnProperty.call(this.store, key)
          ? this.store[key]
          : null
      },
      setItem(key, value) {
        this.store[key] = String(value)
      },
      removeItem(key) {
        delete this.store[key]
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('loads countries from localStorage JSON', () => {
    localStorage.setItem('dtb.newsCountries', JSON.stringify(['CA', 'GB']))
    localStorage.setItem('dtb.newsWorldwide', 'false')

    expect(loadStoredCountrySelection()).toEqual({
      worldwide: false,
      countries: ['CA', 'GB'],
    })
  })

  it('migrates the legacy single-country key', () => {
    localStorage.setItem('dtb.newsCountry', 'de')

    expect(loadStoredCountrySelection()).toEqual({
      worldwide: false,
      countries: ['DE'],
    })
  })

  it('defaults to US when nothing is stored', () => {
    expect(loadStoredCountrySelection()).toEqual({
      worldwide: false,
      countries: [DEFAULT_NEWS_REGION],
    })
  })
})
