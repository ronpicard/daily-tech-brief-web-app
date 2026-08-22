import { describe, expect, it } from 'vitest'
import { describeWeatherCode, windCompassFromDegrees } from './weatherApi.js'

describe('describeWeatherCode', () => {
  it('maps known WMO codes to summaries', () => {
    expect(describeWeatherCode(0)).toBe('Clear sky')
    expect(describeWeatherCode(2)).toBe('Partly cloudy')
    expect(describeWeatherCode(61)).toBe('Rain')
    expect(describeWeatherCode(95)).toBe('Thunderstorm')
  })

  it('returns a generic label for unknown or invalid codes', () => {
    expect(describeWeatherCode(999)).toBe('Weather')
    expect(describeWeatherCode(undefined)).toBe('Weather')
    expect(describeWeatherCode('x')).toBe('Weather')
  })

  it('treats null as code 0 because Number(null) is 0', () => {
    expect(describeWeatherCode(null)).toBe('Clear sky')
  })
})

describe('windCompassFromDegrees', () => {
  it('maps cardinal and intercardinal directions', () => {
    expect(windCompassFromDegrees(0)).toBe('N')
    expect(windCompassFromDegrees(45)).toBe('NE')
    expect(windCompassFromDegrees(90)).toBe('E')
    expect(windCompassFromDegrees(180)).toBe('S')
    expect(windCompassFromDegrees(270)).toBe('W')
  })

  it('normalizes negative degrees and wraps past 360', () => {
    expect(windCompassFromDegrees(-45)).toBe('NW')
    expect(windCompassFromDegrees(360)).toBe('N')
  })

  it('returns empty string for missing or invalid input', () => {
    expect(windCompassFromDegrees(null)).toBe('')
    expect(windCompassFromDegrees(undefined)).toBe('')
    expect(windCompassFromDegrees(Number.NaN)).toBe('')
  })
})
