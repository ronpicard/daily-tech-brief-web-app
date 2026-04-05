import { hostnameFromUrl } from './hnBrief.js'

/**
 * Multi-sentence summary + guaranteed multi-sentence key takeaway.
 * @param {object} hit - normalized story hit (hn | devto | lobsters)
 */
export function buildStoryBrief(hit) {
  const host = hostnameFromUrl(hit.url) || 'news.ycombinator.com'
  const author = hit.author?.trim() || 'a member'
  const summary = buildNewsSummary(hit, host, author)
  const keyTakeaway = buildThematicTakeaway(hit, host)
  return { summary, keyTakeaway }
}

function siteName(host) {
  const raw = (host || '').replace(/^www\./, '')
  const first = raw.split('.')[0] || 'that site'
  if (first.length <= 4 && /^[a-z]+$/i.test(first)) {
    return first.toUpperCase()
  }
  return first.charAt(0).toUpperCase() + first.slice(1)
}

function capitalizeName(name) {
  if (!name) return 'Someone'
  return name.charAt(0).toUpperCase() + name.slice(1)
}

function truncateTitle(s, max) {
  const t = (s || '').trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 24 ? cut.slice(0, lastSpace) : cut) + '…'
}

function feedDisplayName(hit) {
  if (hit.feed === 'devto') return 'Dev.to'
  if (hit.feed === 'lobsters') return 'Lobsters'
  return 'Hacker News'
}

function para(a, b) {
  return `${a.trim()}\n\n${b.trim()}`
}

/** Always returns two sentences tied to real engagement numbers. */
function buildEngagementTakeaway(hit, host) {
  const title = (hit.title || '').trim() || 'This story'
  const short = truncateTitle(title, 96)
  const pts = hit.points ?? 0
  const com = hit.num_comments ?? 0
  const site = siteName(host)
  const feed = feedDisplayName(hit)
  return `“${short}” is pulling ${pts} points or reactions and ${com} comments on ${feed}, which is the crowd’s blunt instrument for saying “this matters right now.”\n\nUse that as your triage signal: skim the thread for the real thesis, then read the piece on ${site} only if the debate hooks you.`
}

function buildNewsSummary(hit, host, author) {
  const t = (hit.title || '').trim() || 'Untitled item'

  if (hit.feed === 'devto') {
    const by = author === 'someone' ? 'A Dev.to author' : capitalizeName(author)
    const site = siteName(host)
    return para(
      `${by} published “${t}” on Dev.to; the canonical link routes readers to ${site}.`,
      'Dev.to’s weekly top list favors posts that mix practical how-to with a strong hook, so expect comments that ask for follow-ups, edge cases, and tooling comparisons.',
    )
  }

  if (hit.feed === 'lobsters') {
    const by = author === 'someone' ? 'Someone' : capitalizeName(author)
    const site = siteName(host)
    return para(
      `${by} submitted “${t}” on Lobsters. The primary source lives at ${site}, while Lobsters hosts the critique-heavy thread.`,
      'That community tends to reward links with real technical depth, so the discussion is often where the nuance shows up first.',
    )
  }

  const hnWho =
    author === 'a member' ? 'A Hacker News user' : `${capitalizeName(author)}`

  if (/^show hn:/i.test(t)) {
    const rest = t.replace(/^show hn:\s*/i, '').trim()
    return para(
      `${hnWho} posted Show HN: ${rest || 'a new project'}, asking the community to react to something they shipped.`,
      'Those threads succeed when the demo is legible in one screen; the comments usually separate genuine user interest from polite encouragement.',
    )
  }
  if (/^ask hn:/i.test(t)) {
    const rest = t.replace(/^ask hn:\s*/i, '').trim()
    return para(
      `Ask HN: ${rest || 'an open question'}.`,
      'This format turns the comment section into the product—sort by “best” for consensus heuristics, or “new” if the question is moving fast and you want fresh data points.',
    )
  }
  if (/^tell hn:/i.test(t)) {
    const rest = t.replace(/^tell hn:\s*/i, '').trim()
    return para(
      `${hnWho} posted Tell HN: ${rest || 'a field note or experience'}.`,
      'Tell HN is built for first-hand accounts rather than link-outs, so readers often treat it as a sanity check on how common a problem really is.',
    )
  }

  if (!hit.url) {
    return para(
      `${hnWho} opened an on-site thread—“${t}”—that is ranking on the Hacker News front page with a busy comment section.`,
      'Without an outbound URL, the thread itself is the artifact; top-level replies usually establish the frame before the nested arguments begin.',
    )
  }

  const site = siteName(host)
  const poster =
    author === 'a member' ? 'A reader' : capitalizeName(author)
  return para(
    `${site} is carrying “${t}.” ${poster} submitted it to Hacker News, where upvotes and replies are accumulating in real time.`,
    'That combination—publisher headline plus HN velocity—is how a story jumps from niche outlet to industry-wide water-cooler talk.',
  )
}

