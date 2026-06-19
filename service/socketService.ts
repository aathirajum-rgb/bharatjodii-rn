// Socket service — wraps socket.io-client for real-time chat + in-app notifications.
// Replaces Angular's socket.service.ts (583 lines of RxJS Observables → plain callbacks).
// Install: npm i socket.io-client
// Auth values are cached in module scope to keep emits synchronous after connect.

import { Manager, Socket } from 'socket.io-client'
import { getItem } from './storageService'
import { StorageKeys as SK } from '../constants/storage.keys'

// ─── Module-level singleton ───────────────────────────────────────────────────

let _socket: Socket | null = null
let _manager: Manager | null = null
let _loginEmitted = false

// Cached auth for sync emits — refreshed in socketConnection()
let _userId  = ''
let _gender  = ''
let _appType = '115'
let _lang    = 'en'
let _entryType = ''

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _loadCache(): Promise<void> {
  const [u, g, a, l, e] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Auth.APP_TYPE),
    getItem(SK.Auth.LANG),
    getItem(SK.Auth.ENTRY_TYPE),
  ])
  _userId    = u    ?? ''
  _gender    = g    ?? ''
  _appType   = a    ?? '115'
  _lang      = l    ?? 'en'
  _entryType = e    ?? ''
}

function _chatLoginEmit(): void {
  _socket?.emit('Login', { uId: _userId, gender: _gender, appType: _appType, lang: _lang })
}

function _notifyLoginEmit(): void {
  _socket?.emit('InAppLogin', {
    USERID: _userId,
    GENDER: _gender,
    ENTRYTYPE: _entryType,
    APPTYPE: _appType,
    TIMECREATE: '',
    APPVERSION: '',
    LOGINTIME: '',
  })
}

function _receiverEmit(): void {
  _socket?.emit('Receiver', { uId: _userId, gender: _gender, appType: _appType, lang: _lang })
}

// ─── Connection ───────────────────────────────────────────────────────────────

export async function socketConnection(notifyBaseUrl: string): Promise<void> {
  if (_socket?.connected) return

  await _loadCache()
  const atn = (await getItem(SK.Auth.TOKEN)) ?? ''

  _manager = new Manager(notifyBaseUrl, {
    transports: ['websocket'],
    query: { token: atn, MatriId: _userId },
  })

  _socket = _manager.socket('/')
  _socket.connect()

  _socket.on('connect', () => {
    _socket!.emit('openconnect', { userid: _userId, gender: _gender, appType: 115 })

    if (!_loginEmitted) {
      setTimeout(() => {
        _chatLoginEmit()
        _notifyLoginEmit()
        _receiverEmit()
        _loginEmitted = true
      }, 100)
    }
  })

  _socket.on('disconnect', () => { _loginEmitted = false })
  _socket.on('connect_error', () => { _loginEmitted = false })
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.emit('Logout', { uId: _userId, appType: _appType, lang: _lang })
    _socket.disconnect()
    _socket = null
    _manager = null
    _loginEmitted = false
  }
}

export function isConnected(): boolean {
  return _socket?.connected ?? false
}

// ─── Chat emitters ────────────────────────────────────────────────────────────

export function emitChatList(tabType = 1, start = 0, end = 20, countFlag = 0): void {
  _socket?.emit('MyChatList', { uId: _userId, gender: _gender, tapType: tabType, appType: _appType, lang: _lang, sLimit: start, eLimit: end, count: countFlag })
}

export function emitChatMessages(partnerId: string): void {
  _socket?.emit('MyMessage', { uId: _userId, pId: partnerId, gender: _gender, appType: _appType, lang: _lang })
}

export function emitSendMessage(
  partnerId: string,
  msg: string,
  timestamp: number,
  msgType: string,
  audioDuration = '',
  pdfDetails: { FileName?: string; FileSize?: string } = {},
  msgReplyFlag = 2,
  filterMsg = 0,
): void {
  _socket?.emit('Send', {
    uId: parseInt(_userId, 10) || 0,
    pId: partnerId,
    msg,
    gender: _gender,
    rno: timestamp,
    eType: _entryType,
    time: timestamp,
    msgType,
    appType: _appType,
    lang: _lang,
    Duration: audioDuration,
    FileName: pdfDetails.FileName ?? '',
    FileSize: pdfDetails.FileSize ?? '',
    msgReplyFlag,
    filterMsg,
  })
}

export function emitMessageStatus(uId: string, pId: string, msgTime: number, uTime: number, rStatus: number): void {
  _socket?.emit('MsgStatus', { uId, pId, msgTime, uTime, rStatus, appType: _appType, lang: _lang })
}

export function emitMessageInit(uId: string, pId: string): void {
  _socket?.emit('Msginit', { uId, pId, appType: _appType, lang: _lang })
}

export function emitDeleteChat(partnerId: string): void {
  _socket?.emit('MsgDelete', { uId: _userId, pId: partnerId, flag: 1, appType: _appType, lang: _lang })
}

export function emitBasicView(viewerId: string, viewedId: string): void {
  _socket?.emit('BasicView', { uId: viewerId, pId: viewedId, gender: _gender, appType: _appType, lang: _lang })
}

export function emitSearchMessage(partnerId: string, searchText: string, msgType = 1): void {
  _socket?.emit('MSGSearch', { uId: _userId, pId: partnerId, msgTxt: searchText, msgType, appType: _appType, lang: _lang })
}

// ─── Notification emitters ────────────────────────────────────────────────────

export function emitNotificationDetails(): void {
  _socket?.emit('NotificationDetails', {
    uId: _userId, gender: _gender, appType: _appType, memberShipType: _entryType,
    lastLogIn: '', lang: _lang, inAppReqType: 'FULL',
  })
}

export function emitReadNotification(ngrpid: string): void {
  _socket?.emit('UpdateInappReadStatus', { USERID: parseInt(_userId, 10) || 0, NGRPID: ngrpid })
}

export function emitUpdateReadStatus(msgType: string): void {
  _socket?.emit('InAppUpdateReadStatus', { ID: parseInt(_userId, 10) || 0, MSGTYPE: msgType })
}

// ─── Listener helpers — return an unsubscribe function ────────────────────────
// Components call the returned function on unmount to prevent leaks.

function _on(event: string, cb: (data: any) => void): () => void {
  _socket?.on(event, cb)
  return () => _socket?.off(event, cb)
}

export const onChatList         = (cb: (d: any) => void) => _on('RESPMYCHAT', cb)
export const onChatMessages     = (cb: (d: any) => void) => _on('RESPMESSAGE', cb)
export const onSendResponse     = (cb: (d: any) => void) => _on('RESPSEND', cb)
export const onReceiver         = (cb: (d: any) => void) => _on('RESPRECEIVER', cb)
export const onBasicView        = (cb: (d: any) => void) => _on('RESPBASIC', cb)
export const onMessageInit      = (cb: (d: any) => void) => _on('RESPMSGINIT', cb)
export const onDeleteChat       = (cb: (d: any) => void) => _on('RESPDELETE', cb)
export const onSearchMessage    = (cb: (d: any) => void) => _on('RESPSEARCH', cb)
export const onNotificationList = (cb: (d: any) => void) => _on('NotificationDetailsResponse', cb)
