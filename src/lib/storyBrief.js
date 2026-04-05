import { hostnameFromUrl } from './hnBrief.js'

/**
 * Plain-English summary + takeaway from HN headline and metadata.
 * @param {object} hit - Algolia HN hit
 */
export function buildStoryBrief(hit) {
  const host = hostnameFromUrl(hit.url) || 'news.ycombinator.com'
  const author = hit.author?.trim() || 'a member'
  const summary = buildNewsSummary(hit, host, author)
  const keyTakeaway = buildThematicTakeaway(hit.title, host)
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

function buildNewsSummary(hit, host, author) {
  const t = (hit.title || '').trim() || 'something with no title'

  if (hit.feed === 'devto') {
    const by = author === 'someone' ? 'Someone' : author
    const site = siteName(host)
    return `${by} published “${t}” on Dev.to. The outbound link goes to ${site}.`
  }

  if (hit.feed === 'lobsters') {
    const by = author === 'someone' ? 'Someone' : author
    const site = siteName(host)
    return `${by} posted “${t}” on Lobsters. The story is hosted at ${site}, with discussion on Lobsters.`
  }

  const who =
    author === 'a member'
      ? 'Someone on Hacker News'
      : `${author} on Hacker News`

  if (/^show hn:/i.test(t)) {
    const rest = t.replace(/^show hn:\s*/i, '').trim()
    return `${who} posted a Show HN about ${rest || 'their project'}. They are showing what they built and asking for feedback.`
  }
  if (/^ask hn:/i.test(t)) {
    const rest = t.replace(/^ask hn:\s*/i, '').trim()
    return `People on Hacker News are discussing this question: ${rest || 'an open topic'}. The answers are in the thread.`
  }
  if (/^tell hn:/i.test(t)) {
    const rest = t.replace(/^tell hn:\s*/i, '').trim()
    return `${who} wrote a Tell HN post about ${rest || 'something that happened to them'}.`
  }

  if (!hit.url) {
    return `${who} started a thread on Hacker News titled “${t}.” It is on the front page and getting lots of comments.`
  }

  const site = siteName(host)
  const postedBy =
    author === 'a member' ? 'someone' : author
  return `The site ${site} published a piece called “${t}.” ${postedBy.charAt(0).toUpperCase() + postedBy.slice(1)} shared it on Hacker News, and readers are upvoting and commenting.`
}

function buildThematicTakeaway(title, host) {
  const t = (title || '').toLowerCase()
  const h = (host || '').toLowerCase()

  if (
    /\bai\b|gpt|llm|machine learning|openai|anthropic|claude|neural|diffusion|model weights/.test(
      t,
    )
  ) {
    return 'Artificial intelligence is still the biggest magnet for tech news and debate. Expect more stories like this for a while.'
  }
  if (
    /security|cve|vulnerability|ransomware|malware|exploit|zero-?day|breach|patch/.test(
      t,
    )
  ) {
    return 'Security never really leaves the spotlight. Teams have to treat hacks, bugs, and patches as part of normal work, not one-off surprises.'
  }
  if (
    /rust|zig|go\b|typescript|kernel|linux|wasm|compiler|llvm|benchmark/.test(t)
  ) {
    return 'Developers still care a lot about languages, speed, and how software talks to hardware. Those topics keep showing up even when the rest of the news is louder.'
  }
  if (/climate|energy|battery|fusion|solar|grid|ev\b|electric|carbon/.test(t)) {
    return 'Clean energy and climate tech keep drawing attention. These are slow, expensive projects, but people stay interested.'
  }
  if (/space|nasa|rocket|satellite|orbit|moon|mars|artemis|spacex/.test(t)) {
    return 'Space stories still pull a big audience. Launches and missions are easy to understand and easy to get excited about.'
  }
  if (
    /startup|funding|seed|series [a-z]|vc\b|ipo|acquisition|layoff|hiring|y combinator|yc\b/.test(
      t,
    )
  ) {
    return 'Money and jobs in tech move fast. Funding, layoffs, and hiring news tells you where the industry thinks it is headed.'
  }
  if (
    /google|apple|microsoft|meta|amazon|alphabet|android|iphone|windows/.test(
      t,
    ) ||
    /google|apple|microsoft|meta|amazon/.test(h)
  ) {
    return 'When a giant tech company sneezes, the rest of the industry notices. One change from them can affect tools, ads, and rules for everyone else.'
  }
  if (/open.source|github|gitlab|license|gpl|mit license|foss|apache 2/.test(t)) {
    return 'Open source keeps running into the same questions: who owns the code, who maintains it, and what users are allowed to do with it.'
  }
  if (/crypto|bitcoin|ethereum|blockchain|defi|nft|solana/.test(t)) {
    return 'Crypto news comes in waves. It heats up when laws, prices, or big failures make headlines, then quiets down until the next shock.'
  }
  if (/hardware|chip|gpu|semiconductor|tsmc|nvidia|cpu|fab\b|asic/.test(t)) {
    return 'Chips and hardware still limit what software can do. If factories or GPUs are tight, product plans have to wait.'
  }
  if (/\bgame\b|gaming|unity|unreal|steam|console|player/.test(t)) {
    return 'Games matter both as entertainment and as a test bed for graphics, online play, and user-made content.'
  }
  if (/law|regulat|eu\b|ftc|sec\b|antitrust|privacy|gdpr|copyright/.test(t)) {
    return 'Laws and regulators are part of shipping products now. Privacy and competition rules shape what companies can build and sell.'
  }

  return 'This story does not fit one neat box. That often means it touches several topics at once, so it is worth reading if it affects your work or interests.'
}
