// One-to-one chat screen — Angular: pages/messages/messages.component.ts(+.html).
// CORE PASS (explicit scope decision) + block/report + message-quota gating +
// image/video/voice attachments as follow-ups: text messages, read ticks,
// date grouping, header with online/last-active, per-conversation draft
// persistence, the phone-view system message card, the overflow menu's
// Block/Unblock/Report actions, the 3-message first-reply limit + daily/
// weekly/monthly caps + paid-balance/profile-validation gates, and picking/
// sending/viewing image, video and voice attachments. Deliberately NOT built
// yet: pdf/document attachments — no document picker.
//
// Entry points: MessagerListScreen.tsx's "All Messages" row tap (rich
// ChatListItem params) and communicationService.ts's "Chat" CTA (thin
// partnerId/partnerName/partnerPhoto params from elsewhere in the app) both
// navigate to ENavigation.CHAT_WINDOW. Angular relies on a fresh BasicView/
// RESPBASIC round-trip for authoritative online/last-active/name/photo rather
// than trusting whatever the caller handed over — this screen does the same,
// using the nav params only as an immediate-render seed.
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Platform, Pressable,
  ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio'
import CdnSvg from '../../components/cdn-svg/CdnSvg'
import ChatBubble from '../../components/chat/ChatBubble'
import AttachmentPreviewModal from '../../components/chat/AttachmentPreviewModal'
import ChatMediaViewerModal from '../../components/chat/ChatMediaViewerModal'
import ThreeDotMenu from '../../components/matches/ThreeDotMenu'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import { adaptChatMessageRecord, adaptSendResponse, dedupeMessages, groupMessagesByDate } from '../../adapters/chatMessage.adapter'
import {
  socketConnection, emitBasicView, onBasicView, emitChatMessages, onChatMessages,
  emitSendMessage, onSendResponse, emitMessageStatus, onReceiver,
} from '../../service/socketService'
import { blockChatProfile, unblockChatProfile } from '../../service/communicationService'
import { handleBack } from '../../utils/navigationRef'
import {
  getChatCount, consumeChatCount, checkChatLimit, fetchChatPaymentPromo,
  type ChatCountResult, type ChatPaymentPromo,
} from '../../service/chatService'
import {
  chooseAttachmentSource, pickChatAttachment, uploadChatAttachment,
  type PickedChatAttachment,
} from '../../service/chatMediaService'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { requestMicrophonePermission } from '../../service/permissionService'
import { getItem, getJson, setJson } from '../../service/storageService'
import { getSessionValue } from '../../service/registrationService'
import { StorageKeys } from '../../constants/storage.keys'
import { CDN_SVG } from '../../constants/cdn'
import { Colors } from '../../constants/colors'
import { EnvConfig } from '../../constants/env'
import { formatLastActive } from '../../utils/chatTime'
import { Fonts, SemanticFontsEnglish } from '../../src/theme/fonts'
import type { ChatMessageItem, ChatMessagesResponse, SendMessageResponse } from '../../types/interfaces/chatMessage.interface'

// Angular: FIRST_TIME_MSG_LIMIT — 3 messages allowed before the partner
// responds at all.
const FIRST_TIME_MSG_LIMIT = 3

// Angular: getRecordedTime() subscription — "stop recording after 3 minutes
// as per requirement from product" (time == "03:00").
const MAX_RECORDING_MS = 180000
// Angular: onPress()'s splitedAudio[1] > '00' guard — a hold under 1 second
// is treated as an accidental tap, not a real recording.
const MIN_RECORDING_MS = 1000

function formatVoiceDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const mm = Math.floor(s / 60).toString().padStart(2, '0')
  const ss = (s % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

// Angular: oppositeIdDetails.Blocked / basicViewDetail.BLOCKED — 'Y' means the
// logged-in user blocked the partner, 'B' the reverse. Angular's own template
// conflates the two into the same "I blocked them" banner (see investigation
// notes), which reads as an unreached branch for the "they blocked me" case;
// this port treats them as genuinely distinct states so that case has an
// actual, working read-only UI.
type BlockedState = 'none' | 'by_me' | 'by_them'

const CDN = CDN_SVG
const BACK_ICON_URI = CDN + 'arrow-back-activity.svg'
const DRAFT_STORE_KEY = 'CHATDRAFTMESSAGE'

type Props = { navigation: any; route: any }

export default function ChatScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const scrollRef = useRef<ScrollView>(null)

  const partnerId = String(route.params?.partnerId ?? '')
  const [partnerName, setPartnerName]   = useState(String(route.params?.partnerName ?? ''))
  const [partnerPhoto, setPartnerPhoto] = useState(String(route.params?.partnerPhoto ?? ''))
  const [partnerOnline, setPartnerOnline] = useState(Boolean(route.params?.partnerOnline))
  const [partnerLastActive, setPartnerLastActive] = useState<number | null>(route.params?.partnerLastActive ?? null)
  // Angular: oppositeIdDetails.Reported (JODII-453 fix) — the row's own Reported
  // flag carried through nav params, not refreshed from BasicView. A reported
  // chat is read only: it opens like any other, but the footer swaps to a
  // read-only note in place of the input.
  const reported = Boolean(route.params?.partnerReported)

  const ownIdRef = useRef('')
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [loaded, setLoaded] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)

  // ── Block / Report ───────────────────────────────────────────────────────
  const [blockedState, setBlockedState] = useState<BlockedState>('none')
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmAction, setConfirmAction] = useState<'block' | 'unblock' | null>(null)
  const [blockActionBusy, setBlockActionBusy] = useState(false)
  const [showReportModal, setShowReportModal] = useState(false)

  // ── Message quota / limits ───────────────────────────────────────────────
  const [ownEntryType, setOwnEntryType] = useState('')
  const [ownGender, setOwnGender] = useState('')
  const [chatCountResult, setChatCountResult] = useState<ChatCountResult | null>(null)
  // Angular: TOTALMSGCNT — per-partner daily/weekly/monthly/one-conversation
  // counters delivered alongside the thread itself over the socket (RESPMESSAGE),
  // not a separate REST call.
  const [messageDetails, setMessageDetails] = useState<any>(null)
  const [paymentPromo, setPaymentPromo] = useState<ChatPaymentPromo | null>(null)
  const [showPaymentPromo, setShowPaymentPromo] = useState(false)
  const [toastRequest, setToastRequest] = useState<ToastRequest | null>(null)
  const phoneInfo = usePhoneInfoSheet()
  // Set right before emitting a send, read inside the long-lived onSendResponse
  // socket listener (a ref survives that closure's staleness; state wouldn't).
  const pendingFirstMessageRef = useRef(false)

  // ── Image / video attachments ────────────────────────────────────────────
  const [pendingAttachment, setPendingAttachment] = useState<PickedChatAttachment | null>(null)
  const [attachmentUploading, setAttachmentUploading] = useState(false)
  const [mediaViewer, setMediaViewer] = useState<{ kind: 'image' | 'video'; uri: string } | null>(null)

  // ── Voice messages ───────────────────────────────────────────────────────
  // Angular: RecordRTC + audio-recording.service.ts — this port uses
  // expo-audio's native recorder (m4a output) instead, since there's no RN
  // equivalent of RecordRTC to reuse.
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY)
  const recorderState = useAudioRecorderState(audioRecorder, 100)
  const [isRecording, setIsRecording] = useState(false)
  const [recordedAttachment, setRecordedAttachment] = useState<PickedChatAttachment | null>(null)
  const [recordedDurationLabel, setRecordedDurationLabel] = useState('')
  const [voiceSending, setVoiceSending] = useState(false)
  const recordStartRef = useRef(0)
  const stoppingRecordingRef = useRef(false)
  // Set right before emitting a voice Send, read inside onSendResponse — RESPSEND
  // isn't confirmed to echo Duration back, so the locally-recorded value is the
  // fallback source of truth for the just-sent bubble's caption.
  const pendingVoiceDurationRef = useRef<string | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    Promise.all([getSessionValue('ENTRYTYPE'), getItem(StorageKeys.User.LOGIN_GENDER)]).then(([entryType, gender]) => {
      if (cancelled) return
      setOwnEntryType(entryType ?? '')
      setOwnGender(gender ?? '')
    })
    return () => { cancelled = true }
  }, [])

  // Angular: hasRealChatMessage() — MessageType 11/12/13 are phone-view system
  // rows, not actual chat content.
  function hasRealChatMessage(): boolean {
    return messages.some(m => m.kind !== 'viewed_number')
  }
  // Angular: sentMsgCount()/oppositeResponded()/firstTimeMsgLimitReached()
  function sentMsgCount(): number {
    return messages.filter(m => m.isOwnMessage && m.kind !== 'viewed_number').length
  }
  function oppositeResponded(): boolean {
    return messages.some(m => !m.isOwnMessage && m.kind !== 'viewed_number')
  }
  function firstTimeMsgLimitReached(): boolean {
    return !oppositeResponded() && sentMsgCount() >= FIRST_TIME_MSG_LIMIT
  }
  // Angular: checkViewedMobileNumber() — an ad-hoc positional check on the
  // whole thread array, kept faithful rather than "cleaned up" since its exact
  // shape is what free-female-user gating in checkToSendMessage() depends on.
  function checkViewedMobileNumber(): boolean {
    const loginViewed    = messages.some(m => m.kind === 'viewed_number' && m.isOwnMessage)
    const oppositeViewed = messages.some(m => m.kind === 'viewed_number' && !m.isOwnMessage)
    if (oppositeViewed && messages.length === 2 && messages[1]?.isOwnMessage) return true
    if (loginViewed && messages.length === 2 && messages[1]?.isOwnMessage && messages[0]?.isOwnMessage) return true
    if (messages.length > 2) return true
    if (!loginViewed && !oppositeViewed && messages.length === 1) return true
    return false
  }
  // Angular: checkToSendMessage()
  function checkToSendMessage(): boolean {
    if (ownEntryType === 'P' && (chatCountResult?.chatBalance !== '0' || hasRealChatMessage())) return true
    if (ownGender === 'F' && hasRealChatMessage()) return messages.length > 0
    return checkViewedMobileNumber() && ownEntryType === 'F'
  }

  function buildLimitExceededText(type: '1' | '2' | '3'): string {
    return t('MESSAGES.MSG_LIMIT_EXCEED')
      .replace('#DURATION#', t(`MESSAGES.MSG_DURATION_${type}`))
      .replace('#RETURNMSG#', t(`MESSAGES.MSG_DURATION_RETURNMSG_${type}`))
  }

  // Angular: checkSetLimitValue() — purely derived from messages/chatCountResult/
  // messageDetails, so computed straight from render rather than mirrored into
  // its own state via an effect (no external system to synchronize with here).
  function computeMessageGate(): { allow: boolean; bannerText: string } {
    if (firstTimeMsgLimitReached()) {
      return { allow: false, bannerText: t('MESSAGES.SEND_ONE_MESSAGE') }
    }
    if (chatCountResult?.fairUsageExceeded && messageDetails) {
      const limitType = checkChatLimit(chatCountResult.chatBalanceDetail, messageDetails)
      if (limitType === 'monthlyLimitExceeded') return { allow: false, bannerText: buildLimitExceededText('3') }
      if (limitType === 'weeklyLimitExceeded')  return { allow: false, bannerText: buildLimitExceededText('2') }
      if (limitType === 'dailyLimitExceeded')   return { allow: false, bannerText: buildLimitExceededText('1') }
      if (limitType === 'oneConversationOnly')  return { allow: false, bannerText: t('MESSAGES.SEND_ONE_MESSAGE') }
    }
    return { allow: true, bannerText: '' }
  }

  // Angular: getChatCount() — fired right after the thread loads, and its
  // ERRCODE:10 (under validation) fires its popup immediately rather than
  // waiting for a send attempt, matching Angular's own asymmetry (ERRCODE:13
  // only surfaces its popup lazily, from inside sendMessage()).
  async function refreshChatCount() {
    const result = await getChatCount(partnerId)
    setChatCountResult(result)
    if (result.profileValidation === '0' && result.profileValidationMsg) {
      phoneInfo.handleResult({ type: 'under_validation', message: result.profileValidationMsg })
    }
    if (result.invalidPartner) {
      setToastRequest({ message: result.invalidPartnerMsg ?? 'Invalid MatriID', key: Date.now() })
    }
  }

  // ── Draft restore — Angular: chatDraftMessage[pMatriId], a per-partner
  // localStorage object read at chat-entry so an unsent text survives leaving
  // and coming back to this thread.
  useEffect(() => {
    let cancelled = false
    getJson<Record<string, string>>(DRAFT_STORE_KEY).then(drafts => {
      if (!cancelled && drafts?.[partnerId]) setMessage(drafts[partnerId])
    })
    return () => { cancelled = true }
  }, [partnerId])

  // Persisted on every change (debounced) rather than only on unmount — RN
  // gives no reliable "about to close" hook once the app is backgrounded/killed.
  useEffect(() => {
    const timeout = setTimeout(() => {
      getJson<Record<string, string>>(DRAFT_STORE_KEY).then(drafts => {
        const next = { ...(drafts ?? {}) }
        if (message) next[partnerId] = message
        else delete next[partnerId]
        setJson(DRAFT_STORE_KEY, next)
      })
    }, 400)
    return () => clearTimeout(timeout)
  }, [message, partnerId])

  // ── Socket wiring ────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    const unsubscribeBasicView = onBasicView((data: any) => {
      if (cancelled || !data) return
      if (String(data.ID ?? '') !== partnerId) return
      // RESPBASIC carries some fields at the top level (ID, NAME confirmed) and
      // some possibly only inside VIEW — check both rather than assuming one
      // level exclusively, since a real capture showed NAME at the top level.
      const view = data.VIEW ?? {}
      const name       = view.NAME ?? data.NAME
      const photo      = view.PHOTOURL ?? view.PHOTO ?? data.PHOTOURL ?? data.PHOTO
      const onlineNow  = view.ONLINENOW ?? data.ONLINENOW
      const lastLogin  = view.LASTLOGIN ?? data.LASTLOGIN
      const blocked    = view.BLOCKED ?? data.BLOCKED
      if (name) setPartnerName(name)
      if (photo) setPartnerPhoto(photo)
      if (onlineNow != null) setPartnerOnline(Number(onlineNow) === 1)
      if (lastLogin) setPartnerLastActive(Number(lastLogin) * 1000)
      if (blocked === 'Y') setBlockedState('by_me')
      else if (blocked === 'B') setBlockedState('by_them')
    })

    const unsubscribeMessages = onChatMessages((data: ChatMessagesResponse) => {
      if (cancelled) return
      const records = data?.CHATLIST ?? []
      const adapted = records.map(r => adaptChatMessageRecord(r, ownIdRef.current))
      setMessages(dedupeMessages(adapted))
      setMessageDetails(data?.TOTALMSGCNT ?? null)
      setLoaded(true)
      refreshChatCount()
    })

    const unsubscribeSend = onSendResponse((res: SendMessageResponse) => {
      if (cancelled) return
      setSending(false)
      // Angular: RESPONSECODE 2 + ERRCODE 1 — send failed server-side, just
      // toast and drop it (no bubble to show for a message that never sent).
      if (Number(res?.RESPONSECODE) === 2 && Number(res?.ERRCODE) === 1) return
      const own = adaptSendResponse(res, ownIdRef.current, pendingVoiceDurationRef.current)
      pendingVoiceDurationRef.current = undefined
      setMessages(prev => dedupeMessages([...prev, own]))
      // Angular: getSendResp()'s post-send chatCount(TYPE=2) — fired once, only
      // for the first REAL message of a thread (see handleSend()).
      if (pendingFirstMessageRef.current) {
        pendingFirstMessageRef.current = false
        consumeChatCount(partnerId).then(() => refreshChatCount())
      }
    })

    // Angular: getRespreceiver() inside messages.component.ts — a live push
    // while this screen is open. Two distinct cases, kept explicit here rather
    // than replaying Angular's single hard-to-parse combined condition:
    //  1) a NEW incoming message from this exact partner -> append + mark seen
    //  2) confirmation that MY sent message was just seen by the partner -> flip its tick
    const unsubscribeReceiver = onReceiver((data: any) => {
      const msg = data?.MSG?.[0]
      if (cancelled || !msg) return

      if (String(msg.SenderId) === partnerId && String(msg.ReceiverId) === ownIdRef.current) {
        const incoming = adaptChatMessageRecord(msg, ownIdRef.current)
        setMessages(prev => dedupeMessages([...prev, incoming]))
        emitMessageStatus(msg.ReceiverId, msg.SenderId, msg.msgTime ?? msg.MessageTime, msg.UTime, 3)
        return
      }
      if (String(msg.SenderId) === ownIdRef.current && String(msg.ReceiverId) === partnerId && Number(msg.RStatus) === 3) {
        const seenId = String(msg.msgTime ?? msg.MessageTime ?? '')
        setMessages(prev => prev.map(m => (m.id === seenId ? { ...m, readStatus: 3 } : m)))
      }
    })

    getItem(StorageKeys.Auth.USER_ID).then(id => {
      ownIdRef.current = id ?? ''
      emitBasicView(ownIdRef.current, partnerId)
      socketConnection(EnvConfig.notify).then(() => {
        if (cancelled) return
        emitChatMessages(partnerId)
      })
    })

    return () => {
      cancelled = true
      unsubscribeBasicView()
      unsubscribeMessages()
      unsubscribeSend()
      unsubscribeReceiver()
    }
  }, [partnerId])

  // Angular: getRecordedTime() subscription's `time == "03:00"` check.
  useEffect(() => {
    if (isRecording && recorderState.durationMillis >= MAX_RECORDING_MS) {
      stopRecordingAndFinalize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, recorderState.durationMillis])

  // Angular: updateScroll() — always jumps to bottom, no preserved-position
  // logic (there's no load-older-messages feature to preserve position for).
  useEffect(() => {
    if (messages.length) {
      const timeout = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
      return () => clearTimeout(timeout)
    }
    return undefined
  }, [messages.length])

  // Angular: sendMessage()'s/trigerFile()'s shared else-if chain — when
  // checkToSendMessage() fails, one popup explains why (paid-balance promo,
  // under-validation, or rejected-validation), in that priority order. Shared
  // by both the text-send gate and the attachment-button gate below.
  async function explainWhySendBlocked() {
    if (chatCountResult?.profileValidation === '0' && chatCountResult.profileValidationMsg) {
      phoneInfo.handleResult({ type: 'under_validation', message: chatCountResult.profileValidationMsg })
    } else if (chatCountResult?.profileValidation === '2') {
      const bottom = chatCountResult.profileValidationBottom
      phoneInfo.handleResult({
        type: 'profile_validation',
        title: bottom?.title ?? 'Profile under review',
        content: bottom?.content ?? 'Your profile is currently under review.',
        cta: bottom?.cta ?? 'Okay',
        ...(bottom?.image ? { image: bottom.image } : {}),
      })
    } else {
      const promo = await fetchChatPaymentPromo(partnerName)
      setPaymentPromo(promo)
      setShowPaymentPromo(true)
    }
  }

  async function handleSend() {
    const text = message.trim()
    if (!text || sending) return

    if (!checkToSendMessage()) {
      await explainWhySendBlocked()
      return
    }

    pendingFirstMessageRef.current = !hasRealChatMessage()
    setSending(true)
    setMessage('')
    emitSendMessage(partnerId, text, Date.now(), '1')
  }

  // Angular: trigerFile() — same checkToSendMessage() gate as sending text.
  async function handleAttachmentPress() {
    if (!checkToSendMessage()) {
      await explainWhySendBlocked()
      return
    }
    const source = await chooseAttachmentSource()
    if (!source) return

    const result = await pickChatAttachment(source)
    if (!result.ok) {
      if (result.reason === 'tooLarge') setToastRequest({ message: t('MESSAGES.CHAT_MSG_LIMIT'), key: Date.now() })
      return
    }
    setPendingAttachment(result.attachment)
  }

  async function handleCancelAttachment() {
    setPendingAttachment(null)
  }

  // Angular: modalpopup.component.ts's sendAudio() (upload) → sendMessage()
  // with the uploaded URL as `msg` and msgType 3/5 — no caption, matching the
  // real preview modal exactly.
  async function handleSendAttachment() {
    if (!pendingAttachment || attachmentUploading) return
    setAttachmentUploading(true)
    const url = await uploadChatAttachment(pendingAttachment)
    setAttachmentUploading(false)
    if (!url) {
      setToastRequest({ message: t('MESSAGES.CHAT_MSG_LIMIT'), key: Date.now() })
      return
    }
    pendingFirstMessageRef.current = !hasRealChatMessage()
    setSending(true)
    emitSendMessage(partnerId, url, Date.now(), pendingAttachment.msgType)
    setPendingAttachment(null)
  }

  // Angular: onPress()'s touchstart branch — same checkToSendMessage() gate as
  // text/attachments, checked on press-in so a blocked/free user never starts
  // a recording that can't be sent anyway.
  async function handleMicPressIn() {
    if (isRecording || recordedAttachment || blockedState !== 'none') return
    if (!checkToSendMessage()) {
      await explainWhySendBlocked()
      return
    }
    const permission = await requestMicrophonePermission()
    if (permission !== 'granted') return
    try {
      await audioRecorder.prepareToRecordAsync()
      audioRecorder.record()
      recordStartRef.current = Date.now()
      setIsRecording(true)
    } catch {
      // mic failed to start — recording UI simply never enters
    }
  }

  // Angular: onPress()'s touchend branch (splitedAudio[1] > '00' guard) — also
  // doubles as the recording row's tap-to-stop affordance and the 3-minute
  // auto-stop, all funneled through this one function.
  async function stopRecordingAndFinalize() {
    if (!isRecording || stoppingRecordingRef.current) return
    stoppingRecordingRef.current = true
    try {
      const heldMs = Date.now() - recordStartRef.current
      setIsRecording(false)
      await audioRecorder.stop()
      if (heldMs < MIN_RECORDING_MS) {
        setToastRequest({ message: t('MESSAGES.MIC_HOLD'), key: Date.now() })
        return
      }
      const uri = audioRecorder.uri
      if (!uri) return
      setRecordedDurationLabel(formatVoiceDuration(heldMs / 1000))
      setRecordedAttachment({ msgType: '2', uri, mimeType: 'audio/m4a' })
    } finally {
      stoppingRecordingRef.current = false
    }
  }

  // Angular: clearAudioRecordedData() — restored here even though the real
  // preview panel that hosted it is commented out/dead in Angular, since
  // shipping with zero way to discard a finished recording (only Send) would
  // be a real regression, not a faithful port of an intentional decision.
  function handleCancelRecording() {
    setRecordedAttachment(null)
    setRecordedDurationLabel('')
  }

  // Angular: sendAudio('2') → sendMessage('2', mergeAudio) — same upload
  // endpoint as image/video, then Send with msgType '2' and the locally-timed
  // duration caption.
  async function handleSendVoice() {
    if (!recordedAttachment || voiceSending) return
    setVoiceSending(true)
    const url = await uploadChatAttachment(recordedAttachment)
    setVoiceSending(false)
    if (!url) {
      setToastRequest({ message: t('MESSAGES.CHAT_MSG_LIMIT'), key: Date.now() })
      return
    }
    pendingFirstMessageRef.current = !hasRealChatMessage()
    pendingVoiceDurationRef.current = recordedDurationLabel
    setSending(true)
    emitSendMessage(partnerId, url, Date.now(), '2', recordedDurationLabel)
    setRecordedAttachment(null)
    setRecordedDurationLabel('')
  }

  // Angular: the overflow menu's "Unblock profile" item calls
  // unblockChatProfile() directly with no confirmation — only the blocked-
  // banner's "Tap to unblock" goes through a confirm sheet (see below).
  async function handleMenuUnblock() {
    setMenuOpen(false)
    const ok = await unblockChatProfile(partnerId)
    if (ok) setBlockedState('none')
  }

  function handleMenuBlock() {
    setMenuOpen(false)
    setConfirmAction('block')
  }

  function handleBannerTapToUnblock() {
    setConfirmAction('unblock')
  }

  function handleMenuReport() {
    setMenuOpen(false)
    setShowReportModal(true)
  }

  async function confirmBlockOrUnblock() {
    if (!confirmAction || blockActionBusy) return
    setBlockActionBusy(true)
    const ok = confirmAction === 'block'
      ? await blockChatProfile(partnerId)
      : await unblockChatProfile(partnerId)
    setBlockActionBusy(false)
    if (ok) {
      setBlockedState(confirmAction === 'block' ? 'by_me' : 'none')
      if (confirmAction === 'block') setMessage('')
    }
    setConfirmAction(null)
  }

  const confirmSheetData = confirmAction === 'block'
    ? {
        title: t('PRIVACY.BLOCK_TITLE'),
        content: t('PRIVACY.BLOCK_SUBTITLE'),
        ctaLabel: t('PRIVACY.BLOCK_CTA1'),
        secondaryCtaLabel: t('PRIVACY.BLOCK_CTA2'),
        sideBySideCtas: true,
      }
    : {
        title: t('PRIVACY.UNBLOCK_HEADER').replace('#NAME#', partnerName),
        content: t('PRIVACY.UNBLOCK_CONTENT').replace(/##[A-Z_]+##/g, ''),
        ctaLabel: t('PRIVACY.UNBLOCK_CTA1'),
        secondaryCtaLabel: t('PRIVACY.UNBLOCK_CTA2'),
        sideBySideCtas: true,
      }

  const { allow: messageAllow, bannerText: limitBannerText } = computeMessageGate()
  const groups = groupMessagesByDate(messages, t('MESSAGES.TODAY'), t('MESSAGES.YESTERDAY'))
  const lastActiveText = partnerOnline
    ? t('MESSAGES.ONLINE')
    : partnerLastActive
      ? formatLastActive(partnerLastActive, {
          minute: t('MESSAGES.MINUTES_TXT'), hour: t('MESSAGES.HOUR_TXT'), day: t('MESSAGES.DAY_TXT'),
          week: t('MESSAGES.WEEK_TXT'), month: t('MESSAGES.MONTHS_TXT'), year: t('MESSAGES.YEAR_TXT'),
        })
      : ''

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable onPress={() => handleBack()} hitSlop={12} style={styles.backBtn}>
          <CdnSvg uri={BACK_ICON_URI} width={20} height={20} />
        </Pressable>
        <View style={styles.avatarWrap}>
          {!!partnerPhoto && <Image source={{ uri: partnerPhoto }} style={styles.avatar} />}
          {partnerOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
          {!!lastActiveText && <Text style={styles.headerStatus} numberOfLines={1}>{lastActiveText}</Text>}
        </View>
        <Pressable onPress={() => setMenuOpen(v => !v)} hitSlop={12} style={styles.moreBtn}>
          <CdnSvg uri={CDN + 'jodii-chat-3dot-img.svg'} width={18} height={18} />
        </Pressable>
        {menuOpen && (
          <ThreeDotMenu
            positionStyle={styles.menuPosition}
            showBlock={blockedState === 'none' && !reported}
            onBlock={handleMenuBlock}
            showUnblock={blockedState === 'by_me'}
            onUnblock={handleMenuUnblock}
            showReport
            onReport={handleMenuReport}
          />
        )}
      </View>

      {/* The header above is a normal layout sibling inside a container that
          already applies insets.top as paddingTop — RN's automatic frame
          measurement already knows this view starts below it, so an explicit
          keyboardVerticalOffset here double-counts that offset and leaves a
          large gap above the keyboard on iOS. */}
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* ── Thread ── */}
        {!loaded ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t('MESSAGES.NO_MESSAGES')}</Text>
          </View>
        ) : (
          <ScrollView
            ref={scrollRef}
            style={styles.flex1}
            contentContainerStyle={styles.threadContent}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
          >
            {groups.map(group => (
              <View key={group.key}>
                <View style={styles.dateSeparatorWrap}>
                  <Text style={styles.dateSeparatorText}>{group.key}</Text>
                </View>
                {group.messages.map(item => (
                  <ChatBubble
                    key={item.id}
                    item={item}
                    onPressMedia={(kind, uri) => setMediaViewer({ kind, uri })}
                  />
                ))}
              </View>
            ))}
          </ScrollView>
        )}

        {/* ── Input / blocked / limit-exceeded banner ── */}
        {reported ? (
          // Angular: isChatReported() (JODII-453 fix) — a reported chat can be
          // read but not answered, this note takes priority over the block/
          // limit banners below since none of those reasons matter once reported.
          <View style={[styles.blockedBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.blockedText}>{t('MESSAGES.REPORTED_PROFILE')}</Text>
          </View>
        ) : blockedState === 'by_them' ? (
          <View style={[styles.blockedBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.blockedText}>{t('PRIVACY.OPP_BLOCK_TEXT')}</Text>
          </View>
        ) : blockedState === 'by_me' ? (
          <Pressable
            style={[styles.blockedBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}
            onPress={handleBannerTapToUnblock}
          >
            <Text style={styles.blockedText}>{t('MESSAGES.BLOCKED_CONTENT')}</Text>
            <Text style={styles.tapToUnblock}>{t('MESSAGES.TAP_HERE')}</Text>
          </Pressable>
        ) : !messageAllow ? (
          // Angular: showBottomRestriction() — the entire footer is replaced,
          // not just a disabled send button.
          <View style={[styles.blockedBanner, { paddingBottom: Math.max(insets.bottom, 20) }]}>
            <Text style={styles.blockedText}>{limitBannerText}</Text>
            <Pressable onPress={() => navigation.navigate('Matches')}>
              <Text style={styles.tapToUnblock}>{t('MESSAGES.EXPLORE_MATCHES')}</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {!isRecording && !recordedAttachment && (
              <Pressable onPress={handleAttachmentPress} hitSlop={8} style={styles.attachBtn}>
                <CdnSvg uri={CDN + 'jodii-chat-attachment-img.svg'} width={22} height={22} />
              </Pressable>
            )}

            {isRecording ? (
              <Pressable style={styles.input} onPress={stopRecordingAndFinalize}>
                <View style={styles.recordingRow}>
                  <CdnSvg uri={CDN + 'jodii-chat-mic-img-red.svg'} width={18} height={18} />
                  <View style={styles.recordingDot} />
                  <Text style={styles.recordingTimer}>{formatVoiceDuration(recorderState.durationMillis / 1000)}</Text>
                </View>
              </Pressable>
            ) : recordedAttachment ? (
              <View style={styles.input}>
                <View style={styles.recordingRow}>
                  <Pressable onPress={handleCancelRecording} hitSlop={8}>
                    <CdnSvg uri={CDN + 'jodii-chat-cross-img-red.svg'} width={16} height={16} />
                  </Pressable>
                  <Text style={styles.recordingTimer}>{recordedDurationLabel}</Text>
                </View>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                value={message}
                onChangeText={setMessage}
                placeholder={t('MESSAGES.TYPE_TEXT')}
                placeholderTextColor={Colors.textPlaceholder}
                multiline
              />
            )}

            {message.trim() || recordedAttachment ? (
              <Pressable
                style={[styles.sendBtn, (sending || voiceSending) && styles.sendBtnDisabled]}
                onPress={message.trim() ? handleSend : handleSendVoice}
                disabled={sending || voiceSending}
              >
                {voiceSending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <CdnSvg uri={CDN + 'send-message-white.svg'} width={18} height={18} />}
              </Pressable>
            ) : (
              <Pressable
                style={[styles.sendBtn, isRecording && styles.sendBtnRecording]}
                onPressIn={handleMicPressIn}
                onPressOut={stopRecordingAndFinalize}
              >
                <CdnSvg uri={CDN + 'record-message-white.svg'} width={18} height={18} />
              </Pressable>
            )}
          </View>
        )}
      </KeyboardAvoidingView>

      <BottomSheet
        visible={!!confirmAction}
        type="blockProfile"
        data={confirmSheetData}
        onClose={() => setConfirmAction(null)}
        onPrimaryPress={confirmBlockOrUnblock}
        onSecondaryPress={() => setConfirmAction(null)}
      />
      <ReportProfileModal
        visible={showReportModal}
        partnerId={partnerId}
        partnerName={partnerName}
        onClose={() => setShowReportModal(false)}
        onSubmitted={() => setShowReportModal(false)}
      />
      {/* Angular: becomePaidMemberPopUp() */}
      <BottomSheet
        visible={showPaymentPromo}
        type="paymentPromo"
        data={{
          title: paymentPromo?.title,
          content: paymentPromo?.content,
          ctaLabel: paymentPromo?.ctaLabel || t('GENERAL.BECOME_PAID'),
          ...(paymentPromo?.image ? { image: paymentPromo.image } : {}),
        }}
        onClose={() => setShowPaymentPromo(false)}
        onPrimaryPress={() => { setShowPaymentPromo(false); navigation.navigate('recharge') }}
      />
      {/* Angular: underValidationPop() / bottomSheetService.checkProfileStatus() */}
      <BottomSheet
        visible={!!phoneInfo.sheet}
        type="phonePrivacyInfo"
        data={phoneInfo.getData(t)}
        onClose={phoneInfo.close}
        onPrimaryPress={() => phoneInfo.primaryPress(navigation)}
        onSecondaryPress={() => phoneInfo.secondaryPress(navigation)}
        onLinkPress={phoneInfo.close}
      />
      <Toast request={toastRequest} bottomOffset={80} />

      <AttachmentPreviewModal
        visible={!!pendingAttachment}
        attachment={pendingAttachment}
        uploading={attachmentUploading}
        onCancel={handleCancelAttachment}
        onSend={handleSendAttachment}
      />
      <ChatMediaViewerModal
        visible={!!mediaViewer}
        kind={mediaViewer?.kind ?? null}
        uri={mediaViewer?.uri ?? null}
        onClose={() => setMediaViewer(null)}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  flex1: { flex: 1 },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.divider,
    // ThreeDotMenu.tsx's dropdown is `position: absolute` INSIDE this header —
    // its own zIndex:9999 only ranks it among header's children, not against the
    // ScrollView thread below, which paints on top of header (Android sibling
    // paint order) without this. Elevation is required for Android; zIndex alone
    // (RN's iOS/Fabric stacking) isn't enough there.
    zIndex: 10, elevation: 10,
  },
  backBtn: { padding: 4 },
  avatarWrap: { width: 40, height: 40 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.surfaceAlt },
  onlineDot: {
    position: 'absolute', right: -1, bottom: -1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: Colors.iOSGreen, borderWidth: 2, borderColor: Colors.surface,
  },
  headerText: { flex: 1, gap: 1 },
  headerName: { fontFamily: Fonts.poppinsSemiBold, fontSize: 15, color: Colors.textDark },
  headerStatus: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 12, color: Colors.textSecondary },
  moreBtn: { padding: 4 },
  // ThreeDotMenu.tsx defaults to top:48/right:12 (anchored to a full-width photo
  // card) — this header is much shorter, so anchor just under the 3-dot button.
  menuPosition: { top: 44, right: 8 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  emptyTitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textSecondary, textAlign: 'center' },

  threadContent: { paddingVertical: 12, flexGrow: 1 },
  dateSeparatorWrap: { alignItems: 'center', marginVertical: 10 },
  dateSeparatorText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 11, color: Colors.textSecondary,
    backgroundColor: Colors.surfaceAlt, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 3,
  },

  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider,
  },
  attachBtn: { padding: 8, marginBottom: 2 },
  input: {
    flex: 1, maxHeight: 100, minHeight: 40,
    backgroundColor: Colors.surfaceAlt, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 14, color: Colors.textPrimary,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnRecording: { backgroundColor: Colors.inputError },

  recordingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.inputError },
  recordingTimer: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: 13, color: Colors.textPrimary },

  blockedBanner: {
    alignItems: 'center', justifyContent: 'center', gap: 10,
    paddingTop: 20, paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider,
  },
  blockedText: { fontFamily: Fonts.poppinsMedium, fontSize: 14, color: Colors.textDark, textAlign: 'center' },
  tapToUnblock: {
    fontFamily: SemanticFontsEnglish.buttonEnglishMedium, fontSize: 14, color: Colors.primary,
    borderWidth: 1.5, borderColor: Colors.primary, borderRadius: 6,
    paddingHorizontal: 20, paddingVertical: 10,
  },
})
