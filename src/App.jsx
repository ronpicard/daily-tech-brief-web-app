import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import {
  commentsHref,
  formatStoryTime,
  hostnameFromUrl,
  storyHref,
} from './lib/hnBrief.js'
import {
  DEFAULT_STORY_COUNT,
  feedLabel,
  fetchTopStories,
  NEWS_SOURCE_FEEDS,
  NEWS_SOURCE_GDELT,
  TOPIC_KEYS,
} from './lib/topFeeds.js'
import { translateGdeltHitsBatched } from './lib/translate.js'
import {
  DEFAULT_NEWS_REGION,
  NEWS_REGION_COUNTRIES,
  loadStoredCountrySelection,
  resolveNewsScope,
} from './lib/newsRegion.js'
import { BIAS_SCALE_DISCLAIMER } from './lib/mediaBias.js'
import {
  fetchCurrentWeather,
  fetchPlaceLabel,
  windCompassFromDegrees,
} from './lib/weatherApi.js'
import WeatherScreen from './WeatherScreen.jsx'

const WEATHER_EMPTY = {
  status: 'idle',
  lat: null,
  lon: null,
  locationLabel: '',
  tempF: null,
  feelsLikeF: null,
  code: null,
  summary: '',
  humidity: null,
  windMph: null,
  windDirDeg: null,
  pressureHpa: null,
}

