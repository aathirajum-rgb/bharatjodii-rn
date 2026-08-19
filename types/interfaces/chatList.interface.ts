// Raw shape of a single record in the RESPMYCHAT socket payload's RECORDLIST —
// Angular: messager-list.component.html's chatData bindings (chatData?.Name,
// chatData?.Photourl, chatData?.msgType, etc.)
export interface ChatListRecord {
  MatriId:      string
  Name:         string
  Photourl:     string
  Message:      string
  msgType:      number | string   // 1=text 2=audio 3/4/5=file 11/12/13=phone-view notice ''=undone
  ReadStatus:   number            // 1=sent 2=delivered 3=seen
  SenderId:     string
  UnreadCount:  number
  Reported:     'Y' | 'N'
  deleted:      '0' | '1'
  userType:     number            // 1 = paid member
  OnlineNow:    number            // 0 | 1
  TimeStamp:    number | string
  Duration?:    string            // audio message duration caption
}

// RESPMYCHAT payload — Angular: getChatList()'s `message` object
export interface ChatListResponse {
  TAPTYPE:     number
  TOTALREC:    number
  NEWCHATCNT?: number
  FMCOUNT?:    number
  RECORDLIST?: ChatListRecord[]
}

// UI model for a single conversation row — produced by chatListAdapter
export interface ChatListItem {
  matriId:      string
  name:         string
  photoUrl:     string
  isReported:   boolean
  isDeleted:    boolean
  isPaidMember: boolean
  isOnline:     boolean
  unreadCount:  number
  timestamp:    number
  // Last-message summary — kind drives which icon/caption ConversationRow shows
  kind:         'text' | 'audio' | 'file' | 'viewed_number' | 'none'
  text:         string          // message text (kind='text') or audio duration (kind='audio')
  isOwnMessage: boolean         // SenderId === logged-in user — drives the read-tick icon
  readStatus:   number          // 1|2|3, only meaningful when isOwnMessage && kind==='text'
}
