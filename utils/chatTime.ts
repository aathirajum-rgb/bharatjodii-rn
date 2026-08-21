function _diffDays(timestamp: number): number {
  const date = new Date(timestamp)
  const now = new Date()
  return Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      (1000 * 60 * 60 * 24),
  )
}

// "11:40 pm" — a bare clock time, no date component. Angular: getTime()/
// getTimeOfLastMsg()'s time-only branch, used as-is for chat bubble stamps.
export function formatClockTime(timestamp: number): string {
  const date = new Date(timestamp)
  const hours24 = date.getHours()
  const amOrPm = hours24 >= 12 ? 'pm' : 'am'
  const hours12 = hours24 % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours12}:${minutes} ${amOrPm}`
}

// Angular: messager-list.component.ts's getTimeOfLastMsg() — "11:40 pm" for
// today, "Yesterday" for exactly one day back, a short date otherwise.
export function formatChatTime(timestamp: number, yesterdayLabel: string): string {
  const diffDays = _diffDays(timestamp)
  if (diffDays === 1) return yesterdayLabel
  if (diffDays !== 0) {
    const date = new Date(timestamp)
    return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
  }
  return formatClockTime(timestamp)
}

// Angular: messages.component.ts's getDayType() — the date-separator pill
// text inside a chat thread ("Today" / "Yesterday" / "D/M/YYYY"), distinct
// from formatChatTime() above which also returns a bare clock time for today.
export function getDayLabel(timestamp: number, todayLabel: string, yesterdayLabel: string): string {
  const diffDays = _diffDays(timestamp)
  if (diffDays === 0) return todayLabel
  if (diffDays === 1) return yesterdayLabel
  const date = new Date(timestamp)
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`
}

// Angular: messages.component.ts's getTimeOfLastMsg() — the chat HEADER's
// "last active" relative text (distinct from formatChatTime's absolute list
// timestamps): Online while isOnline is true, else a coarse "Active X ago".
export function formatLastActive(
  lastLoginMs: number,
  labels: { minute: string; hour: string; day: string; week: string; month: string; year: string },
): string {
  const diffSeconds = Math.max(0, (Date.now() - lastLoginMs) / 1000)
  const MIN = 60, HOUR = 3600, DAY = 86400, WEEK = 604800, MONTH = 2419200, YEAR = 29030400

  if (diffSeconds < HOUR)  return labels.minute.replace('#TIME#', String(Math.max(1, Math.floor(diffSeconds / MIN))))
  if (diffSeconds < DAY)   return labels.hour.replace('#TIME#', String(Math.floor(diffSeconds / HOUR)))
  if (diffSeconds < WEEK)  return labels.day.replace('#TIME#', String(Math.floor(diffSeconds / DAY)))
  if (diffSeconds < MONTH) return labels.week.replace('#TIME#', String(Math.floor(diffSeconds / WEEK)))
  if (diffSeconds < YEAR)  return labels.month.replace('#TIME#', String(Math.floor(diffSeconds / MONTH)))
  return labels.year.replace('#TIME#', String(Math.floor(diffSeconds / YEAR)))
}
