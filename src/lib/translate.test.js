import { describe, expect, it } from 'vitest'
import {
  languageLabelForNote,
  normalizeSourceLanguageCode,
} from './translate.js'

describe('normalizeSourceLanguageCode', () => {
  it('normalizes English aliases to en', () => {
    expect(normalizeSourceLanguageCode('en')).toBe('en')
    expect(normalizeSourceLanguageCode('English')).toBe('en')
    expect(normalizeSourceLanguageCode('eng')).toBe('en')
  })

  it('maps full names and iso3 codes', () => {
    expect(normalizeSourceLanguageCode('Spanish')).toBe('es')
    expect(normalizeSourceLanguageCode('deu')).toBe('de')
    expect(normalizeSourceLanguageCode('ell')).toBe('el')
  })

  it('returns null for blank or unknown values', () => {
    expect(normalizeSourceLanguageCode('')).toBe(null)
    expect(normalizeSourceLanguageCode(null)).toBe(null)
    expect(normalizeSourceLanguageCode('not-a-language')).toBe(null)
  })
})

describe('languageLabelForNote', () => {
  it('returns a display name for known language codes', () => {
    expect(languageLabelForNote('es')).toBe('Spanish')
  })

  it('falls back to the raw API string when needed', () => {
    expect(languageLabelForNote(null, 'Klingon')).toBe('Klingon')
  })
})
