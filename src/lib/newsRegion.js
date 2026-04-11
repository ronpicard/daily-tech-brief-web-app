/**
 * News geography for the whole app.
 * - NEWS_REGION_ALL: no country filter (worldwide)
 * - string[]: include articles whose source country is in the set (default: ['US'])
 */

export const NEWS_REGION_ALL = 'all'

export const DEFAULT_NEWS_REGION = 'US'

export const NEWS_REGION_COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'CA', label: 'Canada' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'AU', label: 'Australia' },
  { code: 'DE', label: 'Germany' },
  { code: 'FR', label: 'France' },
  { code: 'IT', label: 'Italy' },
  { code: 'ES', label: 'Spain' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'SE', label: 'Sweden' },
  { code: 'PL', label: 'Poland' },
  { code: 'UA', label: 'Ukraine' },
  { code: 'IL', label: 'Israel' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'CN', label: 'China' },
  { code: 'IN', label: 'India' },
  { code: 'BR', label: 'Brazil' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'EG', label: 'Egypt' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'AE', label: 'United Arab Emirates' },
  { code: 'TR', label: 'Turkey' },
  { code: 'RU', label: 'Russia' },
]

const VALID_CODES = new Set(NEWS_REGION_COUNTRIES.map((c) => c.code))

/** @returns {string[]} deduped ISO2 codes, never empty (defaults to US) */
export function normalizeCountrySelection(codes) {
  const set = new Set()
  for (const raw of codes || []) {
    const c = String(raw || '')
      .trim()
      .toUpperCase()
    if (!c) continue
    const code = c === 'UK' ? 'GB' : c
    if (VALID_CODES.has(code)) set.add(code)
  }
  if (set.size === 0) set.add(DEFAULT_NEWS_REGION)
  return Array.from(set).sort()
}

/**
 * @param {boolean} worldwide
 * @param {string[]} selectedCountryCodes
 * @returns {typeof NEWS_REGION_ALL | string[]}
 */
export function resolveNewsScope(worldwide, selectedCountryCodes) {
  if (worldwide) return NEWS_REGION_ALL
  return normalizeCountrySelection(selectedCountryCodes)
}

/** Parse localStorage JSON list or migrate legacy single-country keys. */
export function loadStoredCountrySelection() {
  const worldwideStored = () =>
    localStorage.getItem('dtb.newsWorldwide') === 'true'
  try {
    const raw = localStorage.getItem('dtb.newsCountries')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return {
          worldwide: worldwideStored(),
          countries: normalizeCountrySelection(parsed),
        }
      }
    }
  } catch {
    // ignore
  }
  try {
    if (worldwideStored()) {
      return { worldwide: true, countries: [DEFAULT_NEWS_REGION] }
    }
    const legacy = localStorage.getItem('dtb.newsCountry')
    if (legacy) {
      return {
        worldwide: false,
        countries: normalizeCountrySelection([legacy]),
      }
    }
  } catch {
    // ignore
  }
  return { worldwide: false, countries: [DEFAULT_NEWS_REGION] }
}
