import { describe, expect, it } from 'vitest'
import { biasCategoryFromScore, mediaBiasForDomain } from './mediaBias.js'

describe('biasCategoryFromScore', () => {
  it('maps score bands to user-facing categories', () => {
    expect(biasCategoryFromScore(1)).toBe('Very left')
    expect(biasCategoryFromScore(3)).toBe('Left')
    expect(biasCategoryFromScore(5)).toBe('Middle')
    expect(biasCategoryFromScore(7)).toBe('Right')
    expect(biasCategoryFromScore(10)).toBe('Very right')
  })

  it('clamps out-of-range scores and defaults falsy values to middle', () => {
    // 0 is falsy, so Number(0) || 5 becomes 5
    expect(biasCategoryFromScore(0)).toBe('Middle')
    expect(biasCategoryFromScore(99)).toBe('Very right')
    expect(biasCategoryFromScore('x')).toBe('Middle')
  })
})

describe('mediaBiasForDomain', () => {
  it('looks up known outlets and strips www', () => {
    expect(mediaBiasForDomain('www.foxnews.com')).toEqual({ category: 'Right' })
    expect(mediaBiasForDomain('msnbc.com')).toEqual({ category: 'Very left' })
    expect(mediaBiasForDomain('reuters.com')).toEqual({ category: 'Middle' })
  })

  it('defaults unknown or empty domains to middle', () => {
    expect(mediaBiasForDomain('unknown-news.example')).toEqual({
      category: 'Middle',
    })
    expect(mediaBiasForDomain('')).toEqual({ category: 'Middle' })
  })
})
