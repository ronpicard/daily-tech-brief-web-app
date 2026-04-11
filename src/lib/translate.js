/**
 * Machine translation to English for non-English headlines (GDELT / news).
 * Uses MyMemory public API; dev server proxies to avoid CORS issues.
 */

const MYMEMORY_PATH = import.meta.env.DEV
  ? '/api/mymemory/get'
  : 'https://api.mymemory.translated.net/get'

/** Map GDELT / common full names to ISO 639-1 for MyMemory langpair */
const LANG_NAME_TO_CODE = {
  english: 'en',
  greek: 'el',
  spanish: 'es',
  french: 'fr',
  german: 'de',
  italian: 'it',
  portuguese: 'pt',
  polish: 'pl',
  russian: 'ru',
  ukrainian: 'uk',
  chinese: 'zh',
  japanese: 'ja',
  korean: 'ko',
  arabic: 'ar',
  hebrew: 'he',
  turkish: 'tr',
  dutch: 'nl',
  swedish: 'sv',
  norwegian: 'no',
  danish: 'da',
  finnish: 'fi',
  czech: 'cs',
  hungarian: 'hu',
  romanian: 'ro',
  bulgarian: 'bg',
  serbian: 'sr',
  croatian: 'hr',
  slovak: 'sk',
  slovenian: 'sl',
  lithuanian: 'lt',
  latvian: 'lv',
  estonian: 'et',
  indonesian: 'id',
  vietnamese: 'vi',
  thai: 'th',
  hindi: 'hi',
  bengali: 'bn',
  urdu: 'ur',
  persian: 'fa',
  farsi: 'fa',
}

export function normalizeSourceLanguageCode(raw) {
  if (raw == null) return null
  const s = String(raw).trim().toLowerCase()
  if (!s) return null
  if (s === 'en' || s === 'english' || s === 'eng') return 'en'
  if (s.length === 2 && /^[a-z]{2}$/.test(s)) return s
  if (s.length === 3 && /^[a-z]{3}$/.test(s)) {
    const iso3to2 = {
      eng: 'en',
      ell: 'el',
      gre: 'el',
      spa: 'es',
      fra: 'fr',
      fre: 'fr',
      deu: 'de',
      ger: 'de',
      por: 'pt',
      zho: 'zh',
      chi: 'zh',
      jpn: 'ja',
      kor: 'ko',
      rus: 'ru',
      ara: 'ar',
    }
    return iso3to2[s] || null
  }
  return LANG_NAME_TO_CODE[s] || null
}

export function languageLabelForNote(code, rawFromApi) {
  if (code && code !== 'en') {
    try {
      const dn = new Intl.DisplayNames(['en'], { type: 'language' })
      const label = dn.of(code)
      if (label) return label
    } catch {
      // ignore
    }
  }
  if (rawFromApi && String(rawFromApi).trim()) {
    return String(rawFromApi).trim()
  }
  if (code) return code.toUpperCase()
  return 'another language'
}

function looksProbablyNotEnglishLatinScript(title) {
  const t = String(title || '')
  if (/[\u0370-\u03FF\u0400-\u04FF\u3040-\u30FF\u4E00-\u9FFF\u0600-\u06FF\u0590-\u05FF]/.test(t))
    return true
  return false
}

async function translateWithMyMemoryLangpair(text, langpair) {
  const q = String(text).slice(0, 480)
  if (!q.trim()) return null
  const params = new URLSearchParams({ q, langpair })
  const url = `${MYMEMORY_PATH}?${params.toString()}`
  const r = await fetch(url)
  if (!r.ok) return null
  const j = await r.json()
  const out = j?.responseData?.translatedText
  const status = j?.responseStatus
  if (status && Number(status) === 403) return null
  if (typeof out !== 'string' || !out.trim()) return null
  const trimmed = out.trim()
  if (trimmed.toLowerCase() === q.trim().toLowerCase()) return null
  return trimmed
}

/**
 * If headline is not English, translate title in place and set metadata for UI copy.
 * @param {object} hit - normalized gdelt hit with optional sourceLanguage
 */
export async function translateGdeltHitIfNeeded(hit) {
  if (hit.feed !== 'gdelt') return hit
  const rawLang = hit.sourceLanguage
  const code = normalizeSourceLanguageCode(rawLang)
  if (code === 'en') return hit

  try {
    if (code) {
      const translated = await translateWithMyMemoryLangpair(
        hit.title,
        `${code}|en`,
      )
      if (translated) {
        hit.originalTitle = hit.title
        hit.title = translated
        hit.translatedFromLabel = languageLabelForNote(code, rawLang)
      }
      return hit
    }

    if (looksProbablyNotEnglishLatinScript(hit.title)) {
      const translated = await translateWithMyMemoryLangpair(hit.title, 'auto|en')
      if (translated) {
        hit.originalTitle = hit.title
        hit.title = translated
        hit.translatedFromLabel = 'another language'
      }
    }
  } catch {
    // keep original
  }
  return hit
}

/**
 * Translate GDELT hits with a small concurrency cap for speed.
 * Mutates each hit in place (title/originalTitle/translatedFromLabel).
 */
export async function translateGdeltHitsBatched(hits, concurrency = 4) {
  const list = Array.isArray(hits) ? hits : []
  const n = Math.max(1, Math.min(8, Math.floor(concurrency) || 4))
  let i = 0
  const worker = async () => {
    while (i < list.length) {
      const idx = i++
      const h = list[idx]
      if (h?.feed === 'gdelt') {
        await translateGdeltHitIfNeeded(h)
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(n, list.length) }, worker))
  return list
}

