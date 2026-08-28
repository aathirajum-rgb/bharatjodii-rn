// Socket service — wraps socket.io-client for real-time chat + in-app notifications.
// Replaces Angular's socket.service.ts (583 lines of RxJS Observables → plain callbacks).
// Install: npm i socket.io-client
// Auth values are cached in module scope to keep emits synchronous after connect.

import { Manager, Socket } from 'socket.io-client'
import { getItem } from './storageService'
import { getSessionValue } from './registrationService'
import { StorageKeys as SK } from '../constants/storage.keys'
import { scheduleLocalNotification } from './notificationService'
import { navigationRef } from '../utils/navigationRef'
import { ENavigation } from '../types/enums/navigation.enum'
import i18n from '../i18n'

// ─── Module-level singleton ───────────────────────────────────────────────────

let _socket: Socket | null = null
let _manager: Manager | null = null
let _loginEmitted = false

// Dedupes concurrent socketConnection() callers (Home/Notification/MessagerList
// screens can all call this within the same tick) onto one in-flight connect —
// without this, a second caller could create a second Manager/Socket before the
// first one finishes connecting, orphaning the first and emitting the login
// sequence on the wrong instance.
let _connectPromise: Promise<void> | null = null

// Cached auth for sync emits — refreshed in socketConnection()
let _userId  = ''
let _gender  = ''
let _appType = '115'
let _lang    = 'en'
let _entryType = ''
let _appVersion  = ''
let _lastLogin   = ''

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function _loadCache(): Promise<void> {
  // ENTRYTYPE/APPVERSION/LASTLOGIN live in the USER_SESSION blob (registrationService.ts's
  // storeWebURLData(), copied from the login response's MEMBERSHIPTYPE/APPVERSION/LASTLOGIN
  // fields) — NOT the flat StorageKeys.Auth.ENTRY_TYPE / .User.LAST_LOGIN AsyncStorage keys,
  // which nothing in this app ever writes to. Reading those always produced an empty
  // membershiptype on every socket emit (MyChatList, InAppLogin, NotificationDetails).
  const [u, g, a, l, e, av, ll] = await Promise.all([
    getItem(SK.Auth.USER_ID),
    getItem(SK.User.LOGIN_GENDER),
    getItem(SK.Auth.APP_TYPE),
    getItem(SK.Auth.LANG),
    getSessionValue('ENTRYTYPE'),
    getSessionValue('APPVERSION'),
    getSessionValue('LASTLOGIN'),
  ])
  _userId      = u  ?? ''
  _gender      = g  ?? ''
  _appType     = a  ?? '115'
  _lang        = l  ?? 'en'
  _entryType   = e  ?? ''
  _appVersion  = av ?? ''
  _lastLogin   = ll ?? ''
}

// Angular passes a callback as the 3rd argument to literally every socket.emit()
// call (socket.service.ts) — that's not incidental logging, it makes socket.io
// attach an ack id to the outgoing packet and request an acknowledgement. Our
// port was dropping that 3rd argument, so our packets went out with NO ack id at
// all — confirmed by comparing raw frames: Angular's emit was "425[...]" (ack id
// 5) and got an ack "435[{RESPONSE:'MyChatList Emit is success.'...}]" back
// BEFORE the RESPMYCHAT push; ours was a bare "42[...]" and RESPMYCHAT never
// arrived. The server's handler likely only completes/broadcasts once it has
// somewhere to send that ack — every emit below now requests one, like Angular.
function _ack(_label: string) {
  return () => {}
}

function _chatLoginEmit(): void {
  _socket?.emit('Login', { uId: _userId, gender: _gender, appType: _appType, lang: _lang }, _ack('Login'))
}

function _notifyLoginEmit(): void {
  _socket?.emit('InAppLogin', {
    USERID: _userId,
    GENDER: _gender,
    ENTRYTYPE: _entryType,
    APPTYPE: _appType,
    // No RN equivalent captures a TIMECREATED field anywhere yet — Angular's own
    // localStorage key was often empty here too, so this isn't a regression.
    TIMECREATE: '',
    APPVERSION: _appVersion,
    LOGINTIME: _lastLogin,
  }, _ack('InAppLogin'))
}

function _receiverEmit(): void {
  _socket?.emit('Receiver', { uId: _userId, gender: _gender, appType: _appType, lang: _lang }, _ack('Receiver'))
}

// Angular: triggerInertnalPushNotification()'s messageType switch — types 3-5
// (video/file/image) get a generic "<type> received" caption instead of the
// raw message text; text (1) and audio (2, oddly reuses the "Chat Now" CTA
// copy — kept as-is, faithful to Angular) fall through to the caller.
function _messageTypeCaption(messageType: string): string {
  if (messageType === '2') return `${i18n.t('MESSAGES.CHAT_CTA')} ${i18n.t('MESSAGES.RECEIVED_TXT')}`
  if (messageType === '3') return `${i18n.t('MESSAGES.VIDEO')} ${i18n.t('MESSAGES.RECEIVED_TXT')}`
  if (messageType === '4') return `${i18n.t('MESSAGES.FILE')} ${i18n.t('MESSAGES.RECEIVED_TXT')}`
  if (messageType === '5') return `${i18n.t('MESSAGES.IMAGE')} ${i18n.t('MESSAGES.RECEIVED_TXT')}`
  return ''
}

