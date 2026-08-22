import { describe, expect, it } from 'vitest'
import {
  effectiveNewsOriginIso2,
  formatCountryOfOriginLabel,
  normalizeToIso3166Alpha2,
} from './geoLabels.js'

describe('normalizeToIso3166Alpha2', () => {
  it('normalizes alpha-2 and UK alias', () => {
    expect(normalizeToIso3166Alpha2('us')).toBe('US')
    expect(normalizeToIso3166Alpha2('UK')).toBe('GB')
  })

  it('maps common alpha-3 codes', () => {
    expect(normalizeToIso3166Alpha2('USA')).toBe('US')
    expect(normalizeToIso3166Alpha2('DEU')).toBe('DE')
  })

  it('returns empty string for blank or unknown values', () => {
    expect(normalizeToIso3166Alpha2('')).toBe('')
    expect(normalizeToIso3166Alpha2(null)).toBe('')
    expect(normalizeToIso3166Alpha2('XYZ')).toBe('')
  })
})

describe('formatCountryOfOriginLabel', () => {
  it('formats ISO codes into English region names', () => {
    expect(formatCountryOfOriginLabel('US')).toBe('United States')
    expect(formatCountryOfOriginLabel('UK')).toBe('United Kingdom')
    expect(formatCountryOfOriginLabel('DEU')).toBe('Germany')
  })

  it('returns empty string for blank input', () => {
    expect(formatCountryOfOriginLabel('')).toBe('')
    expect(formatCountryOfOriginLabel(null)).toBe('')
  })
})

describe('effectiveNewsOriginIso2', () => {
  it('prefers explicit metadata over domain inference', () => {
    expect(effectiveNewsOriginIso2('GB', 'cnn.com')).toBe('GB')
  })

  it('infers origin from known news domains when metadata is missing', () => {
    expect(effectiveNewsOriginIso2('', 'www.bbc.co.uk')).toBe('GB')
    expect(effectiveNewsOriginIso2(null, 'nytimes.com')).toBe('US')
  })

  it('infers from country TLD when host is unknown', () => {
    expect(effectiveNewsOriginIso2('', 'example.de')).toBe('DE')
  })
})
