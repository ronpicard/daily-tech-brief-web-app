/**
 * Human-readable country label from GDELT / API strings (often ISO 3166-1 alpha-2).
 */
export function formatCountryOfOriginLabel(raw) {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''

  const upper = s.toUpperCase()
  if (upper === 'UK' || upper === 'GBR') {
    try {
      return new Intl.DisplayNames(['en'], { type: 'region' }).of('GB')
    } catch {
      return 'United Kingdom'
    }
  }

  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) {
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'region' })
      return dn.of(upper) || s
    } catch {
      return s
    }
  }

  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
    const iso3 = {
      USA: 'US',
      GBR: 'GB',
      GRC: 'GR',
      DEU: 'DE',
      FRA: 'FR',
      ESP: 'ES',
      ITA: 'IT',
      UKR: 'UA',
      RUS: 'RU',
      CHN: 'CN',
      JPN: 'JP',
    }
    const two = iso3[upper]
    if (two) {
      try {
        return new Intl.DisplayNames(['en'], { type: 'region' }).of(two)
      } catch {
        return s
      }
    }
  }

  return s
}

/** ISO 3166-1 alpha-2 for filtering GDELT sourcecountry. */
export function normalizeToIso3166Alpha2(raw) {
  if (raw == null) return ''
  const s = String(raw).trim()
  if (!s) return ''
  const upper = s.toUpperCase()
  if (upper === 'UK') return 'GB'
  if (upper.length === 2 && /^[A-Z]{2}$/.test(upper)) return upper

  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper)) {
    const iso3To2 = {
      USA: 'US',
      GBR: 'GB',
      CAN: 'CA',
      AUS: 'AU',
      DEU: 'DE',
      FRA: 'FR',
      ITA: 'IT',
      ESP: 'ES',
      NLD: 'NL',
      SWE: 'SE',
      POL: 'PL',
      UKR: 'UA',
      ISR: 'IL',
      JPN: 'JP',
      KOR: 'KR',
      CHN: 'CN',
      IND: 'IN',
      BRA: 'BR',
      MEX: 'MX',
      NGA: 'NG',
      ZAF: 'ZA',
      EGY: 'EG',
      SAU: 'SA',
      ARE: 'AE',
      TUR: 'TR',
      RUS: 'RU',
      GRC: 'GR',
    }
    return iso3To2[upper] || ''
  }

  return ''
}

/**
 * Known news host → ISO2 when GDELT omits `sourcecountry` (common for wire stories).
 * Only hosts we can assign confidently; unknown .com stays unclassified.
 */
const NEWS_HOST_TO_ISO2 = {
  'nytimes.com': 'US',
  'washingtonpost.com': 'US',
  'wsj.com': 'US',
  'cnn.com': 'US',
  'msnbc.com': 'US',
  'foxnews.com': 'US',
  'nbcnews.com': 'US',
  'msn.com': 'US',
  'drudgereport.com': 'US',
  'apnews.com': 'US',
  'politico.com': 'US',
  'axios.com': 'US',
  'npr.org': 'US',
  'pbs.org': 'US',
  'nypost.com': 'US',
  'latimes.com': 'US',
  'chicagotribune.com': 'US',
  'bostonglobe.com': 'US',
  'sfchronicle.com': 'US',
  'techcrunch.com': 'US',
  'theverge.com': 'US',
  'wired.com': 'US',
  'arstechnica.com': 'US',
  'engadget.com': 'US',
  'cnet.com': 'US',
  'zdnet.com': 'US',
  'bloomberg.com': 'US',
  'forbes.com': 'US',
  'cnbc.com': 'US',
  'marketwatch.com': 'US',
  'theatlantic.com': 'US',
  'time.com': 'US',
  'usatoday.com': 'US',
  'reuters.com': 'GB',
  'bbc.co.uk': 'GB',
  'bbc.com': 'GB',
  'theguardian.com': 'GB',
  'telegraph.co.uk': 'GB',
  'independent.co.uk': 'GB',
  'ft.com': 'GB',
  'economist.com': 'GB',
  'spiegel.de': 'DE',
  'lemonde.fr': 'FR',
  'elpais.com': 'ES',
}

function inferIso2FromNewsDomain(domain) {
  if (!domain) return ''
  const d = String(domain).toLowerCase().replace(/^www\./, '')
  if (!d) return ''

  for (const [host, iso] of Object.entries(NEWS_HOST_TO_ISO2)) {
    if (d === host || d.endsWith(`.${host}`)) return iso
  }

  if (d.endsWith('.co.uk') || d.endsWith('.uk')) return 'GB'
  if (d.endsWith('.com.au') || d.endsWith('.au')) return 'AU'
  if (d.endsWith('.co.jp') || d.endsWith('.ne.jp') || d.endsWith('.or.jp') || d.endsWith('.jp'))
    return 'JP'
  if (d.endsWith('.co.kr') || d.endsWith('.kr')) return 'KR'
  if (d.endsWith('.com.br') || d.endsWith('.br')) return 'BR'
  if (d.endsWith('.de')) return 'DE'
  if (d.endsWith('.fr')) return 'FR'
  if (d.endsWith('.it')) return 'IT'
  if (d.endsWith('.es')) return 'ES'
  if (d.endsWith('.nl')) return 'NL'
  if (d.endsWith('.se')) return 'SE'
  if (d.endsWith('.pl')) return 'PL'
  if (d.endsWith('.il') || d.endsWith('.co.il')) return 'IL'
  if (d.endsWith('.cn')) return 'CN'
  if (d.endsWith('.in') || d.endsWith('.co.in')) return 'IN'
  if (d.endsWith('.mx')) return 'MX'
  if (d.endsWith('.ru')) return 'RU'
  if (d.endsWith('.ua')) return 'UA'
  if (d.endsWith('.tr')) return 'TR'
  if (d.endsWith('.gov.uk')) return 'GB'
  if (d.endsWith('.gov') && !d.endsWith('.gov.uk')) return 'US'
  if (d.endsWith('.mil')) return 'US'
  if (d.endsWith('.edu')) return 'US'

  return ''
}

/** Prefer GDELT metadata; otherwise coarse domain / TLD hint (never overrides explicit metadata). */
export function effectiveNewsOriginIso2(raw, domain) {
  const meta = normalizeToIso3166Alpha2(raw)
  if (meta) return meta
  return inferIso2FromNewsDomain(domain)
}