// Angular: RESPRECEIVER handler in getRespreceiver() — a new incoming message
// while the recipient isn't looking at the chat itself: mark it delivered
// (RStatus 2) and surface a local notification. Baked into the socket layer
// itself (not left to whichever screen happens to be listening) so it always
// fires, matching Angular's own placement in the service rather than a page.
function _handleReceiverMessage(msg: any): void {
  emitMessageStatus(msg.ReceiverId, msg.SenderId, msg.msgTime, msg.UTime, 2)

  const title = i18n.t('MESSAGES.NEW_MESSAGE').replace('#NAME#', msg?.Name ?? '')
  const body = _messageTypeCaption(String(msg?.MessageType ?? '')) || (msg?.Message ?? '')
  scheduleLocalNotification({ SENDERNAME: title, MSG: body, SenderId: msg?.SenderId })
}

// ─── Connection ───────────────────────────────────────────────────────────────

// Callers awaiting the *next* completed login sequence — resolved from the
// 'connect' handler below. A plain _loginEmitted flag isn't enough on its own:
// after any drop the transport can reconnect on its own (Manager's built-in
// reconnection) with nobody calling socketConnection() again, so the redo has
// to be driven from the connect event itself, and something still needs a way
// to await that specific redo instead of the stale flag from before the drop.
let _loginWaiters: (() => void)[] = []

// Resolves once the socket is connected AND the Login/InAppLogin/Receiver
// sequence has actually been emitted for the CURRENT connection — callers that
// emit right after (e.g. emitChatList) need the server to have seen Login
// first, or it drops their request on the floor (same ordering Angular relies
// on). This re-runs on every 'connect', including an automatic reconnect after
// a drop — the server has no memory of who this socket was before that.
export async function socketConnection(notifyBaseUrl: string): Promise<void> {
  if (_socket?.connected && _loginEmitted) return
  if (_connectPromise) return _connectPromise

  _connectPromise = _openConnection(notifyBaseUrl)
  try {
    await _connectPromise
  } finally {
    _connectPromise = null
  }
}

async function _openConnection(notifyBaseUrl: string): Promise<void> {
  await _loadCache()

  // Reuse the existing Manager/Socket if one is already open or reconnecting —
  // creating a second one here would leak the first (its listeners never get
  // torn down) and split emits/responses across two sockets.
  if (!_socket) {
    const atn = (await getItem(SK.Auth.TOKEN)) ?? ''
    _manager = new Manager(notifyBaseUrl, {
      transports: ['websocket'],
      query: { token: atn, MatriId: _userId },
    })
    _socket = _manager.socket('/')

    // Attach whatever screens queued via onChatList()/etc before this socket
    // existed — must happen before .connect() below, or a fast response could
    // still race an unattached listener.
    _flushPendingListeners()

    _socket.on('RESPRECEIVER', (data: any) => {
      const msg = data?.MSG?.[0]
      if (!msg) return
      // Angular: !this.router.url.includes("/messages") — skip while the recipient
      // is already looking at the one-to-one chat itself (ChatScreen.tsx, registered
      // as ENavigation.CHAT_WINDOW — that screen's own onReceiver listener handles
      // the "seen" tick for messages read while actually open).
      const onChatScreen = navigationRef.getCurrentRoute()?.name === ENavigation.CHAT_WINDOW
      if (String(msg.ReceiverId) === _userId && Number(msg.RStatus) === 1 && !onChatScreen) {
        _handleReceiverMessage(msg)
      }
    })
    _socket.on('connect', () => {
      _socket!.emit('openconnect', { userid: _userId, gender: _gender, appType: 115 })
      // JODII-499-equivalent grace period — the socket is usually still mid-handshake
      // on the server side right here, emitting Login immediately can lose the race.
      setTimeout(() => {
        _chatLoginEmit()
        _notifyLoginEmit()
        _receiverEmit()
        _loginEmitted = true
        const waiters = _loginWaiters
        _loginWaiters = []
        waiters.forEach(resolve => resolve())
      }, 100)
    })
    _socket.on('disconnect', () => {
      _loginEmitted = false
    })
  }

  const socket = _socket
  socket.connect() // no-op if already connected/connecting

  if (socket.connected && _loginEmitted) return
  await new Promise<void>(resolve => _loginWaiters.push(resolve))
}

