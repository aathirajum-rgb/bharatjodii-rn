// Transforms a raw RESPMYCHAT RECORDLIST entry (socketService.ts's onChatList)
// into the ChatListItem UI model consumed by ConversationRow.
// Angular: messager-list.component.html's per-row bindings.
import type { ChatListRecord, ChatListItem } from '../types/interfaces/chatList.interface'

const FILE_TYPES: (number | string)[] = [3, 4, 5, '3', '4', '5']
const VIEWED_NUMBER_TYPES: (number | string)[] = [11, 12, 13, '11', '12', '13']

function resolveKind(msgType: ChatListRecord['msgType']): ChatListItem['kind'] {
  if (VIEWED_NUMBER_TYPES.includes(msgType)) return 'viewed_number'
  if (FILE_TYPES.includes(msgType)) return 'file'
  if (msgType === 2 || msgType === '2') return 'audio'
  if (msgType === 1 || msgType === '1') return 'text'
  return 'none'
}

export function adaptChatListRecord(record: ChatListRecord, loginUserId: string): ChatListItem {
  const kind = resolveKind(record.msgType)
  const isOwnMessage = String(record.SenderId) === String(loginUserId)

  return {
    matriId:      record.MatriId,
    name:         record.Name ?? '',
    photoUrl:     record.Photourl ?? '',
    isReported:   record.Reported === 'Y',
    isDeleted:    String(record.deleted) === '1',
    isPaidMember: Number(record.userType) === 1,
    isOnline:     Number(record.OnlineNow) === 1,
    unreadCount:  Number(record.UnreadCount) || 0,
    timestamp:    Number(record.TimeStamp) || 0,
    kind,
    text:         kind === 'audio' ? (record.Duration ?? '') : (record.Message ?? ''),
    isOwnMessage,
    readStatus:   Number(record.ReadStatus) || 0,
  }
}

// Angular: dedupeChatList() — a repeated infinite-scroll page or a re-sent list
// response must never show the same conversation twice.
export function dedupeChatList(items: ChatListItem[]): ChatListItem[] {
  const seen = new Set<string>()
  return items.filter(item => {
    if (!item.matriId || seen.has(item.matriId)) return false
    seen.add(item.matriId)
    return true
  })
}