export default function App() {
  const loadGenRef = useRef(0)
  const [hits, setHits] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [now, setNow] = useState(() => Date.now())
  const [weather, setWeather] = useState(() => ({ ...WEATHER_EMPTY }))
  const [weatherScreenOpen, setWeatherScreenOpen] = useState(false)
  const [activeTopic, setActiveTopic] = useState(() => {
    try {
      const v = localStorage.getItem('dtb.topic')
      return TOPIC_KEYS.includes(v) ? v : 'tech'
    } catch {
      return 'tech'
    }
  })
  const [storyLimit, setStoryLimit] = useState(() => {
    try {
      const n = Number(localStorage.getItem('dtb.limit'))
      return Number.isFinite(n) && n > 0 ? n : DEFAULT_STORY_COUNT
    } catch {
      return DEFAULT_STORY_COUNT
    }
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [worldwide, setWorldwide] = useState(() => {
    try {
      return loadStoredCountrySelection().worldwide
    } catch {
      return false
    }
  })
  const [selectedCountries, setSelectedCountries] = useState(() => {
    try {
      return loadStoredCountrySelection().countries
    } catch {
      return [DEFAULT_NEWS_REGION]
    }
  })
  const [newsSource, setNewsSource] = useState(() => {
    try {
      const v = localStorage.getItem('dtb.newsSource')
      return v === NEWS_SOURCE_GDELT ? NEWS_SOURCE_GDELT : NEWS_SOURCE_FEEDS
    } catch {
      return NEWS_SOURCE_FEEDS
    }
  })

  const topicLabel = useMemo(() => {
    const map = {
      tech: 'Tech',
      economy: 'Economy',
      housing: 'Housing Market',
      land: 'Land Markets',
      us: 'US News',
      politics: 'Politics',
      health: 'Health',
      finance: 'Finance',
      global: 'Global News',
    }
    return map[activeTopic] || 'Tech'
  }, [activeTopic])

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    let cancelled = false

    const loadWeather = async (lat, lon) => {
      try {
        const [locationLabel, cur] = await Promise.all([
          fetchPlaceLabel(lat, lon),
          fetchCurrentWeather(lat, lon),
        ])
        if (cancelled) return
        setWeather({
          status: 'ready',
          lat,
          lon,
          locationLabel,
          ...cur,
        })
      } catch {
        if (!cancelled) setWeather({ ...WEATHER_EMPTY, status: 'error' })
      }
    }

    setWeather({ ...WEATHER_EMPTY, status: 'loading' })
    if (!('geolocation' in navigator)) {
      setWeather({ ...WEATHER_EMPTY, status: 'error' })
      return () => {
        cancelled = true
      }
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos?.coords?.latitude
        const lon = pos?.coords?.longitude
        if (typeof lat !== 'number' || typeof lon !== 'number') {
          setWeather({ ...WEATHER_EMPTY, status: 'error' })
          return
        }
        void loadWeather(lat, lon)
      },
      () => setWeather({ ...WEATHER_EMPTY, status: 'error' }),
      { maximumAge: 1000 * 60 * 15, timeout: 8000 },
    )

    return () => {
      cancelled = true
    }
  }, [])

  const tzTimes = useMemo(() => {
    const d = new Date(now)
    const fmt = (timeZone) =>
      new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        timeZone,
      }).format(d)
    return {
      et: fmt('America/New_York'),
      ct: fmt('America/Chicago'),
      mt: fmt('America/Denver'),
      pt: fmt('America/Los_Angeles'),
      utc: fmt('UTC'),
    }
  }, [now])

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current
    setStatus('loading')
    setError(null)
    try {
      const newsScope = resolveNewsScope(worldwide, selectedCountries)
      const stories = await fetchTopStories({
        topic: activeTopic,
        limit: storyLimit,
        newsScope,
        newsSource,
      })
      if (gen !== loadGenRef.current) return
      setHits(stories)
      setStatus('ready')
      void translateGdeltHitsBatched(stories, 8).then(() => {
        if (gen !== loadGenRef.current) return
        setHits([...stories])
      })
    } catch (e) {
      if (gen !== loadGenRef.current) return
      setError(e?.message || 'Something went wrong')
      setStatus('error')
    }
  }, [activeTopic, storyLimit, worldwide, selectedCountries, newsSource])

  useEffect(() => {
    load()
  }, [load])

  /** Warm caches for other tabs after the visible topic loads (sequential to respect GDELT throttle). */
  useEffect(() => {
    if (status !== 'ready' || hits.length === 0) return

    let cancelled = false
    const run = async () => {
      const newsScope = resolveNewsScope(worldwide, selectedCountries)
      const others = TOPIC_KEYS.filter((t) => t !== activeTopic)
      for (const topic of others) {
        if (cancelled) return
        try {
          await fetchTopStories({
            topic,
            limit: storyLimit,
            newsScope,
            newsSource,
          })
        } catch {
          /* best-effort; tab will fetch on demand */
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [
    status,
    hits.length,
    activeTopic,
    storyLimit,
    worldwide,
    selectedCountries,
    newsSource,
  ])

  useEffect(() => {
    try {
      localStorage.setItem('dtb.topic', activeTopic)
    } catch {
      // ignore
    }
  }, [activeTopic])

  useEffect(() => {
    try {
      localStorage.setItem('dtb.limit', String(storyLimit))
    } catch {
      // ignore
    }
  }, [storyLimit])

  useEffect(() => {
    try {
      localStorage.setItem('dtb.newsWorldwide', worldwide ? 'true' : 'false')
      localStorage.setItem('dtb.newsCountries', JSON.stringify(selectedCountries))
    } catch {
      // ignore
    }
  }, [worldwide, selectedCountries])

  useEffect(() => {
    try {
      localStorage.setItem('dtb.newsSource', newsSource)
    } catch {
      // ignore
    }
  }, [newsSource])

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  const wxWindComp =
    weather.windDirDeg != null ? windCompassFromDegrees(weather.windDirDeg) : ''

  if (
    weatherScreenOpen &&
    weather.status === 'ready' &&
    weather.lat != null &&
    weather.lon != null
  ) {
    return (
      <WeatherScreen
        theme={activeTopic}
        onClose={() => setWeatherScreenOpen(false)}
        lat={weather.lat}
        lon={weather.lon}
        locationLabel={weather.locationLabel}
        current={{
          tempF: weather.tempF,
          feelsLikeF: weather.feelsLikeF,
          code: weather.code,
          summary: weather.summary,
          humidity: weather.humidity,
          windMph: weather.windMph,
          windDirDeg: weather.windDirDeg,
          pressureHpa: weather.pressureHpa,
        }}
      />
    )
  }

  return (
    <div className="dtb-page" data-theme={activeTopic}>
      <header className="dtb-header">
        <div className="dtb-topbar" aria-label="Status bar">
          <div className="dtb-topbar-left">
            <div className="dtb-clocks" aria-label="US time zones and UTC">
              <span className="dtb-clock">
                <span className="dtb-clock-k">ET</span>
                <span className="dtb-clock-val">{tzTimes.et}</span>
              </span>
              <span className="dtb-clock">
                <span className="dtb-clock-k">CT</span>
                <span className="dtb-clock-val">{tzTimes.ct}</span>
              </span>
              <span className="dtb-clock">
                <span className="dtb-clock-k">MT</span>
                <span className="dtb-clock-val">{tzTimes.mt}</span>
              </span>
              <span className="dtb-clock">
                <span className="dtb-clock-k">PT</span>
                <span className="dtb-clock-val">{tzTimes.pt}</span>
              </span>
              <span className="dtb-clock">
                <span className="dtb-clock-k">UTC</span>
                <span className="dtb-clock-val">{tzTimes.utc}</span>
              </span>
            </div>
            <p className="dtb-date">{todayLabel}</p>
          </div>
          <div className="dtb-topbar-end">
            <div className="dtb-top-actions">
              <button
                type="button"
                className={`dtb-btn ${status === 'loading' ? 'is-loading' : ''}`}
                onClick={load}
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Loading…' : 'Reload feed'}
              </button>
              <div className="dtb-settings">
                <button
                  type="button"
                  className="dtb-btn dtb-btn-ghost"
                  aria-expanded={settingsOpen ? 'true' : 'false'}
                  onClick={() => setSettingsOpen((v) => !v)}
                >
                  Settings
                </button>
                {settingsOpen && (
                  <div className="dtb-settings-pop" role="dialog" aria-label="Settings">
                    <div className="dtb-settings-row dtb-settings-row-stack dtb-settings-row-gap">
                      <span className="dtb-settings-label">News source</span>
                      <p className="dtb-settings-hint">
                        RSS/Atom feeds load quickly. GDELT scans global news but is slower and
                        rate-limited.
                      </p>
                      <div className="dtb-settings-choices dtb-settings-choices-wide">
                        <button
                          type="button"
                          className={`dtb-chip ${newsSource === NEWS_SOURCE_FEEDS ? 'is-active' : ''}`}
                          onClick={() => {
                            setNewsSource(NEWS_SOURCE_FEEDS)
                            setSettingsOpen(false)
                          }}
                        >
                          Feeds
                        </button>
                        <button
                          type="button"
                          className={`dtb-chip ${newsSource === NEWS_SOURCE_GDELT ? 'is-active' : ''}`}
                          onClick={() => {
                            setNewsSource(NEWS_SOURCE_GDELT)
                            setSettingsOpen(false)
                          }}
                        >
                          GDELT
                        </button>
                      </div>
                    </div>
                    <div className="dtb-settings-row">
                      <span className="dtb-settings-label">Stories</span>
                      <div className="dtb-settings-choices">
                        {[5, 10, 15, 25].map((n) => (
                          <button
                            key={n}
                            type="button"
                            className={`dtb-chip ${storyLimit === n ? 'is-active' : ''}`}
                            onClick={() => {
                              setStoryLimit(n)
                              setSettingsOpen(false)
                            }}
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="dtb-settings-row dtb-settings-row-gap">
                      <span className="dtb-settings-label">Worldwide</span>
                      <label className="dtb-check">
                        <input
                          type="checkbox"
                          checked={worldwide}
                          onChange={(e) => setWorldwide(e.target.checked)}
                        />
                        <span>All countries</span>
                      </label>
                    </div>
                    <div className="dtb-settings-row dtb-settings-row-stack dtb-settings-row-gap">
                      <span className="dtb-settings-label">Countries</span>
                      <p className="dtb-settings-hint">
                        When worldwide is off, only checked countries appear (default: US).
                      </p>
                      <div
                        className={`dtb-country-grid ${worldwide ? 'is-disabled' : ''}`}
                        aria-disabled={worldwide ? 'true' : 'false'}
                      >
                        {NEWS_REGION_COUNTRIES.map((c) => (
                          <label key={c.code} className="dtb-check dtb-check-compact">
                            <input
                              type="checkbox"
                              checked={selectedCountries.includes(c.code)}
                              disabled={worldwide}
                              onChange={() => {
                                setWorldwide(false)
                                setSelectedCountries((prev) => {
                                  const next = new Set(prev)
                                  if (next.has(c.code)) {
                                    next.delete(c.code)
                                    if (next.size === 0) next.add(DEFAULT_NEWS_REGION)
                                  } else {
                                    next.add(c.code)
                                  }
                                  return Array.from(next).sort()
                                })
                              }}
                            />
                            <span>{c.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="dtb-weather" aria-label="Local weather">
              {weather.status === 'loading' && (
                <span className="dtb-weather-loading">
                  Weather<span className="dtb-ellipsis" aria-hidden="true" />
                </span>
              )}
              {weather.status === 'ready' && (
                <button
                  type="button"
                  className="dtb-weather-btn"
                  onClick={() => {
                    setSettingsOpen(false)
                    setWeatherScreenOpen(true)
                  }}
                >
                  <span className="dtb-weather-loc">
                    {weather.locationLabel || 'Your location'}
                  </span>
                  <span className="dtb-weather-line">
                    <strong>
                      {weather.tempF != null ? `${Math.round(weather.tempF)}°F` : '—'}
                    </strong>
                    {weather.summary ? ` · ${weather.summary}` : ''}
                  </span>
                  <span className="dtb-weather-meta">
                    {weather.feelsLikeF != null && (
                      <>Feels {Math.round(weather.feelsLikeF)}°F</>
                    )}
                    {weather.humidity != null && (
                      <>
                        {weather.feelsLikeF != null ? ' · ' : ''}
                        Humidity {Math.round(weather.humidity)}%
                      </>
                    )}
                    {weather.windMph != null && (
                      <>
                        {(weather.feelsLikeF != null || weather.humidity != null) && ' · '}
                        Wind {wxWindComp ? `${wxWindComp} ` : ''}
                        {Math.round(weather.windMph)} mph
                      </>
                    )}
                    {weather.pressureHpa != null && (
                      <>
                        {(weather.feelsLikeF != null ||
                          weather.humidity != null ||
                          weather.windMph != null) &&
                          ' · '}
                        {Math.round(weather.pressureHpa)} hPa
                      </>
                    )}
                  </span>
                  <span className="dtb-weather-hint">Open 10-day forecast</span>
                </button>
              )}
              {weather.status === 'error' && (
                <span className="dtb-weather-error">Weather unavailable</span>
              )}
            </div>
          </div>
        </div>

        <p className="dtb-kicker">Daily Brief</p>
        <h1 className="dtb-headline" key={`${activeTopic}-${storyLimit}`}>
          {topicLabel}: Top {storyLimit} Stories
        </h1>
        <nav className="dtb-tabs" aria-label="Topics">
          {[
            { key: 'tech', label: 'Tech' },
            { key: 'economy', label: 'Economy' },
            { key: 'housing', label: 'Housing' },
            { key: 'land', label: 'Land' },
            { key: 'us', label: 'US' },
            { key: 'politics', label: 'Politics' },
            { key: 'health', label: 'Health' },
            { key: 'finance', label: 'Finance' },
            { key: 'global', label: 'Global' },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              className={`dtb-tab ${activeTopic === t.key ? 'is-active' : ''}`}
              onClick={() => {
                setHits([])
                setStatus('loading')
                setError(null)
                setActiveTopic(t.key)
                setSettingsOpen(false)
              }}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="dtb-main">
        {error && (
          <div className="dtb-banner" role="alert">
            <p>{error}</p>
            <button type="button" className="dtb-btn dtb-btn-ghost" onClick={load}>
              Try again
            </button>
          </div>
        )}

        {status === 'loading' && hits.length === 0 && !error && (
          <ul
            key={`skel-${activeTopic}`}
            className="dtb-stories dtb-skeleton dtb-stories-enter"
            aria-hidden="true"
          >
            {Array.from({ length: storyLimit }, (_, i) => (
              <li key={i} className="dtb-story dtb-story-skel">
                <span className="dtb-rank-skel" />
                <div className="dtb-story-body">
                  <span className="dtb-line-skel dtb-line-skel-title" />
                  <span className="dtb-line-skel dtb-line-skel-meta" />
                </div>
              </li>
            ))}
          </ul>
        )}

        {hits.length > 0 && (
          <ul key={`list-${activeTopic}`} className="dtb-stories dtb-stories-enter">
            {hits.map((hit, i) => {
              const href = storyHref(hit)
              const host =
                hostnameFromUrl(hit.url) ||
                (hit.feed === 'devto' ? 'dev.to' : 'news.ycombinator.com')
              const time = formatStoryTime(hit.created_at)
              const src = hit.feed || 'hn'
              const isNews = src === 'gdelt' || src === 'rss'
              return (
                <li key={hit.objectID} className="dtb-story" style={{ '--dtb-i': i }}>
                  <span className="dtb-rank" aria-hidden="true">
                    {i + 1}
                  </span>
                  <div className="dtb-story-body">
                    <a
                      href={href}
                      className="dtb-title"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {hit.title}
                    </a>
                    <div className="dtb-meta">
                      <span
                        className={`dtb-feed dtb-feed-${src}`}
                        title="Where this item was ranked"
                      >
                        {feedLabel(src)}
                      </span>
                      <span className="dtb-dot" aria-hidden="true">
                        ·
                      </span>
                      <span className="dtb-host">{host}</span>
                      {isNews && hit.sourceCountryLabel && (
                        <>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <span className="dtb-origin" title="Country of origin">
                            {hit.sourceCountryLabel}
                          </span>
                        </>
                      )}
                      {isNews && activeTopic === 'politics' && hit.biasLabel && (
                        <>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <span
                            className="dtb-bias"
                            title={BIAS_SCALE_DISCLAIMER}
                          >
                            {hit.biasLabel}
                          </span>
                        </>
                      )}
                      {!isNews && (
                        <>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <span>
                            {hit.points != null ? `${hit.points} pts` : '—'}
                          </span>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <a
                            href={commentsHref(hit)}
                            className="dtb-comments"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {hit.num_comments != null
                              ? `${hit.num_comments} comments`
                              : 'Discuss'}
                          </a>
                        </>
                      )}
                      {isNews && (
                        <>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <a
                            href={href}
                            className="dtb-comments"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Read
                          </a>
                        </>
                      )}
                      {time && (
                        <>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <span className="dtb-time">{time}</span>
                        </>
                      )}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>
    </div>
  )
}