export function disconnectSocket(): void {
  if (_socket) {
    _socket.emit('Logout', { uId: _userId, appType: _appType, lang: _lang }, _ack('Logout'))
    _socket.removeAllListeners()
    _socket.disconnect()
    _socket = null
    _manager = null
    _loginEmitted = false
    _connectPromise = null
  }
}

export function isConnected(): boolean {
  return _socket?.connected ?? false
}

// ─── Chat emitters ────────────────────────────────────────────────────────────

export function emitChatList(tabType = 1, start = 0, end = 20, countFlag = 0): void {
  if (!_socket) return
  // membershiptype was missing here — Angular's emitChatList() always sends it,
  // and the server may be silently dropping requests without it.
  _socket.emit('MyChatList', { uId: _userId, membershiptype: _entryType, gender: _gender, tapType: tabType, appType: _appType, lang: _lang, sLimit: start, eLimit: end, count: countFlag }, _ack('MyChatList'))
}

export function emitChatMessages(partnerId: string): void {
  _socket?.emit('MyMessage', { uId: _userId, pId: partnerId, gender: _gender, appType: _appType, lang: _lang }, _ack('MyMessage'))
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
  }, _ack('Send'))
}

export function emitMessageStatus(uId: string, pId: string, msgTime: number, uTime: number, rStatus: number): void {
  _socket?.emit('MsgStatus', { uId, pId, msgTime, uTime, rStatus, appType: _appType, lang: _lang }, _ack('MsgStatus'))
}

export function emitMessageInit(uId: string, pId: string): void {
  _socket?.emit('Msginit', { uId, pId, appType: _appType, lang: _lang }, _ack('Msginit'))
}

export function emitDeleteChat(partnerId: string): void {
  _socket?.emit('MsgDelete', { uId: _userId, pId: partnerId, flag: 1, appType: _appType, lang: _lang }, _ack('MsgDelete'))
}

export function emitBasicView(viewerId: string, viewedId: string): void {
  _socket?.emit('BasicView', { uId: viewerId, pId: viewedId, gender: _gender, appType: _appType, lang: _lang }, _ack('BasicView'))
}

export function emitSearchMessage(partnerId: string, searchText: string, msgType = 1): void {
  _socket?.emit('MSGSearch', { uId: _userId, pId: partnerId, msgTxt: searchText, msgType, appType: _appType, lang: _lang }, _ack('MSGSearch'))
}

// ─── Notification emitters ────────────────────────────────────────────────────

export function emitNotificationDetails(): void {
  _socket?.emit('NotificationDetails', {
    uId: _userId, gender: _gender, appType: _appType, memberShipType: _entryType,
    lastLogIn: _lastLogin, lang: _lang, inAppReqType: 'FULL',
  }, _ack('NotificationDetails'))
}

export function emitReadNotification(ngrpid: string): void {
  _socket?.emit('UpdateInappReadStatus', { USERID: parseInt(_userId, 10) || 0, NGRPID: ngrpid }, _ack('UpdateInappReadStatus'))
}

export function emitUpdateReadStatus(msgType: string): void {
  _socket?.emit('InAppUpdateReadStatus', { ID: parseInt(_userId, 10) || 0, MSGTYPE: msgType }, _ack('InAppUpdateReadStatus'))
}

// ─── Listener helpers — return an unsubscribe function ────────────────────────
// Components call the returned function on unmount to prevent leaks.

// Screens call onChatList()/etc BEFORE socketConnection() on purpose (attach the
// listener first so a fast response isn't missed) — but the very first time a
// screen mounts, _socket may not exist yet (e.g. landing directly on Messages
// without Home having connected first). `_socket?.on(...)` would then silently
// no-op and the listener would never actually attach, even once the socket
// eventually connects — RESPMYCHAT (and everything else) would arrive on the
// wire with nobody listening. Queue it instead, and flush onto the real socket
// the moment _openConnection() creates one.
let _pendingListeners: { event: string; cb: (data: any) => void }[] = []

function _flushPendingListeners(): void {
  _pendingListeners.forEach(({ event, cb }) => _socket!.on(event, cb))
}

function _on(event: string, cb: (data: any) => void): () => void {
  if (_socket) {
    _socket.on(event, cb)
  } else {
    _pendingListeners.push({ event, cb })
  }
  return () => {
    _socket?.off(event, cb)
    _pendingListeners = _pendingListeners.filter(p => p.event !== event || p.cb !== cb)
  }
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
// Angular: getNotificationLogin() — server's ack of the raw 'connect', unrelated to app login state.
export const onLoginResponse     = (cb: (d: any) => void) => _on('LoginResponse', cb)
// Angular: getRESPLOGIN() — confirms the Login emit was processed server-side (carries PVCNT badge
// count); messager-list.component.ts uses this to retry MyChatList if the list didn't answer in time.
export const onLoginConfirmation = (cb: (d: any) => void) => _on('RESPLOGIN', cb)
