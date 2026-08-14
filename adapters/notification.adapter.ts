// Pure API -> UI transforms extracted from service/inAppNotificationService.ts.
// That service's groupNotifications() interleaves these with real I/O (per-item
// avatar-fallback fetches, an AsyncStorage-backed photo-limit check for CTA
// labels) — only the parts with no I/O and real date-math/parsing complexity
// worth testing in isolation moved here. Redirect routing (getNotificationRedirect,
// handleNotificationPress) and anything touching storage/network stays in the
// service, matching the Service (orchestration) / Adapter (pure shaping) split.

// ─── Time-ago ──────────────────────────────────────────────────────────────
// Angular: getPastingTime() — "Now" under 1 min, "Xm" under 1 hour, "Xh"
// under 1 day, empty string ('') once a day old — not a date, not "1d".
export function getPastingTime(dateaddedMs: number): string {
  const diffSec = (Date.now() - dateaddedMs) / 1000
  if (diffSec < 60) return 'Now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h`
  return ''
}

// ─── Day-of-month bucketing ─────────────────────────────────────────────────
// Angular: calculateDate()/addNotifyList() — bucket by day-of-month match
// against: today, yesterday, "this week" (2-6 days back), "last week" (7-9
// days back) — first match wins. Anything older falls through every bucket
// and is silently dropped, same as source (not a bug introduced here).
//
// Boundaries are computed ONCE per notification list (not per item) — kept as
// its own function, called once by the caller and passed into
// classifyNotificationBucket() per item, so batch-classifying a list stays
// O(n) `new Date()` calls instead of O(9n).
export interface NotificationBucketBoundaries {
  todayDom:     number
  yesterdayDom: number
  thisWeekDoms: number[]
  lastWeekDoms: number[]
}

function domDaysAgo(n: number): number {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.getDate()
}

export function computeNotificationBucketBoundaries(): NotificationBucketBoundaries {
  return {
    todayDom:     domDaysAgo(0),
    yesterdayDom: domDaysAgo(1),
    thisWeekDoms: [2, 3, 4, 5, 6].map(domDaysAgo),
    lastWeekDoms: [7, 8, 9].map(domDaysAgo),
  }
}

export type NotificationBucket = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | null

export function classifyNotificationBucket(
  dateaddedMs: number,
  boundaries: NotificationBucketBoundaries,
): NotificationBucket {
  const dom = new Date(dateaddedMs).getDate()
  if (dom === boundaries.todayDom)              return 'today'
  if (dom === boundaries.yesterdayDom)          return 'yesterday'
  if (boundaries.thisWeekDoms.includes(dom))    return 'thisWeek'
  if (boundaries.lastWeekDoms.includes(dom))    return 'lastWeek'
  return null
}

// ─── Rich text (bold-name) parsing ──────────────────────────────────────────
// Angular: title1/notificationdetails[1] are both bound with [innerHTML] —
// live payloads wrap the sender's name in <span class='name-notification'>
// (bold, notification.page.scss), inline with the rest of the sentence, e.g.
// "<span class='name-notification'>RAGUL S</span> viewed your number
// recently.". RN's <Text> doesn't interpret HTML, so without this the raw
// tags render as literal text. Parses into segments so the caller can render
// the tagged portion bold and the rest plain, matching Angular's visual
// result instead of just stripping the markup.
export interface RichTextSegment {
  text: string
  bold: boolean
}

const NAME_SPAN_RE = /<span[^>]*>([\s\S]*?)<\/span>/gi

function stripTags(value: string): string {
  return value.replace(/<[^>]*>/g, '')
}

export function parseRichNotificationText(raw: string | undefined): RichTextSegment[] {
  const value = raw ?? ''
  if (!value.includes('<')) return value ? [{ text: value, bold: false }] : []

  const segments: RichTextSegment[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  NAME_SPAN_RE.lastIndex = 0
  while ((match = NAME_SPAN_RE.exec(value))) {
    if (match.index > lastIndex) {
      const before = stripTags(value.slice(lastIndex, match.index))
      if (before) segments.push({ text: before, bold: false })
    }
    const name = stripTags(match[1] ?? '')
    if (name) segments.push({ text: name, bold: true })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < value.length) {
    const after = stripTags(value.slice(lastIndex))
    if (after) segments.push({ text: after, bold: false })
  }
  return segments
}