function buildThematicTakeaway(hit, host) {
  const title = hit.title || ''
  const t = title.toLowerCase()
  const h = (host || '').toLowerCase()

  const two = (a, b) => `${a.trim()}\n\n${b.trim()}`

  if (
    /\bai\b|gpt|llm|machine learning|openai|anthropic|claude|neural|diffusion|model weights/.test(
      t,
    )
  ) {
    return two(
      'Model releases, benchmarks, and safety fights still dominate the attention economy for technical readers.',
      'The real signal is rarely the launch post alone—it is which objections get upvoted and which assumptions get quietly edited in follow-up comments.',
    )
  }
  if (
    /security|cve|vulnerability|ransomware|malware|exploit|zero-?day|breach|patch/.test(
      t,
    )
  ) {
    return two(
      'Security stories compress a long chain—disclosure, patch timing, blast radius, and blame—into a single headline.',
      'Treat the thread as a live incident review: practitioners will flag what is overstated, what is missing, and what your own runbooks should check next.',
    )
  }
  if (
    /rust|zig|go\b|typescript|kernel|linux|wasm|compiler|llvm|benchmark/.test(t)
  ) {
    return two(
      'Systems and language topics age slowly because the tradeoffs are durable: memory, performance, and compatibility do not move on a hype cycle.',
      'When one of these links spikes, it usually means a real workload somewhere hit a wall and people are shopping for a better tool or mental model.',
    )
  }
  if (/climate|energy|battery|fusion|solar|grid|ev\b|electric|carbon/.test(t)) {
    return two(
      'Energy and climate hardware stories bridge policy, physics, and capital intensity, so they draw both optimists and skeptics in the same queue.',
      'The takeaway is timeline realism: headlines move in days; factories, grids, and chemistry move in years—comments often stress-test which number is marketing and which is engineering.',
    )
  }
  if (/space|nasa|rocket|satellite|orbit|moon|mars|artemis|spacex/.test(t)) {
    return two(
      'Space coverage travels well because the visuals and stakes are easy to grasp even when the engineering is not.',
      'Use the discussion to separate program milestones from schedule fantasy—enthusiasm and schedule risk both show up loudly when a launch thread goes viral.',
    )
  }
  if (
    /startup|funding|seed|series [a-z]|vc\b|ipo|acquisition|layoff|hiring|y combinator|yc\b/.test(
      t,
    )
  ) {
    return two(
      'Funding and workforce news is a lagging indicator dressed as breaking news: by the time it hits the front page, insiders have often priced it in.',
      'Still, the comments are useful for reading which skills, geographies, and business models the crowd believes are overbought or on sale.',
    )
  }
  if (
    /google|apple|microsoft|meta|amazon|alphabet|android|iphone|windows/.test(
      t,
    ) ||
    /google|apple|microsoft|meta|amazon/.test(h)
  ) {
    return two(
      'Big-platform moves reprice whole categories overnight—ads, search, devices, and developer trust are all coupled.',
      'The thread is where smaller vendors and solo devs say out loud how a policy tweak becomes their next quarter of integration work.',
    )
  }
  if (/open.source|github|gitlab|license|gpl|mit license|foss|apache 2/.test(t)) {
    return two(
      'Open-source drama is rarely about ideology alone; it is about who maintains what under production load and who pays when things break.',
      'A hot license or governance thread is a signal that some dependency you probably use is entering a more expensive chapter.',
    )
  }
  if (/crypto|bitcoin|ethereum|blockchain|defi|nft|solana/.test(t)) {
    return two(
      'Crypto headlines oscillate between infrastructure progress and casino energy, and the same story can read both ways depending on the reader.',
      'When engagement spikes, skim for regulatory or custody detail—those are the forks that actually change what builders can ship.',
    )
  }
  if (/hardware|chip|gpu|semiconductor|tsmc|nvidia|cpu|fab\b|asic/.test(t)) {
    return two(
      'Silicon capacity is the hidden schedule for ambitious software: accelerators and fabs set ceilings that no prompt engineering can lift.',
      'A hardware-heavy thread is often a debate about who controls margin, who gets allocation, and which workloads are worth burning power on.',
    )
  }
  if (/\bgame\b|gaming|unity|unreal|steam|console|player/.test(t)) {
    return two(
      'Games sit at the intersection of consumer taste, graphics research, and online economies, so they reliably attract cross-disciplinary takes.',
      'The comments usually separate player backlash from engine or platform economics—both matter, but they imply different follow-on risks.',
    )
  }
  if (/law|regulat|eu\b|ftc|sec\b|antitrust|privacy|gdpr|copyright/.test(t)) {
    return two(
      'Regulatory items are product requirements written in public: they change what you can store, ship, and say in the UI.',
      'Threads spike when lawyers and engineers disagree on feasibility; the useful takeaway is which interpretation becomes the default until a court says otherwise.',
    )
  }
  if (/python|javascript|js\b|node|react|vue|kubernetes|docker|aws|cloud|api|database|sql|postgres|mongodb|css|html|web\b|frontend|backend/.test(t)) {
    return two(
      'Mainstream stack stories travel because they touch the median team’s daily work—tutorials, outages, and “we migrated to X” posts all map to real backlog pressure.',
      'High comment counts here often mean a religious war or a genuinely costly migration lesson; scan for production war stories before adopting the headline claim.',
    )
  }

  return buildEngagementTakeaway(hit, host)
}
