import { useCallback, useEffect, useState } from 'react'
import {
  describeWeatherCode,
  fetchDailyForecast10,
  windCompassFromDegrees,
} from './lib/weatherApi.js'

function formatDayRow(isoDate, sunrise, sunset) {
  if (!isoDate) return { dow: '', short: '' }
  const d = new Date(isoDate + 'T12:00:00')
  const dow = new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(d)
  const short = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(d)
  let rise = ''
  let set = ''
  if (sunrise) {
    try {
      rise = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(sunrise))
    } catch {
      rise = ''
    }
  }
  if (sunset) {
    try {
      set = new Intl.DateTimeFormat(undefined, {
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date(sunset))
    } catch {
      set = ''
    }
  }
  return { dow, short, rise, set }
}

export default function WeatherScreen({
  theme,
  onClose,
  lat,
  lon,
  locationLabel,
  current,
}) {
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)
  const [days, setDays] = useState([])

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const { days: d } = await fetchDailyForecast10(lat, lon)
      setDays(d)
      setStatus('ready')
    } catch (e) {
      setError(e?.message || 'Could not load forecast')
      setStatus('error')
    }
  }, [lat, lon])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const wComp =
    current?.windDirDeg != null
      ? windCompassFromDegrees(current.windDirDeg)
      : ''

  return (
    <div className="dtb-page dtb-weather-page" data-theme={theme}>
      <header className="dtb-weather-screen-header">
        <button type="button" className="dtb-btn dtb-btn-ghost dtb-weather-back" onClick={onClose}>
          ← Back to brief
        </button>
        <h1 className="dtb-weather-screen-title">Weather</h1>
        <p className="dtb-weather-screen-sub">{locationLabel || 'Your location'}</p>
      </header>

      {current && (
        <section className="dtb-weather-now" aria-label="Current conditions">
          <div className="dtb-weather-now-temp">
            <span className="dtb-weather-now-deg">
              {current.tempF != null ? `${Math.round(current.tempF)}°` : '—'}
            </span>
            <span className="dtb-weather-now-desc">{current.summary || '—'}</span>
          </div>
          <ul className="dtb-weather-now-grid">
            {current.feelsLikeF != null && (
              <li>
                <span className="dtb-wx-k">Feels like</span>
                <span className="dtb-wx-v">{Math.round(current.feelsLikeF)}°F</span>
              </li>
            )}
            {current.humidity != null && (
              <li>
                <span className="dtb-wx-k">Humidity</span>
                <span className="dtb-wx-v">{Math.round(current.humidity)}%</span>
              </li>
            )}
            {current.windMph != null && (
              <li>
                <span className="dtb-wx-k">Wind</span>
                <span className="dtb-wx-v">
                  {wComp ? `${wComp} ` : ''}
                  {Math.round(current.windMph)} mph
                </span>
              </li>
            )}
            {current.pressureHpa != null && (
              <li>
                <span className="dtb-wx-k">Pressure</span>
                <span className="dtb-wx-v">{Math.round(current.pressureHpa)} hPa</span>
              </li>
            )}
          </ul>
        </section>
      )}

      <main className="dtb-weather-screen-main">
        <h2 className="dtb-weather-10d-title">10-day outlook</h2>
        {status === 'loading' && <p className="dtb-weather-screen-msg">Loading forecast…</p>}
        {status === 'error' && (
          <div className="dtb-weather-screen-err">
            <p>{error}</p>
            <button type="button" className="dtb-btn" onClick={() => void load()}>
              Retry
            </button>
          </div>
        )}
        {status === 'ready' && days.length > 0 && (
          <ul className="dtb-weather-10d" aria-label="Daily forecast for 10 days">
            {days.map((day, i) => {
              const { dow, short, rise, set } = formatDayRow(
                day.date,
                day.sunrise,
                day.sunset,
              )
              const desc = describeWeatherCode(day.code)
              return (
                <li
                  key={day.date}
                  className="dtb-weather-day"
                  style={{ '--wx-i': i }}
                >
                  <div className="dtb-weather-day-date">
                    <span className="dtb-weather-day-dow">{dow}</span>
                    <span className="dtb-weather-day-num">{short}</span>
                  </div>
                  <div className="dtb-weather-day-info">
                    <span className="dtb-weather-day-desc">{desc}</span>
                    <span className="dtb-weather-day-sun">
                      {rise && set ? `Sunrise ${rise} · Sunset ${set}` : ''}
                    </span>
                  </div>
                  <div className="dtb-weather-day-temps">
                    {day.high != null && day.low != null && (
                      <span className="dtb-weather-day-hilo">
                        <span className="dtb-hi">{Math.round(day.high)}°</span>
                        <span className="dtb-lo">{Math.round(day.low)}°</span>
                      </span>
                    )}
                  </div>
                  <div className="dtb-weather-day-meta">
                    {day.precipProb != null && (
                      <span title="Chance of precipitation">
                        Rain {Math.round(day.precipProb)}%
                      </span>
                    )}
                    {day.precipMm != null && day.precipMm > 0 && (
                      <span title="Precipitation amount">{day.precipMm.toFixed(1)} mm</span>
                    )}
                    {day.windMaxMph != null && (
                      <span title="Max wind">Wind {Math.round(day.windMaxMph)} mph</span>
                    )}
                    {day.uvMax != null && (
                      <span title="UV index">UV {day.uvMax.toFixed(1)}</span>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <footer className="dtb-weather-screen-foot">
        <p>
          Forecast from{' '}
          <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer">
            Open-Meteo
          </a>
          . Location name may use{' '}
          <a
            href="https://www.bigdatacloud.com/packages/reverse-geocoding"
            target="_blank"
            rel="noopener noreferrer"
          >
            BigDataCloud
          </a>
          .
        </p>
      </footer>
    </div>
  )
}
