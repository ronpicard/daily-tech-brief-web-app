/**
 * Open-Meteo (no key) + optional BigDataCloud reverse geocode (no key, client endpoint).
 */

const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
const BIGDATA_REVERSE =
  'https://api.bigdatacloud.net/data/reverse-geocode-client'

/** WMO Weather interpretation codes (Open-Meteo). */
export function describeWeatherCode(code) {
  const c = Number(code)
  if (!Number.isFinite(c)) return 'Weather'
  if (c === 0) return 'Clear sky'
  if (c === 1) return 'Mainly clear'
  if (c === 2) return 'Partly cloudy'
  if (c === 3) return 'Overcast'
  if (c === 45 || c === 48) return 'Fog'
  if (c === 51 || c === 53 || c === 55) return 'Drizzle'
  if (c === 56 || c === 57) return 'Freezing drizzle'
  if (c === 61 || c === 63 || c === 65) return 'Rain'
  if (c === 66 || c === 67) return 'Freezing rain'
  if (c === 71 || c === 73 || c === 75) return 'Snow'
  if (c === 77) return 'Snow grains'
  if (c === 80 || c === 81 || c === 82) return 'Rain showers'
  if (c === 85 || c === 86) return 'Snow showers'
  if (c === 95) return 'Thunderstorm'
  if (c === 96 || c === 99) return 'Thunderstorm w/ hail'
  return 'Weather'
}

export function windCompassFromDegrees(deg) {
  if (deg == null || !Number.isFinite(Number(deg))) return ''
  const d = ((Number(deg) % 360) + 360) % 360
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(d / 45) % 8]
}

export async function fetchPlaceLabel(lat, lon) {
  const u = new URL(BIGDATA_REVERSE)
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set('localityLanguage', 'en')
  try {
    const r = await fetch(u.toString())
    if (!r.ok) return ''
    const j = await r.json()
    const city = j.city || j.locality || j.village || ''
    const sub = j.principalSubdivision || ''
    const country = j.countryName || ''
    const cc = j.countryCode || ''
    if (city && sub && city !== sub) return `${city}, ${sub}`
    if (city && cc) return `${city}, ${cc}`
    if (city) return city
    if (sub) return sub
    if (country) return country
    return ''
  } catch {
    return ''
  }
}

function parseCurrentPayload(j) {
  const cur = j?.current || {}
  const tempF = cur.temperature_2m
  const feels = cur.apparent_temperature
  const code = cur.weather_code
  const hum = cur.relative_humidity_2m
  const wind = cur.wind_speed_10m
  const windDir = cur.wind_direction_10m
  const pressure = cur.surface_pressure
  return {
    tempF: typeof tempF === 'number' ? tempF : null,
    feelsLikeF: typeof feels === 'number' ? feels : null,
    code: typeof code === 'number' ? code : null,
    summary: describeWeatherCode(code),
    humidity: typeof hum === 'number' ? hum : null,
    windMph: typeof wind === 'number' ? wind : null,
    windDirDeg: typeof windDir === 'number' ? windDir : null,
    pressureHpa: typeof pressure === 'number' ? pressure : null,
  }
}

export async function fetchCurrentWeather(lat, lon) {
  const u = new URL(OPEN_METEO)
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set(
    'current',
    [
      'temperature_2m',
      'relative_humidity_2m',
      'apparent_temperature',
      'weather_code',
      'wind_speed_10m',
      'wind_direction_10m',
      'surface_pressure',
    ].join(','),
  )
  u.searchParams.set('temperature_unit', 'fahrenheit')
  u.searchParams.set('wind_speed_unit', 'mph')
  u.searchParams.set('timezone', 'auto')
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error(String(r.status))
  const j = await r.json()
  return parseCurrentPayload(j)
}

/**
 * @returns {Promise<{ timezone?: string, days: Array<{ date: string, code: number|null, high: number|null, low: number|null, precipProb: number|null, windMaxMph: number|null, sunrise: string, sunset: string }> }>}
 */
export async function fetchDailyForecast10(lat, lon) {
  const u = new URL(OPEN_METEO)
  u.searchParams.set('latitude', String(lat))
  u.searchParams.set('longitude', String(lon))
  u.searchParams.set(
    'daily',
    [
      'weather_code',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_probability_max',
      'precipitation_sum',
      'wind_speed_10m_max',
      'sunrise',
      'sunset',
      'uv_index_max',
    ].join(','),
  )
  u.searchParams.set('forecast_days', '10')
  u.searchParams.set('temperature_unit', 'fahrenheit')
  u.searchParams.set('wind_speed_unit', 'mph')
  u.searchParams.set('timezone', 'auto')
  const r = await fetch(u.toString())
  if (!r.ok) throw new Error(String(r.status))
  const j = await r.json()
  const d = j?.daily || {}
  const times = Array.isArray(d.time) ? d.time : []
  const codes = Array.isArray(d.weather_code) ? d.weather_code : []
  const hi = Array.isArray(d.temperature_2m_max) ? d.temperature_2m_max : []
  const lo = Array.isArray(d.temperature_2m_min) ? d.temperature_2m_min : []
  const pop = Array.isArray(d.precipitation_probability_max)
    ? d.precipitation_probability_max
    : []
  const rain = Array.isArray(d.precipitation_sum) ? d.precipitation_sum : []
  const wmax = Array.isArray(d.wind_speed_10m_max) ? d.wind_speed_10m_max : []
  const sr = Array.isArray(d.sunrise) ? d.sunrise : []
  const ss = Array.isArray(d.sunset) ? d.sunset : []
  const uv = Array.isArray(d.uv_index_max) ? d.uv_index_max : []

  const days = times.map((date, i) => ({
    date,
    code: typeof codes[i] === 'number' ? codes[i] : null,
    high: typeof hi[i] === 'number' ? hi[i] : null,
    low: typeof lo[i] === 'number' ? lo[i] : null,
    precipProb: typeof pop[i] === 'number' ? pop[i] : null,
    precipMm: typeof rain[i] === 'number' ? rain[i] : null,
    windMaxMph: typeof wmax[i] === 'number' ? wmax[i] : null,
    sunrise: sr[i] || '',
    sunset: ss[i] || '',
    uvMax: typeof uv[i] === 'number' ? uv[i] : null,
  }))

  return { timezone: j?.timezone, days }
}
