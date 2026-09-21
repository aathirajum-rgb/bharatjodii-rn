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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Platform, Pressable,
  StyleSheet, Text, TextInput, View, useWindowDimensions,
  type ListRenderItem,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useAudioRecorder, useAudioRecorderState, RecordingPresets } from 'expo-audio'
import { LinearGradient } from 'expo-linear-gradient'
import CdnSvg, { CdnImage } from '../../components/cdn-svg/CdnSvg'
import { getOppGenderAvatarUrl } from '../../utils/avatar'
import ChatBubble from '../../components/chat/ChatBubble'
import AttachmentPreviewModal from '../../components/chat/AttachmentPreviewModal'
import ChatMediaViewerModal from '../../components/chat/ChatMediaViewerModal'
import ThreeDotMenu from '../../components/matches/ThreeDotMenu'
import ReportProfileModal from '../../components/matches/ReportProfileModal'
import { HtmlText } from '../../components/matches/matchesCard.shared'
import ContactDetailsSheet from '../../components/matches/ContactDetailsSheet'
import BottomSheet from '../../components/bottom-sheet/BottomSheet'
import Toast, { type ToastRequest } from '../../components/toast/Toast'
import { adaptChatMessageRecord, adaptSendResponse, dedupeMessages, groupMessagesByDate } from '../../adapters/chatMessage.adapter'
import {
  socketConnection, emitBasicView, onBasicView, emitChatMessages, onChatMessages,
  emitSendMessage, onSendResponse, emitMessageStatus, onReceiver, emitChatList,
} from '../../service/socketService'
import { blockChatProfile, unblockChatProfile, communicationBtnOnClick, checkPaidBlockerGate } from '../../service/communicationService'
import { checkFreeTrialCondition } from '../../service/payWallService'
import { handleBack, navigate } from '../../utils/navigationRef'
import { ENavigation } from '../../types/enums/navigation.enum'
import {
  getChatCount, consumeChatCount, checkChatLimit, fetchChatPaymentPromo, fetchChatSuggestions,
  fetchChatBlockerBanner, type ChatCountResult, type ChatPaymentPromo, type ChatBlockerBanner,
  type ChatBlockerBannerKind,
} from '../../service/chatService'
import {
  chooseAttachmentSource, pickChatAttachment, uploadChatAttachment,
  type PickedChatAttachment,
} from '../../service/chatMediaService'
import { useNetwork } from '../../contexts/NetworkContext'
import { usePhoneInfoSheet } from '../../hooks/usePhoneInfoSheet'
import { useAddPhotoPicker } from '../../hooks/useAddPhotoPicker'
import WebPhotoInput from '../../components/add-photo/WebPhotoInput'
import AddPhotoVerdictSheets from '../../components/add-photo/AddPhotoVerdictSheets'
import { requestMicrophonePermission } from '../../service/permissionService'
import { getItem, getJson, setJson } from '../../service/storageService'
import { getSessionValue, getRegValue } from '../../service/registrationService'
import { StorageKeys } from '../../constants/storage.keys'
import { CDN_SVG, CDN_LOTTIE } from '../../constants/cdn'
import CdnLottie from '../../components/CdnLottie'
import { Colors } from '../../constants/colors'
import { EnvConfig } from '../../constants/env'
import { formatLastActive } from '../../utils/chatTime'
import { Fonts, FontSize, SemanticFontsEnglish } from '../../src/theme/fonts'
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

// One row of the (inverted) FlatList thread below — a flattened, reversed
// view of groupMessagesByDate()'s {key, messages} groups. Flattening date
// separators into the same list as the messages (instead of a SectionList)
// sidesteps RN's well-known section-header quirks under `inverted`.
type ChatRow =
  | { type: 'separator'; id: string; label: string }
  | { type: 'message'; id: string; item: ChatMessageItem }

const CDN = CDN_SVG
const BACK_ICON_URI = CDN + 'arrow-back-activity.svg'
const DRAFT_STORE_KEY = 'CHATDRAFTMESSAGE'

type Props = { navigation: any; route: any }

