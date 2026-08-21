// Transforms raw one-to-one thread records (RESPMESSAGE's CHATLIST, RESPSEND's
// ack) into the ChatMessageItem UI model, plus the day-grouping ChatScreen
// renders — Angular: messages.component.ts's groupByDate()/getDayType().
import type { ChatMessageRecord, ChatMessageItem, SendMessageResponse } from '../types/interfaces/chatMessage.interface'
import { getDayLabel } from '../utils/chatTime'

const VIEWED_NUMBER_TYPES: (number | string)[] = [11, 12, 13, '11', '12', '13']
const TEXT_TYPES: (number | string)[] = [1, '1']
// Angular: messages.component.ts:144 — "type 1 = text, 2 = audio, 3 = video,
// 4 = pdf, 5 = image" — confirmed against all 4 sent/received template blocks.
const VIDEO_TYPES: (number | string)[] = [3, '3']
const IMAGE_TYPES: (number | string)[] = [5, '5']
const AUDIO_TYPES: (number | string)[] = [2, '2']

function resolveKind(messageType: ChatMessageRecord['MessageType']): ChatMessageItem['kind'] {
  if (VIEWED_NUMBER_TYPES.includes(messageType)) return 'viewed_number'
  if (IMAGE_TYPES.includes(messageType)) return 'image'
  if (VIDEO_TYPES.includes(messageType)) return 'video'
  if (AUDIO_TYPES.includes(messageType)) return 'audio'
  if (TEXT_TYPES.includes(messageType) || messageType == null || messageType === '') return 'text'
  return 'other'
}

export function adaptChatMessageRecord(record: ChatMessageRecord, ownUserId: string): ChatMessageItem {
  const senderId = record.SenderId ?? record.MatriId ?? ''
  const item: ChatMessageItem = {
    id:           String(record.MessageTime),
    text:         record.Message ?? '',
    timestamp:    Number(record.MessageTime) || 0,
    isOwnMessage: String(senderId) === String(ownUserId),
    readStatus:   Number(record.RStatus) || 0,
    kind:         resolveKind(record.MessageType),
  }
  if (record.Duration) item.duration = record.Duration
  return item
}

// Angular: getSendResp()'s locally-built row — RStatus is hardcoded 1 ("sent")
// here regardless of ack content, matching Angular's own behavior exactly.
// fallbackDuration: RESPSEND isn't confirmed to echo Duration back for a voice
// message — the caller's own locally-recorded duration is used if it's absent.
export function adaptSendResponse(res: SendMessageResponse, ownUserId: string, fallbackDuration?: string): ChatMessageItem {
  const record: ChatMessageRecord = {
    SenderId:    res.SENDERID,
    ReceiverId:  res.RECEIVERID,
    Message:     res.Message,
    MessageTime: res.msgTime,
    MessageType: res.MessageType,
    RStatus:     1,
  }
  const duration = res.Duration ?? fallbackDuration
  if (duration) record.Duration = duration
  return adaptChatMessageRecord(record, ownUserId)
}

export interface ChatMessageGroup {
  key:      string
  messages: ChatMessageItem[]
}

// Angular: groupByDate() + the keyvalue pipe's disabled sort — insertion order
// is preserved, which is chronological since the source array is time-sorted
// first.
export function groupMessagesByDate(messages: ChatMessageItem[], todayLabel: string, yesterdayLabel: string): ChatMessageGroup[] {
  const sorted = [...messages].sort((a, b) => a.timestamp - b.timestamp)
  const groups: ChatMessageGroup[] = []
  const indexByKey = new Map<string, number>()

  for (const msg of sorted) {
    const key = getDayLabel(msg.timestamp, todayLabel, yesterdayLabel)
    const existingIndex = indexByKey.get(key)
    if (existingIndex === undefined) {
      indexByKey.set(key, groups.length)
      groups.push({ key, messages: [msg] })
    } else {
      groups[existingIndex].messages.push(msg)
    }
  }
  return groups
}

// Same record must never appear twice — a redundant RESPMESSAGE refresh or a
// RESPSEND echo of a message already present via a live RESPRECEIVER push.
export function dedupeMessages(messages: ChatMessageItem[]): ChatMessageItem[] {
  const seen = new Set<string>()
  return messages.filter(msg => {
    if (seen.has(msg.id)) return false
    seen.add(msg.id)
    return true
  })
}
