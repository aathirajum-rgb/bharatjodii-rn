// Angular: messager-list.component.ts's getTimeOfLastMsg() — "11:40 pm" for
// today, "Yesterday" for exactly one day back, a short date otherwise.
export function formatChatTime(timestamp: number, yesterdayLabel: string): string {
  const date = new Date(timestamp)
  const now = new Date()

  const diffDays = Math.floor(
    (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())) /
      (1000 * 60 * 60 * 24),
  )

  if (diffDays === 1) return yesterdayLabel
  if (diffDays !== 0) return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`

  const hours24 = date.getHours()
  const amOrPm = hours24 >= 12 ? 'pm' : 'am'
  const hours12 = hours24 % 12 || 12
  const minutes = date.getMinutes().toString().padStart(2, '0')
  return `${hours12}:${minutes} ${amOrPm}`
}