export default function ChatScreen({ navigation, route }: Props) {
  const { t } = useTranslation()
  const { isOffline } = useNetwork()
  const insets = useSafeAreaInsets()
  // Angular: .chat-avatar-profile { width/height: 11.12vmin } — vmin is 1% of
  // the SMALLER viewport dimension, so the avatar grows with the device
  // (~40px on a 360pt phone, ~48px on a 430pt one) rather than sitting at a
  // fixed size. Mirrored here instead of hard-coding 40.
  const { width: winW, height: winH } = useWindowDimensions()
  const avatarSize = (Math.min(winW, winH) * 11.12) / 100
  // Angular: .jodii-chat-mic-img/.jodii-chat-send-img — width:11vmin IS the
  // total circular button size (confirmed: both Ionic's structure.css and the
  // app's own global.scss set `* { box-sizing: border-box }`, so padding is
  // subtracted FROM the 11vmin box, not added on top of it). Padding is NOT
  // uniform between states, so the icon isn't perfectly centered in Angular
  // either — mic: 8px all sides (button-revamp.component.scss:200-205);
  // send-active: 12px top/bottom, 13px left, 9px right (:225-230); send-
  // deactive: 11px top/bottom, 11px left, 8px right (:214-219).
  const sendBtnSize = (Math.min(winW, winH) * 11) / 100
  // Angular's <img> only sets `width` (no explicit `height`), so the browser
  // scales height automatically from the SVG's own intrinsic aspect ratio —
  // record-message-white.svg's real viewBox is 24×25 (not square), so
  // forcing width===height here squishes the glyph and visibly shifts it
  // off-center within the circle. Deriving height from the true ratio
  // instead keeps it centered exactly like Angular's unconstrained <img>.
  const micIconWidth = sendBtnSize - 16
  const micIconHeight = micIconWidth * (25 / 24)
  const sendIconWidth = sendBtnSize - 13 - 9
  const sendIconHeight = sendBtnSize - 12 - 12
  const scrollRef = useRef<FlatList<ChatRow>>(null)

  const partnerId = String(route.params?.partnerId ?? '')
  const [partnerName, setPartnerName]   = useState(String(route.params?.partnerName ?? ''))
  const [partnerPhoto, setPartnerPhoto] = useState(String(route.params?.partnerPhoto ?? ''))
  const [partnerOnline, setPartnerOnline] = useState(Boolean(route.params?.partnerOnline))
  const [partnerLastActive, setPartnerLastActive] = useState<number | null>(route.params?.partnerLastActive ?? null)
  // Angular: basicViewDetail?.VIEW?.IDVERIFIED — drives the "not yet verified"
  // note shown to female users chatting with an unverified male.
  const [partnerIdVerified, setPartnerIdVerified] = useState<number | null>(null)
  // Angular never renders a blank avatar: messages.component.html binds
  // (error)="onImgErrorHandler($event, true)", which swaps in a gender-based
  // silhouette (common.ts's getAvatarImg). `true` = opposite profile, so a
  // female user sees a male placeholder for her chat partner and vice versa.
  const [fallbackAvatar, setFallbackAvatar] = useState('')
  useEffect(() => { getOppGenderAvatarUrl().then(setFallbackAvatar) }, [])
  // Set when the real photo 404s, so the placeholder takes over.
  const [photoFailed, setPhotoFailed] = useState(false)
  useEffect(() => { setPhotoFailed(false) }, [partnerPhoto])
  const avatarUri = (!photoFailed && partnerPhoto) || fallbackAvatar
  // Angular: oppositeIdDetails.Reported (JODII-453 fix) — the row's own Reported
  // flag carried through nav params, not refreshed from BasicView. A reported
  // chat is read only: it opens like any other, but the footer swaps to a
  // read-only note in place of the input.
  const reported = Boolean(route.params?.partnerReported)

  const ownIdRef = useRef('')
  // Angular: ion-avatar.chat-avatar-profile on the sent side — loginUserPhoto
  // read from localStorage, not tied to this specific conversation.
  const [ownPhoto, setOwnPhoto] = useState('')
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

  // ── Paid-blocker / free-trial-expired banner ─────────────────────────────
  // Angular: check_Paid_NonVerifyIdUser()/check_Paid_Verified_Nophoto()/
  // payWallService.checkFreeTrialCondition('expired') — all three replace the
  // composer with the SAME banner block (messages.component.html:593-603),
  // re-checked on every getChatCount() refresh, not just once at entry.
  const [blockerGate, setBlockerGate] = useState<ChatBlockerBannerKind | null>(null)
  const [blockerBanner, setBlockerBanner] = useState<ChatBlockerBanner | null>(null)

  // ── Suggestion / template messages ───────────────────────────────────────
  // Angular: suggestionList/selectedSuggestion — canned conversation-starter
  // messages shown once, the first time a thread has no messages yet.
  const [suggestionList, setSuggestionList] = useState<string[] | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<number | null>(null)
  const suggestionsFetchedRef = useRef(false)
  const phoneInfo = usePhoneInfoSheet()
  // Web/PWA "Add photo now" CTA (phoneInfo's female-free-photo variants) — see
  // hooks/useAddPhotoPicker.ts for why this can't just navigate to the
  // native-only 'Gallery' screen.
  const addPhoto = useAddPhotoPicker({
    onRejected: (msg) => setToastRequest({ message: msg, key: Date.now() }),
    onError: (msg) => setToastRequest({ message: msg, key: Date.now() }),
  })

  // ── Call / WhatsApp (the "viewed number" system card's two CTAs) ─────────
  // Angular: messages.component.ts's callWhatsApp() — goes straight through
  // communicationBtnOnClick, no confirm-popup step first (that two-step
  // confirm→reveal flow is Matches-card-specific; this chat screen already
  // knows the partner via BasicView, same as Matches' direct-reveal path).
  const [contactDetails, setContactDetails] = useState<{
    name: string; mobile?: string | undefined; dialNumber?: string | undefined; whatsappNumber?: string | undefined
  } | null>(null)
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
    Promise.all([getSessionValue('ENTRYTYPE'), getItem(StorageKeys.User.LOGIN_GENDER), getSessionValue('PHOTOURL')]).then(([entryType, gender, photo]) => {
      if (cancelled) return
      setOwnEntryType(entryType ?? '')
      setOwnGender(gender ?? '')
      setOwnPhoto(photo ?? '')
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

  // Angular: setLimitExceed()'s 'oneConversation' branch — chatOneConversation
  // = SEND_ONE_MESSAGE with `##HE_SHE##` resolved to the PARTNER's pronoun via
  // getGenderPrefix_He_She(...).toLowerCase() (same lowercase convention
  // ChatBubble.tsx's own YOUVIEWEDNUMBER/VIEWEDYOURNUMBER pronoun substitution
  // uses). Angular's own `.replace('#COUNT#', this.chatBalance)` on this same
  // string is a no-op in production — the real en.json text hardcodes "3"
  // literally with no `#COUNT#` token in it at all — so not replicated here.
  function sendOneMessageText(): string {
    const oppGender = ownGender === 'F' ? 'M' : 'F'
    return t('MESSAGES.SEND_ONE_MESSAGE').replace(/##HE_SHE##/gi, t(`PRONOUN.${oppGender}.heshe`).toLowerCase())
  }

  // Angular: checkSetLimitValue() — purely derived from messages/chatCountResult/
  // messageDetails, so computed straight from render rather than mirrored into
  // its own state via an effect (no external system to synchronize with here).
  function computeMessageGate(): { allow: boolean; bannerText: string } {
    // Angular: getChatCount()'s check_Paid_* re-check unconditionally sets
    // messageAllow=false — rendered via the richer blockerBanner UI below
    // instead of bannerText, so this branch carries no text of its own.
    if (blockerGate) {
      return { allow: false, bannerText: '' }
    }
    if (firstTimeMsgLimitReached()) {
      return { allow: false, bannerText: sendOneMessageText() }
    }
    if (chatCountResult?.fairUsageExceeded && messageDetails) {
      const limitType = checkChatLimit(chatCountResult.chatBalanceDetail, messageDetails)
      if (limitType === 'monthlyLimitExceeded') return { allow: false, bannerText: buildLimitExceededText('3') }
      if (limitType === 'weeklyLimitExceeded')  return { allow: false, bannerText: buildLimitExceededText('2') }
      if (limitType === 'dailyLimitExceeded')   return { allow: false, bannerText: buildLimitExceededText('1') }
      if (limitType === 'oneConversationOnly')  return { allow: false, bannerText: sendOneMessageText() }
    }
    return { allow: true, bannerText: '' }
  }

  // Angular: showSuggestionSection() — suggestions are there to start the
  // conversation; once the member has sent a message, or the thread is
  // blocked/reported, or an attachment/recording is already in flight, they're
  // hidden. Angular's own gate also checks a separate `unblockedProfile`/
  // `blockedProfile` pair; `blockedState === 'none'` covers the same intent
  // (not currently blocked either direction) without needing that extra flag.
  function showSuggestions(): boolean {
    return !!suggestionList && suggestionList.length > 0 && !reported && blockedState === 'none'
      && sentMsgCount() === 0 && !isRecording && !recordedAttachment && !pendingAttachment
  }

  // Angular: getSuggestion() — fetched once, right after the thread loads, if
  // it turned out to be empty.
  async function loadSuggestionsIfEmpty(messageCount: number) {
    if (messageCount !== 0 || suggestionsFetchedRef.current) return
    suggestionsFetchedRef.current = true
    const [createdBy, memberCode, lang, name, city, gender] = await Promise.all([
      getRegValue('CREATEDBY'),
      getItem(StorageKeys.User.MEMBER_CODE),
      getItem(StorageKeys.Auth.LANG),
      getItem(StorageKeys.User.NAME),
      getRegValue('CITY'),
      getItem(StorageKeys.User.LOGIN_GENDER),
    ])
    const list = await fetchChatSuggestions({
      createdBy: createdBy ?? '0',
      memberCode: memberCode ?? '91',
      lang: lang ?? 'en',
      name: name ?? '',
      city: city ?? '',
      gender: gender ?? '',
    })
    setSuggestionList(list)
  }

  // Angular: patchSuggestion() — tapping the same suggestion again unselects
  // it and clears the composer; tapping a different one patches its text in.
  function handleSuggestionTap(text: string, index: number) {
    if (selectedSuggestion === index) {
      setSelectedSuggestion(null)
      setMessage('')
    } else {
      setSelectedSuggestion(index)
      setMessage(text)
    }
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

  // Angular: getChatCount()'s own check_Paid_* re-check (:1012) plus the
  // template's free-trial-expired condition (html:593) — re-derived every
  // time the thread refreshes, same cadence as refreshChatCount() above.
  async function refreshBlockerBanner() {
    const paidGate = await checkPaidBlockerGate()
    const kind: ChatBlockerBannerKind | null = paidGate ?? (await checkFreeTrialCondition('expired') ? 'free_trial_expired' : null)
    setBlockerGate(kind)
    if (!kind) { setBlockerBanner(null); return }
    setBlockerBanner(await fetchChatBlockerBanner(kind))
  }

  // Angular: reDirectToMembership() — a different action per gate: verify-ID
  // for the non-verified case, the add-photo flow for the verified-no-photo
  // case (native callNative('Add_photo') — reusing this screen's own
  // useAddPhotoPicker trigger, already wired for the phone-privacy sheet),
  // and the plain recharge screen for a plain expired free trial.
  function handleBlockerBannerCta() {
    if (blockerGate === 'non_verify_id') { navigation.navigate('verify-id'); return }
    if (blockerGate === 'verified_no_photo') { addPhoto.openAddPhoto(navigation); return }
    navigation.navigate('recharge')
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
  // Angular: ionViewWillEnter() (messages.component.ts:344) re-runs on EVERY
  // re-entry to this page — not just the first — re-emitting BasicView/
  // ChatMessages/ChatList. React Navigation keeps this screen mounted
  // underneath a pushed screen (View Profile, Safety Tips, Report flow), so a
  // plain mount-only effect never re-ran here, and messages sent/received
  // while you were away, the partner's online/last-active/verified state, and
  // the chat-list badge all went stale until you left and re-entered the
  // whole navigator. useFocusEffect is this codebase's established RN
  // equivalent of ionViewWillEnter (see MessagerListScreen.tsx's own fix for
  // the identical bug on the conversation list).
  useFocusEffect(useCallback(() => {
    let cancelled = false
    suggestionsFetchedRef.current = false

    const unsubscribeBasicView = onBasicView((data: any) => {
      if (cancelled || !data) return
      if (String(data.ID ?? '') !== partnerId) return
      // RESPBASIC carries some fields at the top level (ID, NAME confirmed) and
      // some possibly only inside VIEW — check both rather than assuming one
      // level exclusively, since a real capture showed NAME at the top level.
      const view = data.VIEW ?? {}
      const name       = view.NAME ?? data.NAME
      // Angular (messages.component.ts:313) reads the photo from the TOP level
      // of RESPBASIC — `this.oppositeIdDetails.Photourl = check.PHOTO` — not
      // from VIEW. Checking VIEW first meant a response carrying only the
      // top-level PHOTO still resolved, but any VIEW.PHOTOURL-shaped payload
      // took precedence over the field Angular actually trusts. Top level is
      // now preferred, with the VIEW variants kept as fallbacks.
      const photo      = data.PHOTO ?? data.PHOTOURL ?? view.PHOTOURL ?? view.PHOTO
      // Angular (:316-318) uses VIEW.ONLINE, not ONLINENOW.
      const onlineNow  = view.ONLINE ?? view.ONLINENOW ?? data.ONLINENOW
      const lastLogin  = view.LASTLOGIN ?? data.LASTLOGIN
      // Angular (:309) checks BLOCKED at the TOP level of the response.
      const blocked    = data.BLOCKED ?? view.BLOCKED
      const idVerified = view.IDVERIFIED
      if (name) setPartnerName(name)
      if (photo) setPartnerPhoto(photo)
      if (onlineNow != null) setPartnerOnline(Number(onlineNow) === 1)
      if (lastLogin) setPartnerLastActive(Number(lastLogin) * 1000)
      // Angular (:328-331): a live BasicView push reporting BLOCKED=='Y'
      // also clears the draft (`this.message = ""`), not just the blocked
      // banner state.
      if (blocked === 'Y') { setBlockedState('by_me'); setMessage('') }
      else if (blocked === 'B') setBlockedState('by_them')
      if (idVerified != null) setPartnerIdVerified(Number(idVerified))
    })

    const unsubscribeMessages = onChatMessages((data: ChatMessagesResponse) => {
      if (cancelled) return
      const records = data?.CHATLIST ?? []
      const adapted = records.map(r => adaptChatMessageRecord(r, ownIdRef.current))
      setMessages(dedupeMessages(adapted))
      setMessageDetails(data?.TOTALMSGCNT ?? null)
      setLoaded(true)
      refreshChatCount()
      refreshBlockerBanner()
      loadSuggestionsIfEmpty(adapted.length)
    })

    const unsubscribeSend = onSendResponse((res: SendMessageResponse) => {
      if (cancelled) return
      setSending(false)
      // Angular: getSendResp() — RESPONSECODE 2 + ERRCODE 1 is a server-side
      // send failure; Angular toasts the server's error text (if any) before
      // dropping it (no bubble to show for a message that never sent).
      if (Number(res?.RESPONSECODE) === 2 && Number(res?.ERRCODE) === 1) {
        if (res?.Message) setToastRequest({ message: res.Message, key: Date.now() })
        return
      }
      const own = adaptSendResponse(res, ownIdRef.current, pendingVoiceDurationRef.current)
      pendingVoiceDurationRef.current = undefined
      setMessages(prev => dedupeMessages([...prev, own]))
      // Angular: getSendResp()'s post-send chatCount(TYPE=2) — fired once, only
      // for the first REAL message of a thread (see handleSend()).
      if (pendingFirstMessageRef.current) {
        pendingFirstMessageRef.current = false
        consumeChatCount(partnerId).then(() => {
          refreshChatCount()
          // Angular: emitChatList(5, 0, 1) inside the same chatCount(TYPE=2)
          // success callback — pushes a fresh unread/message count to the rest
          // of the app (messager-list's badge) right after the thread's first
          // real message actually lands.
          emitChatList(5, 0, 1)
        })
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
        // Angular: ngOnInit()'s unconditional emitChatList() — refreshes the
        // messager-list badge/count on every chat entry, not just after a
        // first message sends.
        emitChatList()
      })
    })

    return () => {
      cancelled = true
      unsubscribeBasicView()
      unsubscribeMessages()
      unsubscribeSend()
      unsubscribeReceiver()
    }
  }, [partnerId]))

  // Angular: getRecordedTime() subscription's `time == "03:00"` check.
  useEffect(() => {
    if (isRecording && recorderState.durationMillis >= MAX_RECORDING_MS) {
      stopRecordingAndFinalize()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording, recorderState.durationMillis])

  // Angular: updateScroll() — always jumps to bottom, no preserved-position
  // logic (there's no load-older-messages feature to preserve position for).
  // The thread FlatList below is `inverted`, so "bottom" (the newest message)
  // is offset 0 — scrollToOffset(0) is the inverted-list equivalent of the
  // old ScrollView's scrollToEnd().
  useEffect(() => {
    if (messages.length) {
      const timeout = setTimeout(() => scrollRef.current?.scrollToOffset({ offset: 0, animated: true }), 100)
      return () => clearTimeout(timeout)
    }
    return undefined
  }, [messages.length])

  // Angular: sendMessage()'s/trigerFile()'s shared else-if chain — when
  // checkToSendMessage() fails, one popup explains why (paid-balance promo,
  // under-validation, or rejected-validation), in that priority order. Shared
  // by both the text-send gate and the attachment-button gate below.
  // Angular: sendMessage()'s else-if chain (messages.component.ts:669-680) —
  // in this exact order: the free-member/zero-balance payment-promo popup
  // FIRST, then validation=='0', then validation=='2'. A previous version of
  // this port checked validation=='0'/'2' first and fell through to the
  // promo last, so a paid user with zero balance AND a validation flag saw
  // the wrong popup. No final "else" here either — Angular shows nothing if
  // none of the three conditions match.
  async function explainWhySendBlocked() {
    if (ownEntryType === 'F' || (ownEntryType === 'P' && chatCountResult?.chatBalance === '0' && chatCountResult?.profileValidation === '1')) {
      const promo = await fetchChatPaymentPromo(partnerName)
      setPaymentPromo(promo)
      setShowPaymentPromo(true)
    } else if (chatCountResult?.profileValidation === '0' && chatCountResult.profileValidationMsg) {
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
    }
  }

  // Angular: messages.component.ts's callWhatsApp('call'/'whatsapp', 'opposite')
  // — both the "viewed number" system card's Call Now and WhatsApp buttons
  // route through this (Angular literally hardcodes 'call' as the action for
  // BOTH buttons in its own template, but that only affects which contact
  // field is preferred server-side — showContactDetails() already returns the
  // same dialNumber for both, see communicationService.ts, so calling with
  // the real 'call'/'whatsapp' action here is equivalent and more correct).
  // Wrapped in useCallback (with usePhoneInfoSheet's own return value now
  // memoized too) so renderRow's useCallback below isn't defeated on every
  // ChatScreen re-render — it was previously a plain function, recreated
  // every render regardless of whether its own inputs actually changed.
  const handleCallOrWhatsApp = useCallback(async (action: 'call' | 'whatsapp') => {
    try {
      const result = await communicationBtnOnClick('message', action, { MATRIID: partnerId })
      if (result.type === 'show_contact') {
        setContactDetails({
          name: partnerName,
          mobile: result.mobile,
          dialNumber: result.dialNumber,
          whatsappNumber: result.whatsappNumber,
        })
        return
      }
      if (await phoneInfo.handleResult(result)) return
      if (result.type === 'payment_promo') {
        navigation.navigate('recharge')
      }
    } catch (e) {
      if (__DEV__) console.error('[Chat] call/whatsapp error:', e)
    }
  }, [partnerId, partnerName, phoneInfo, navigation])

  function handleContactDetailsCall() {
    if (contactDetails?.dialNumber) Linking.openURL(`tel:${contactDetails.dialNumber}`)
  }

  function handleContactDetailsWhatsApp() {
    const num = contactDetails?.whatsappNumber?.replace(/\D/g, '')
    if (num) Linking.openURL(`https://wa.me/${num}`)
  }

  async function handleSend() {
    const text = message.trim()
    if (!text || sending) return

    // Defense-in-depth alongside the global OfflineScreen overlay — don't even
    // attempt the send while offline.
    if (isOffline) {
      setToastRequest({ message: t('GENERAL.NOINTERNET'), key: Date.now() })
      return
    }

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
      // CHAT_MSG_LIMIT's copy is specifically the file-size-limit message
      // (see the tooLarge branch above) — a generic upload failure here
      // (network drop, server error) isn't the same thing and shouldn't
      // borrow that wording.
      setToastRequest({ message: 'Upload failed. Please try again.', key: Date.now() })
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
      // Same generic-vs-size-limit distinction as handleSendAttachment above.
      setToastRequest({ message: 'Upload failed. Please try again.', key: Date.now() })
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

  // Angular: messages.component.ts's viewProfileRedirect() — html:43's "View
  // #HIS_HER# profile" row, always shown.
  function handleMenuView() {
    setMenuOpen(false)
    navigate(ENavigation.VIEW_PROFILE, { matriId: partnerId, fromPage: 'chat' })
  }

  // Angular: selectSelction('safety-tips') → router.navigate(['/safety-tips']).
  function handleMenuSafetyTips() {
    setMenuOpen(false)
    navigate(ENavigation.SAFETY_TIPS)
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

  // Angular: bottom-sheet.component.html's `action === 'block-profile'` block —
  // CTA1 ("Yes"/"Unblock", the confirm action) is the OUTLINE button
  // ([border]="'primaryBorder'" [background]="'whiteBg'"), CTA2 ("No"/"Cancel",
  // the safe option) is the FILLED one (primaryBtnInfo) — a deliberate nudge
  // away from the destructive action. BottomSheet's generic sideBySide layout
  // always renders `ctaLabel` filled/primary and `secondaryCtaLabel` outline/
  // ghost, so CTA2 goes to `ctaLabel`+onPrimaryPress (dismiss) and CTA1 goes to
  // `secondaryCtaLabel`+onSecondaryPress (confirm) to keep the same visual
  // hierarchy — not because CTA2 is "primary" in behavior.
  const confirmSheetData = confirmAction === 'block'
    ? {
        image: CDN + 'confirm-block-jodii-chat-img.svg',
        title: t('PRIVACY.BLOCK_TITLE'),
        content: t('PRIVACY.BLOCK_SUBTITLE'),
        ctaLabel: t('PRIVACY.BLOCK_CTA2'),
        secondaryCtaLabel: t('PRIVACY.BLOCK_CTA1'),
        sideBySideCtas: true,
      }
    : {
        image: CDN + 'confirm-block-jodii-chat-img.svg',
        title: t('PRIVACY.UNBLOCK_HEADER').replace('#NAME#', partnerName),
        content: t('PRIVACY.UNBLOCK_CONTENT').replace(/##[A-Z_]+##/g, ''),
        ctaLabel: t('PRIVACY.UNBLOCK_CTA2'),
        secondaryCtaLabel: t('PRIVACY.UNBLOCK_CTA1'),
        sideBySideCtas: true,
      }

  const { allow: messageAllow, bannerText: limitBannerText } = computeMessageGate()
  const groups = groupMessagesByDate(messages, t('MESSAGES.TODAY'), t('MESSAGES.YESTERDAY'))
  // Flatten oldest-first {key, messages} groups into rows, then reverse for
  // the inverted FlatList below (index 0 renders at the visual bottom under
  // `inverted`, so the newest message/row needs to be first).
  const chatRows = useMemo<ChatRow[]>(() => {
    const rows: ChatRow[] = []
    for (const group of groups) {
      rows.push({ type: 'separator', id: `sep-${group.key}`, label: group.key })
      for (const item of group.messages) rows.push({ type: 'message', id: item.id, item })
    }
    return rows.reverse()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, t])
  const renderRow: ListRenderItem<ChatRow> = useCallback(({ item: row }) => {
    if (row.type === 'separator') {
      return (
        <View style={styles.dateSeparatorWrap}>
          <Text style={styles.dateSeparatorText}>{row.label}</Text>
        </View>
      )
    }
    return (
      <ChatBubble
        item={row.item}
        onPressMedia={(kind, uri) => setMediaViewer({ kind, uri })}
        oppGender={ownGender === 'F' ? 'M' : 'F'}
        onCallPress={() => handleCallOrWhatsApp('call')}
        onWhatsAppPress={() => handleCallOrWhatsApp('whatsapp')}
        ownPhoto={ownPhoto}
        partnerPhoto={partnerPhoto}
      />
    )
  }, [ownGender, ownPhoto, partnerPhoto, handleCallOrWhatsApp])
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
          <CdnSvg uri={BACK_ICON_URI} width={24} height={48} />
        </Pressable>
        <View style={[styles.avatarWrap, { width: avatarSize, height: avatarSize }]}>
          {/* fallbackAvatar is a remote .svg — native <Image> can't decode
              that (see CdnSvg.tsx), so this needs CdnImage's format
              detection rather than a plain Image. */}
          {avatarUri
            ? <CdnImage
                uri={avatarUri}
                width={avatarSize}
                height={avatarSize}
                onError={() => setPhotoFailed(true)}
                resizeMode="cover"
                style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]}
              />
            : <View style={[styles.avatar, { width: avatarSize, height: avatarSize, borderRadius: avatarSize / 2 }]} />}
          {partnerOnline && <View style={styles.onlineDot} />}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
          {!!lastActiveText && <Text style={styles.headerStatus} numberOfLines={1}>{lastActiveText}</Text>}
        </View>
        {/* Angular: call-message.svg — a direct call icon sits before the
            3-dot menu, both routing through callWhatsApp('call', 'opposite').
            Angular's .moreEvent class (shared by both icons) has NO CSS size
            override at all — confirmed against the live CDN asset (it's
            missing from Angular's own local repo checkout, but does exist on
            the deployed CDN, 200 OK) — so both render at their own intrinsic
            SVG size: call-message.svg is a 44x44 viewBox, jodii-chat-3dot-img
            is 16x25 (a tall, narrow glyph, not square). */}
        <Pressable onPress={() => handleCallOrWhatsApp('call')} hitSlop={12} style={styles.callBtn}>
          <CdnSvg uri={CDN + 'call-message.svg'} width={44} height={44} />
        </Pressable>
        <Pressable onPress={() => setMenuOpen(v => !v)} hitSlop={12} style={styles.moreBtn}>
          <CdnSvg uri={CDN + 'jodii-chat-3dot-img.svg'} width={16} height={25} />
        </Pressable>
        {menuOpen && (
          <ThreeDotMenu
            positionStyle={styles.menuPosition}
            showView
            onView={handleMenuView}
            viewGender={ownGender === 'F' ? 'M' : 'F'}
            showBlock={blockedState === 'none' && !reported}
            onBlock={handleMenuBlock}
            showUnblock={blockedState === 'by_me'}
            onUnblock={handleMenuUnblock}
            showReport
            onReport={handleMenuReport}
            showSafetyTips
            onSafetyTips={handleMenuSafetyTips}
          />
        )}
      </View>

      {/* Angular: .not-verified-note (messages.component.html:102-107) — shown
          to a female member chatting with a male whose ID isn't verified yet. */}
      {ownGender === 'F' && partnerIdVerified === 0 && (
        <View style={styles.notVerifiedNote}>
          <Text style={styles.notVerifiedNoteText}>{t('VIEWPROFILE.VERIFIED_NOTE')}</Text>
        </View>
      )}

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
            <CdnLottie uri={CDN_LOTTIE + 'loader.json'} width={80} height={80} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>{t('MESSAGES.NO_MESSAGES')}</Text>
          </View>
        ) : (
          // `inverted` — was a plain ScrollView+.map() rendering every message
          // at once (fine for a short thread, but mounts every attachment/
          // image/audio bubble in a long-running conversation regardless of
          // whether it's on screen). FlatList only mounts cells near the
          // visible viewport; `inverted` is the standard RN chat pattern —
          // data is fed newest-first (chatRows above is already built that
          // way) so the newest message renders at the bottom without an
          // explicit scroll-to-end on every load, the way the ScrollView
          // version needed.
          <FlatList
            ref={scrollRef}
            style={styles.flex1}
            data={chatRows}
            keyExtractor={row => row.id}
            renderItem={renderRow}
            inverted
          />
        )}

        {/* ── Input / blocked / limit-exceeded banner ── */}
        {reported ? (
          // Angular: isChatReported() (JODII-453 fix) — a reported chat can be
          // read but not answered, this note takes priority over the block/
          // limit banners below since none of those reasons matter once reported.
          <View style={[styles.blockedBanner, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.blockedText}>{t('MESSAGES.REPORTED_PROFILE')}</Text>
          </View>
        ) : blockedState === 'by_them' ? (
          <View style={[styles.blockedBanner, styles.blockedBannerGrey, { paddingBottom: Math.max(insets.bottom, 24) }]}>
            <Text style={styles.blockedText}>{t('PRIVACY.OPP_BLOCK_TEXT')}</Text>
          </View>
        ) : blockedState === 'by_me' ? (
          <Pressable
            style={[styles.blockedBanner, styles.blockedBannerGrey, { paddingBottom: Math.max(insets.bottom, 24) }]}
            onPress={handleBannerTapToUnblock}
          >
            <Text style={styles.blockedText}>{t('MESSAGES.BLOCKED_CONTENT')}</Text>
            <Text style={styles.tapToUnblock}>{t('MESSAGES.TAP_HERE')}</Text>
          </Pressable>
        ) : blockerGate && blockerBanner ? (
          // Angular: messages.component.html:593-603 (.free-trial-expired) —
          // the SAME banner block for all three gates (paid-non-verified,
          // paid-verified-no-photo, free-trial-expired), just different
          // content-source keys and CTA action.
          <LinearGradient
            colors={['#FFF7F9', '#FFFFFF']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            // Angular: `linear-gradient(180deg, #FFF7F9 0%, #FFF 165.73%)` —
            // the white stop is past 100%, so full white is reached at
            // 100/165.73 ≈ 60% of the box height, then stays solid white for
            // the rest (not a plain 0%→100% fade across the whole height).
            locations={[0, 0.6035]}
            style={[styles.blockerBanner, { paddingBottom: Math.max(insets.bottom, 24) }]}
          >
            <Text style={styles.blockerBannerTitle}>{blockerBanner.title}</Text>
            <Text style={styles.blockerBannerSubtitle}>
              {blockerBanner.subtitleTemplate.replace('##NAME##', partnerName)}
            </Text>
            <Pressable style={styles.blockerBannerCta} onPress={handleBlockerBannerCta}>
              <Text style={styles.blockerBannerCtaText}>{blockerBanner.ctaLabel}</Text>
            </Pressable>
          </LinearGradient>
        ) : !messageAllow ? (
          // Angular: showBottomRestriction() — the entire footer is replaced,
          // not just a disabled send button. Real source is `.send-one-msg-
          // block` (messages.component.scss:861-872) — the SAME gradient-
          // top-border + pink-to-white background treatment as blockerBanner
          // above, not a plain white/hairline-bordered box.
          <LinearGradient
            colors={['#FFF7F9', '#FFFFFF']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            // Angular: same `linear-gradient(180deg, #FFF7F9 0%, #FFF
            // 165.73%)` as blockerBanner above — full white at ~60% of the
            // box height, not a plain 0%→100% fade.
            locations={[0, 0.6035]}
            style={[styles.blockerBanner, { paddingBottom: Math.max(insets.bottom, 24) }]}
          >
            {/* Angular: `[innerHTML]="chatOneConversation"` — SEND_ONE_MESSAGE
                carries a `<span class="font-14-semibold">` around "only one
                message" for emphasis; a plain <Text> showed the raw tag. */}
            <HtmlText html={limitBannerText} style={styles.limitReachedText} />
            <Pressable
              style={styles.exploreMatchesRow}
              onPress={() => navigation.navigate('MainTabs', { screen: 'Matches' })}
            >
              <Text style={[styles.tapToUnblock, styles.exploreMatchesColor]}>{t('MESSAGES.EXPLORE_MATCHES')}</Text>
              {/* Angular: app-button-revamp's `iconPosition="end"` +
                  `iconType="forward-animation-link"` — an animated forward-
                  arrow GIF after the label, not plain text with no icon.
                  resizeMode="stretch": Angular's plain <img> has no object-fit
                  (browser default fill/stretch); the GIF's real native frame
                  is a 1200x1200 SQUARE, and RN Image's own default
                  (resizeMode:'cover') would crop it to fill this non-square
                  box instead, visibly zooming the arrow in. */}
              <Image source={{ uri: CDN + 'revamp/animation/right-arrow-animation.gif' }} style={styles.exploreMatchesArrow} resizeMode="stretch" />
            </Pressable>
          </LinearGradient>
        ) : (
          <>
            {/* Angular: messages.component.html:481-496 (suggestions-for-you-block) —
                pinned directly above the composer, hidden once the member has
                sent a message or an attachment/recording is in flight. */}
            {showSuggestions() && (
              // Angular: linear-gradient(218deg, #FFF7F9 0% -> #FFF 91.61%).
              // 218deg's direction vector is (-0.616, 0.788) in screen space
              // (CSS gradient angle 0deg = "to top"), so the pale pink (0%)
              // sits toward the top-right and fades to white toward the
              // bottom-left — same conversion approach as ChatBubble.tsx's
              // own gradient comment.
              <LinearGradient
                colors={['#FFF7F9', '#FFFFFF']}
                start={{ x: 0.81, y: 0.11 }}
                end={{ x: 0.19, y: 0.89 }}
                locations={[0, 0.9161]}
                style={styles.suggestionsBlock}
              >
                <Text style={styles.suggestionsTitle}>{t('MESSAGES.SUGGESTIONS', 'Suggestions for you')}</Text>
                {suggestionList!.map((text, i) => (
                  <Pressable
                    key={i}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionTap(text, i)}
                  >
                    <Text style={styles.suggestionText}>{text}</Text>
                    <View style={[styles.suggestionCheckbox, selectedSuggestion === i && styles.suggestionCheckboxChecked]}>
                      {selectedSuggestion === i && <View style={styles.suggestionCheckboxDot} />}
                    </View>
                  </Pressable>
                ))}
              </LinearGradient>
            )}
          <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            {/* Angular: messages.component.html:642-649 — the attachment icon
                is a CHILD of the textarea itself (position: absolute; right:
                5%; top: 25%), overlapping the pill from the inside, not a
                separate button before it. */}
            <View style={styles.inputWrap}>
              {isRecording ? (
                <Pressable style={[styles.input, styles.inputRecording]} onPress={stopRecordingAndFinalize}>
                  <View style={styles.recordingRow}>
                    <CdnSvg uri={CDN + 'jodii-chat-mic-img-red.svg'} width={18} height={18} />
                    <View style={styles.recordingDot} />
                    <Text style={styles.recordingTimer}>{formatVoiceDuration(recorderState.durationMillis / 1000)}</Text>
                  </View>
                </Pressable>
              ) : recordedAttachment ? (
                <View style={[styles.input, styles.inputRecorded]}>
                  <View style={styles.recordingRow}>
                    <Pressable onPress={handleCancelRecording} hitSlop={8}>
                      <CdnSvg uri={CDN + 'jodii-chat-cross-img-red.svg'} width={16} height={16} />
                    </Pressable>
                    <Text style={styles.recordingTimer}>{recordedDurationLabel}</Text>
                  </View>
                </View>
              ) : (
                <TextInput
                  style={[styles.input, message.trim().length > 0 && styles.inputTyping]}
                  value={message}
                  onChangeText={setMessage}
                  placeholder={t('MESSAGES.TYPE_TEXT')}
                  placeholderTextColor={Colors.textPlaceholder}
                  multiline
                />
              )}
              {!isRecording && !recordedAttachment && (
                <Pressable onPress={handleAttachmentPress} hitSlop={8} style={styles.attachBtn}>
                  <CdnSvg uri={CDN + 'jodii-chat-attachment-img.svg'} width={20} height={21} />
                </Pressable>
              )}
            </View>

            {message.trim() || recordedAttachment ? (
              // Angular: .jodii-chat-send-img — padding: 12px 9px 12px 13px
              // (top/right/bottom/left), not centered — the icon sits
              // slightly left-and-up of true center. Explicit padding here
              // (not alignItems/justifyContent: center) reproduces that,
              // since the icon's own box fills exactly what's left over.
              <Pressable
                style={[
                  styles.sendBtn, styles.sendBtnPadded,
                  { width: sendBtnSize, height: sendBtnSize, borderRadius: sendBtnSize / 2 },
                  (sending || voiceSending) && styles.sendBtnDisabled,
                ]}
                onPress={message.trim() ? handleSend : handleSendVoice}
                disabled={sending || voiceSending}
              >
                {voiceSending
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <CdnSvg uri={CDN + 'send-message-white.svg'} width={sendIconWidth} height={sendIconHeight} />}
              </Pressable>
            ) : (
              <Pressable
                style={[styles.sendBtn, { width: sendBtnSize, height: sendBtnSize, borderRadius: sendBtnSize / 2, marginBottom: 10 }, isRecording && styles.sendBtnRecording]}
                onPressIn={handleMicPressIn}
                onPressOut={stopRecordingAndFinalize}
              >
                <CdnSvg uri={CDN + 'record-message-white.svg'} width={micIconWidth} height={micIconHeight} style={{ marginBottom: 5 }} />
              </Pressable>
            )}
          </View>
          </>
        )}
      </KeyboardAvoidingView>

      <BottomSheet
        visible={!!confirmAction}
        type="blockProfile"
        data={confirmSheetData}
        onClose={() => setConfirmAction(null)}
        onPrimaryPress={() => setConfirmAction(null)}
        onSecondaryPress={confirmBlockOrUnblock}
      />
      <ReportProfileModal
        visible={showReportModal}
        partnerId={partnerId}
        partnerName={partnerName}
        onClose={() => setShowReportModal(false)}
        onSubmitted={() => setShowReportModal(false)}
      />
      {/* Angular: modalpopup.component.html's viewProfileContactNo popup —
          shown after the "viewed number" card's Call Now/WhatsApp buttons
          resolve to a real phone number. */}
      <ContactDetailsSheet
        visible={!!contactDetails}
        name={contactDetails?.name ?? ''}
        mobile={contactDetails?.mobile}
        whatsappNumber={contactDetails?.whatsappNumber}
        onClose={() => setContactDetails(null)}
        onCall={handleContactDetailsCall}
        onWhatsApp={handleContactDetailsWhatsApp}
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
        onSecondaryPress={() => phoneInfo.secondaryPress(addPhoto.openAddPhoto, navigation)}
        onLinkPress={phoneInfo.close}
      />
      <Toast request={toastRequest} />
      <WebPhotoInput inputRef={addPhoto.webInputRef} onChange={addPhoto.handleWebFiles} />
      <AddPhotoVerdictSheets addPhoto={addPhoto} />

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
  // Angular: no background rule anywhere for ion-content/.chat-section — falls
  // back to Ionic's default #ffffff, not the app's usual grey/lavender page bg.
  screen: { flex: 1, backgroundColor: Colors.white },
  flex1: { flex: 1 },

  // Angular: `ion-row.pl-6.pt-12.pb-12.pr-8` (messages.component.html:4) —
  // 6/8px horizontal (asymmetric, not a flat 12), 12/12 vertical (not 10).
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingLeft: 6, paddingRight: 8, paddingTop: 12, paddingBottom: 12,
    backgroundColor: Colors.surface,
    // Angular: .jodii-messages-top-header-bottom (messages.component.scss:97-99)
    // — border-bottom: 1px solid #e5e5e5, applied to this header row in
    // messages.component.html:4. Was hairlineWidth (0.33-0.5px on most devices)
    // in Colors.divider #f0f0f0 — both the width and the colour were off, and
    // inputBar below already uses a full 1px for its own Angular border.
    borderBottomWidth: 1, borderBottomColor: '#e5e5e5',
    // ThreeDotMenu.tsx's dropdown is `position: absolute` INSIDE this header —
    // its own zIndex:9999 only ranks it among header's children, not against the
    // FlatList thread below, which paints on top of header (Android sibling
    // paint order) without this. Elevation is required for Android; zIndex alone
    // (RN's iOS/Fabric stacking) isn't enough there.
    zIndex: 10, elevation: 10,
  },
  backBtn: { padding: 4 },
  // Angular: .chat-avatar-profile is 11.12vmin (messages.component.scss:92) —
  // it scales with the viewport rather than sitting at a fixed px. Sizes are
  // applied inline from avatarSize below; only the non-dimensional bits live
  // here.
  avatarWrap: {},
  avatar: { backgroundColor: Colors.surfaceAlt },
  // Angular: `.jodii-chat-online` (messages.component.scss:80-90) —
  // background #35ab83 (not iOS green), 1.5px white border (not 2), and
  // positive insets (bottom:3%, right:5%) that sit mostly INSIDE the avatar
  // circle near its corner, not outside it.
  onlineDot: {
    position: 'absolute', right: '5%', bottom: '3%',
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: '#35ab83', borderWidth: 1.5, borderColor: Colors.surface,
  },
  headerText: { flex: 1, gap: 1 },
  // Angular: h2.heading4-medium-16.black-color.mb-4.line-height-26 — MEDIUM
  // weight (not semibold) at font16, pure black (not textDark), line-height
  // 26, 4px bottom margin.
  headerName: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font16, color: Colors.black, lineHeight: 26, marginBottom: 4 },
  // Angular: p.body3-regular-12.color-1f2721 — font12, a distinct near-black-
  // green (#1f2721), not this app's general textSecondary grey.
  headerStatus: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.chatLastSeenText },
  callBtn: { padding: 4 },
  // Angular's header row (ion-row) has no explicit gap/column-gap — the call
  // icon's column zeroes its padding (padd0) while the 3-dot's column keeps
  // Ionic's own tighter default column padding, so the two icons sit closer
  // together than the row's general 10px gap. Pull the 3-dot in to match.
  moreBtn: { padding: 4, marginLeft: -4 },
  // ThreeDotMenu.tsx defaults to top:48/right:12 (anchored to a full-width photo
  // card) — this header is much shorter, so anchor just under the 3-dot button.
  // Angular's own `right: 31%` resolves against Ionic's internal grid
  // context, not this screen's actual full-width header row — using that
  // percentage literally here overshot far to the left. Anchored to the
  // 3-dot button's own position instead (a fixed inset from the right edge,
  // matching where the button visually sits), which is what actually lines
  // the menu up under it.
  menuPosition: { top: 70, right: 16 },

  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  // No Angular equivalent — an empty thread never renders bare in Angular
  // (there's always at least the phone-view system row or a real message);
  // left as-is, not sourced from any Angular class.
  emptyTitle: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.textSecondary, textAlign: 'center' },

  // Angular: messages.component.html:115-120 — plain centered ion-label, NO
  // background/border/shadow/card of any kind (confirmed: no matching CSS
  // rule anywhere for this row). pt-8/pb-8 (8px top/bottom on the row) plus
  // the next message row's own mt-16 gives ~24px total gap to the next bubble.
  // Angular: pt-8/pb-8 on the divider row itself; the FIRST message row below
  // supplies its own mt-16 (ChatBubble.tsx's `row` style), so this only needs
  // its own 8/8 — the 16 comes from the message row, not doubled here.
  dateSeparatorWrap: { alignItems: 'center', paddingTop: 8, paddingBottom: 8 },
  dateSeparatorText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.chatNearBlackText,
  },

  // Angular: .suggestions-for-you-block (messages.component.scss:837-842) —
  // border-top 1px solid #F1B6C5, linear-gradient(218deg, #FFF7F9 0%,
  // #FFF 91.61%). Angular positions this `fixed` above the composer;
  // RN achieves the same effect by rendering it as a sibling directly above
  // inputBar in the same non-scrolling footer area.
  suggestionsBlock: {
    paddingHorizontal: 24, paddingBottom: 24, paddingTop: 20,
    borderTopWidth: 1, borderTopColor: '#F1B6C5',
  },
  // Angular: .font-14-semibold.color-333333
  suggestionsTitle: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: '#333333',
    marginBottom: 16,
  },
  // Angular: .suggestion-box-text — border-radius 8, border 1px solid
  // #545454, background #FFF; each ion-item repeats with mt-16 (16px gap).
  suggestionItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderRadius: 8, borderWidth: 1, borderColor: '#545454', backgroundColor: Colors.white,
    paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, gap: 12,
  },
  // Angular: .jodii-chat-suggestions-for-you-content-text — white-space:
  // break-spaces (wraps, doesn't truncate), color #000000; body3-regular-12.
  suggestionText: {
    flex: 1, fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font12, color: Colors.black,
  },
  // Angular: ion-checkbox mode="md" — a plain square checkbox, not the radio
  // dot this port's earlier (dead, commented-out) accordion variant used.
  suggestionCheckbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#8a8a8a',
    alignItems: 'center', justifyContent: 'center',
  },
  suggestionCheckboxChecked: { borderColor: Colors.primaryDark, backgroundColor: Colors.primaryDark },
  suggestionCheckboxDot: { width: 10, height: 10, borderRadius: 2, backgroundColor: Colors.white },

  // Angular: .messages-bottom-block — background #FFF, border-top 1px solid
  // #E6E6E6, pb-16/pt-16 (16px top/bottom padding, not 8).
  // Angular: `ion-cust-padding-start/end` (messages.component.html:639) —
  // 24px horizontal, --ion-cust-padding — not 12.
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 24, paddingTop: 16, paddingBottom: 16,
    backgroundColor: Colors.surface,
    borderTopWidth: 1, borderTopColor: '#E6E6E6',
  },
  // Angular: ion-textarea.posrelative — the textarea itself is the
  // positioning context for the absolutely-positioned attachment icon inside
  // it (messages.component.scss:312-317: position:absolute; right:5%; top:25%).
  inputWrap: { flex: 1, position: 'relative', justifyContent: 'center' },
  // Angular: .jodii-chat-attachment-img — width:20px, position:absolute,
  // right:5%, top:25% — overlapping the pill from inside, not a sibling
  // button before it.
  attachBtn: { position: 'absolute', right: '5%', top: '25%' },
  // Angular: .jodii-chat-textarea (empty state) — border 1px solid #808080,
  // border-radius 52px (pill), background #F0F0F0. --padding-end:14% reserves
  // room on the right for the overlapping icon; text is TOP-aligned (global
  // rule: padding-top:16px!important, padding-bottom:0!important on the
  // native textarea), not vertically centered, despite how a pill input
  // usually looks — confirmed, not a guess.
  input: {
    flex: 1, maxHeight: 100, minHeight: 40,
    backgroundColor: '#F0F0F0', borderRadius: 52,
    borderWidth: 1, borderColor: '#808080',
    paddingLeft: 16, paddingRight: 44, paddingTop: 16, paddingBottom: 0,
    // Angular: .jodii-chat-textarea/.jodii-chat-textarea-msg both set
    // color:#1f1e1b explicitly (body2-regular-14 itself carries no color).
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.chatNearBlackText,
  },
  // Angular: `.jodii-chat-textarea-msg.jodii-chat-suggestion` — once there's
  // typed text, the pill becomes a rounded RECT (8px radius, not 52), white
  // (not grey), fixed ~72px tall (`.jodii-chat-suggestion{height:9vh}` @ this
  // project's 800px reference height).
  inputTyping: { borderRadius: 8, backgroundColor: '#ffffff', height: 72 },
  // Angular: `.jodii-voice-textarea` — 8px radius, white, distinct padding
  // (10/8/10/8, not the pill's 16/44/16/0).
  inputRecording: {
    borderRadius: 8, backgroundColor: '#fff',
    paddingTop: 10, paddingRight: 8, paddingBottom: 10, paddingLeft: 8,
  },
  // Angular: `.jodii-voice-recorded` — 8px radius, white, fixed 45px height.
  inputRecorded: { borderRadius: 8, backgroundColor: '#fff', height: 45 },
  sendBtn: {
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  // Angular: .jodii-chat-send-img — padding: 12px 9px 12px 13px. Combined
  // with sendIconWidth/Height (which exactly fill what's left of sendBtnSize
  // after this padding), the icon ends up shifted slightly left-and-up of
  // true center rather than dead center, matching Angular exactly.
  sendBtnPadded: { paddingTop: 12, paddingRight: 9, paddingBottom: 12, paddingLeft: 13 },
  sendBtnDisabled: { opacity: 0.5 },
  // Angular: micStatus's `.jodii-chat-mic-img-with-shadow` does NOT swap the
  // button's background — it stays `.jodii-chat-mic-img`'s #B50033
  // (primaryDark) and adds a pulsing halo instead: box-shadow
  // `0 0 0 5px rgba(181,0,51,0.2), 0 0 0 10px rgba(181,0,51,0.1)`. RN has no
  // multi-ring box-shadow equivalent; approximated as a single soft glow in
  // the same color rather than swapping to the unrelated inputError pink/red.
  sendBtnRecording: {
    shadowColor: 'rgba(181,0,51,0.3)', shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1, shadowRadius: 10, elevation: 8,
  },

  recordingRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  recordingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.inputError },
  // Angular: `.delete-block-time` (id="audioTimer") — specialCta-english-
  // Medium at font12, black — not the body-regular family/size this had.
  recordingTimer: { fontFamily: SemanticFontsEnglish.specialCtaEnglishMedium, fontSize: FontSize.font12, color: Colors.black },

  // Angular: reported → `messages-bottom-block.pb-24.pt-24` — white bg,
  // border-top #E6E6E6 (not this app's general divider #f0f0f0), 24/24
  // padding (not pt:20). by_me/by_them use a DIFFERENT class,
  // `.jodii-unblock-chat-msg-restriction-block` (see blockedBannerGrey
  // below) — same border/padding, but a visibly greyer #FAFAFA background.
  // The by_me variant's text→button gap is `mt-16`, not 10 (only matters
  // for that 2-child case; reported/by_them render a single child).
  blockedBanner: {
    alignItems: 'center', justifyContent: 'center', gap: 16,
    paddingTop: 24, paddingHorizontal: 24,
    backgroundColor: Colors.surface,
    // Angular: .jodii-unblock-chat-msg-restriction-block (scss:331-337) —
    // border-top: 1px solid #E6E6E6. Colour already matched; the width was
    // hairlineWidth, unlike inputBar's own 1px for the same #E6E6E6 rule.
    borderTopWidth: 1, borderTopColor: '#E6E6E6',
  },
  // Angular: `.jodii-unblock-chat-msg-restriction-block` (messages.component
  // .scss:331-337) — bg #FAFAFA, distinct from the reported case's white.
  blockedBannerGrey: { backgroundColor: '#FAFAFA' },
  // Angular: shared by REPORTED_PROFILE / OPP_BLOCK_TEXT / BLOCKED_CONTENT —
  // all three are body1-medium-14.color-1f1e1b (font14, Poppins-Medium,
  // #1f1e1b), not textDark.
  blockedText: { fontFamily: Fonts.poppinsMedium, fontSize: FontSize.font14, color: Colors.chatNearBlackText, textAlign: 'center' },
  // Angular: showBottomRestriction()'s own "send-one-msg-block" text is a
  // DIFFERENT source than blockedText above — body2-regular-14.black-color
  // (Poppins-Regular, pure black), not body1-medium-14/#1f1e1b. (Named
  // limitReachedText, not limitBannerText, to avoid shadowing the
  // `limitBannerText` string variable destructured from computeMessageGate().)
  limitReachedText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black, textAlign: 'center' },
  // Angular: the by_me banner's "TAP_HERE" button — buttonSize 'largemedium',
  // [border]="'primaryBorder'", [textColor]="'primaryColor'", no
  // [ctaFontSize]/[fontFamily] so text falls back to body2-regular-14 (Poppins-
  // Regular, font14), BUT `ion-button.largemedium span { font-weight: 500 }`
  // (button-revamp.component.scss:149) overrides that class's own 400.
  tapToUnblock: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, fontWeight: '500',
    // Angular: [textColor]="'primaryColor'" -> --ion-color-primary (#B50033),
    // this app's primaryDark, not the brighter primary red. `.primaryBorder`
    // (:285-287) uses that SAME --ion-color-primary var for its border.
    color: Colors.primaryDark,
    // Angular: setButtonBorder mixin (:33-47) — 1px !important (not 1.5).
    // `ion-button.largemedium { border-radius: 8px }` (:92-95), not 6.
    borderWidth: 1, borderColor: Colors.primaryDark, borderRadius: 8,
    paddingHorizontal: 20, paddingVertical: 10,
  },
  // Angular: CONFIG.SEE_ALL (button.config.ts:165-173) — the messageAllow-false
  // banner's "Explore Matches" button is a DIFFERENT shape from TAP_HERE above,
  // not just a different text color: textColor 'link' (--ion-color-link-color
  // #29339B), border 'noBorder', buttonSize 'link' (auto height, ALL padding
  // 0, span line-height:20 !important, no font-weight override — stays at
  // body2-regular-14's own 400).
  exploreMatchesColor: {
    color: Colors.link, fontWeight: '400', lineHeight: 20,
    borderWidth: 0, paddingHorizontal: 0, paddingVertical: 0,
  },
  // Angular: `iconPosition="end"` — the arrow GIF sits after the label,
  // inline, not stacked or missing.
  exploreMatchesRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  // Angular: `<img style="width: 24px; height: 20px;" src=".../right-arrow-
  // animation.gif">` (button-revamp.component.html:15-17).
  exploreMatchesArrow: { width: 24, height: 20 },

  // Angular: .free-trial-expired (messages.component.scss:945-956) — the real
  // border is a gradient border-image (transparent -> #B50033 -> transparent),
  // approximated here as a flat color, same simplification this file's own
  // send-one-msg-block banner already uses for the identical gradient-border
  // trick. Background gradient likewise approximated to a single vertical
  // fade (the CSS layers two overlapping gradients; the dominant one is a
  // plain top-to-bottom #FFF7F9 -> #FFF).
  blockerBanner: {
    alignItems: 'center', paddingTop: 24, paddingHorizontal: 24,
    borderTopWidth: 1, borderTopColor: Colors.primaryDark,
  },
  blockerBannerTitle: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font18, color: Colors.black, textAlign: 'center',
  },
  blockerBannerSubtitle: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: Colors.black,
    lineHeight: 20, marginTop: 8, textAlign: 'center',
  },
  blockerBannerCta: {
    width: '100%', height: 44, borderRadius: 8, marginTop: 24,
    backgroundColor: Colors.primaryDark, alignItems: 'center', justifyContent: 'center',
  },
  blockerBannerCtaText: {
    fontFamily: Fonts.poppinsSemiBold, fontSize: FontSize.font14, color: Colors.white,
  },

  // Angular: .not-verified-note (messages.component.scss:938-943).
  notVerifiedNote: {
    borderTopWidth: 1, borderTopColor: '#FFCDCD',
    borderBottomWidth: 1, borderBottomColor: '#FFCDCD',
    backgroundColor: '#FFEFEF',
    paddingVertical: 4, paddingHorizontal: 24,
  },
  notVerifiedNoteText: {
    fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font14, color: '#1f1e1b',
    lineHeight: 20,
  },
})
