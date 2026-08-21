// Raw shape of a single message inside a one-to-one thread — Angular:
// messages.component.ts's CHATLIST records (RESPMESSAGE) and the row it
// builds from a RESPSEND ack. Field names are tolerated in both casings
// since the two socket events don't agree on them (SenderId vs MatriId).
export interface ChatMessageRecord {
  MatriId?:     string   // CHATLIST's sender field (Angular: sentMsgCount() compares this to loginMatriId)
  SenderId?:    string   // RESPRECEIVER/RESPSEND's sender field — same meaning as MatriId above
  ReceiverId?:  string
  Message:      string
  MessageTime:  number
  MessageType:  number | string   // 1=text 2=audio 3=video 4=pdf 5=image 11/12/13=phone-view notice
  RStatus:      number            // 1=sent 2=delivered 3=seen
  UTime?:       number
  Duration?:    string            // audio message duration caption ("mm:ss")
}

// RESPMESSAGE payload — Angular: getChatMessage()'s `message` object
export interface ChatMessagesResponse {
  CHATLIST?: ChatMessageRecord[]
  // Angular: messageDetails — per-partner daily/weekly/monthly/one-conversation
  // counters (DAYCNT/WEEKCNT/MONTHCNT/MESALLOW), consumed by chatService.ts's
  // checkChatLimit(). Untyped — shape confirmed from Angular source, not a
  // real capture.
  TOTALMSGCNT?: any
  [key: string]: unknown
}

// RESPSEND payload — Angular: getSendResp()'s `sendRes` object
export interface SendMessageResponse {
  RESPONSECODE: number
  ERRCODE:      number
  msgTime:      number
  SENDERID:     string
  RECEIVERID:   string
  Message:      string
  MessageType:  number | string
  uTime?:       number
  Duration?:    string
}

// UI model for a single chat bubble — produced by adaptChatMessageRecord()
export interface ChatMessageItem {
  id:           string   // MessageTime as a string — unique within one thread
  text:         string   // message text, or the media URL for kind='image'/'video'/'audio'
  timestamp:    number
  isOwnMessage: boolean
  readStatus:   number   // 1|2|3, only meaningful when isOwnMessage
  // Duration caption for kind='audio' — Angular: chat.Duration ("mm:ss").
  duration?:    string
  // pdf messages aren't composed in this pass — 'other' renders a plain
  // "Attachment" placeholder rather than crashing on real history that
  // already has them.
  kind:         'text' | 'viewed_number' | 'image' | 'video' | 'audio' | 'other'
}
