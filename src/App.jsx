import { useCallback, useEffect, useState } from 'react'
import './App.css'
import {
  commentsHref,
  formatStoryTime,
  hostnameFromUrl,
  storyHref,
} from './lib/hnBrief.js'
import { buildStoryBrief } from './lib/storyBrief.js'
import { feedLabel, fetchTopFiveStories } from './lib/topFeeds.js'

export default function App() {
  const [hits, setHits] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setStatus('loading')
    setError(null)
    try {
      const stories = await fetchTopFiveStories()
      setHits(stories)
      setStatus('ready')
    } catch (e) {
      setError(e?.message || 'Something went wrong')
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const todayLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date())

  return (
    <div className="dtb-page">
      <header className="dtb-header">
        <p className="dtb-kicker">Hacker News</p>
        <h1>Top 5 stories</h1>
        <p className="dtb-date">{todayLabel}</p>
        <p className="dtb-lede">
          Five headlines pulled from the live web: Hacker News front page, Dev.to
          top posts, and Lobsters when available—same list style, many publishers
          behind the links.
        </p>
        <div className="dtb-actions">
          <button
            type="button"
            className="dtb-btn"
            onClick={load}
            disabled={status === 'loading'}
          >
            {status === 'loading' ? 'Loading…' : 'Reload feed'}
          </button>
          {status === 'ready' && hits.length > 0 && (
            <span className="dtb-count">{hits.length} stories</span>
          )}
        </div>
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
          <ul className="dtb-stories dtb-skeleton" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="dtb-story dtb-story-skel">
                <span className="dtb-rank-skel" />
                <div className="dtb-story-body">
                  <span className="dtb-line-skel dtb-line-skel-title" />
                  <span className="dtb-line-skel dtb-line-skel-meta" />
                  <div className="dtb-brief-skel">
                    <span className="dtb-line-skel dtb-line-skel-summary" />
                    <span className="dtb-line-skel dtb-line-skel-brief" />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {hits.length > 0 && (
          <ul className="dtb-stories">
            {hits.map((hit, i) => {
              const href = storyHref(hit)
              const host =
                hostnameFromUrl(hit.url) ||
                (hit.feed === 'devto' ? 'dev.to' : 'news.ycombinator.com')
              const time = formatStoryTime(hit.created_at)
              const brief = buildStoryBrief(hit)
              const src = hit.feed || 'hn'
              return (
                <li key={hit.objectID} className="dtb-story">
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
                      {time && (
                        <>
                          <span className="dtb-dot" aria-hidden="true">
                            ·
                          </span>
                          <span className="dtb-time">{time}</span>
                        </>
                      )}
                    </div>

                    <section
                      className="dtb-brief"
                      aria-label={`Brief for story ${i + 1}`}
                    >
                      <div className="dtb-summary">
                        <span className="dtb-summary-label">Summary</span>
                        <p className="dtb-summary-text">{brief.summary}</p>
                      </div>
                      <p className="dtb-takeaway">
                        <span className="dtb-takeaway-label">Key takeaway</span>
                        {brief.keyTakeaway}
                      </p>
                    </section>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </main>

      <footer className="dtb-footer">
        <p>
          Ranked mix from{' '}
          <a
            href="https://news.ycombinator.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hacker News
          </a>{' '}
          (Algolia),{' '}
          <a href="https://dev.to" target="_blank" rel="noopener noreferrer">
            Dev.to
          </a>
          , and{' '}
          <a
            href="https://lobste.rs"
            target="_blank"
            rel="noopener noreferrer"
          >
            Lobsters
          </a>
          . Links open in a new tab.
        </p>
      </footer>
    </div>
  )
}
