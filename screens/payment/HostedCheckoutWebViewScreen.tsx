// Angular: pages/recharge/{netbanking,pay-using-credit-debit,upi-payment}.page.ts
// "paymentcheckout" bridge event → Android PaymentWebviewActivity.java —
// nbpaymentcheckout is a hosted-webview endpoint for Netbanking, Card, and
// manually-typed-VPA UPI (NOT a JSON order-creation API like the native
// Razorpay SDK path uses for app-targeted UPI intent). The old app POSTed a
// form body straight into a WebView, rendered whatever HTML came back (a
// bank/card hosted page), and waited for that page's own JS to call back
// into a bridge shaped {"event_name":"payment_status","status":...,
// "message":...}. Reproduced here: an injected script defines
// window.onWebAppsClick before the page's own scripts run, forwarding the
// same call through react-native-webview's onMessage.

import { useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Alert, BackHandler, StyleSheet, Text, View } from 'react-native'
import { WebView, type WebViewMessageEvent } from 'react-native-webview'
import type {
  ShouldStartLoadRequest, WebViewErrorEvent, WebViewHttpErrorEvent, WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes'
import { Colors } from '../../constants/colors'
import ScreenTopInset from '../../components/screen/ScreenTopInset'
import { SemanticFontsEnglish, FontSize } from '../../src/theme/fonts'
import { EnvConfig } from '../../constants/env'
import {
  getHostedCheckoutRequest, handlePaymentSuccess, recordPaymentFailure,
  type SelectedPackage,
} from '../../service/paymentService'
import { handleBack } from '../../utils/navigationRef'

// Defined before the hosted page's own <script> tags execute — matches
// Android's addJavascriptInterface(new WebAppEvents(), "onWebAppsClick").
const BRIDGE_SCRIPT = `
  window.onWebAppsClick = {
    onResponse: function (response) {
      window.ReactNativeWebView.postMessage(response);
    }
  };
  true;
`

// Only jodii's own payment hosts and Razorpay (the hosted-checkout processor
// for this payment group — see the redirect-chain comment on
// handleNavStateChange below) should ever be trusted to report a payment
// outcome or receive navigation. Blocks a compromised/injected script
// anywhere in that chain from forging a "success" postMessage, and blocks
// navigation being hijacked to an arbitrary intent://, market://, or other
// non-http(s) scheme — neither of which this flow ever legitimately needs.
function getTrustedHostnames(): string[] {
  const hosts = [EnvConfig.api, EnvConfig.paymentNg, EnvConfig.payment]
    .map(u => { try { return new URL(u).hostname } catch { return null } })
    .filter((h): h is string => !!h)
  return [...new Set(hosts)]
}

function isTrustedOrigin(url: string): boolean {
  try {
    const { hostname, protocol } = new URL(url)
    if (protocol !== 'https:') return false
    if (hostname === 'razorpay.com' || hostname.endsWith('.razorpay.com')) return true
    return getTrustedHostnames().some(h => hostname === h || hostname.endsWith(`.${h}`))
  } catch {
    return false
  }
}

type Props = {
  navigation: any
  route: {
    params?: {
      selectedPackage: SelectedPackage
      amountLabel?:    string
      method:          'netbanking' | 'card' | 'upi'
      bank?:           string
      card?:           { number: string; expiryMonth: string; expiryYear: string; cvv: string }
      amount:          number
      retryRoute:      string
      retryParams?:    any
    }
  }
}

export default function HostedCheckoutWebViewScreen({ navigation, route }: Props) {
  // route.params is undefined if this screen is ever reached with no
  // navigation state (e.g. a future deep link) — there's no safe fallback
  // package/amount to substitute, so the load effect below bails out to the
  // same "couldn't start payment" path used when the checkout request itself
  // fails, instead of crashing on selectedPackage.PACKAGEID.
  const { selectedPackage, amountLabel, method, bank, card, amount, retryRoute, retryParams } =
    route.params ?? {} as Partial<NonNullable<Props['route']['params']>>

  const [request, setRequest] = useState<{ uri: string; body: string } | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const settledRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    if (!selectedPackage || !method || amount == null) {
      Alert.alert('Error', 'Could not start payment. Please try again.')
      handleBack()
      return
    }
    getHostedCheckoutRequest(selectedPackage.PACKAGEID, amount, method, bank, card).then(req => {
      if (cancelled) return
      if (!req) {
        Alert.alert('Error', 'Could not start payment. Please try again.')
        handleBack()
        return
      }
      setRequest(req)
    })
    return () => { cancelled = true }
  }, [])

  // Hardware back during the hosted page — same "user cancelled, not a
  // failure" treatment as the native Razorpay/PayU bridges' back-press.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!settledRef.current) {
        settledRef.current = true
        handleBack()
      }
      return true
    })
    return () => sub.remove()
  }, [])

  async function settleFailure(reason?: string) {
    if (settledRef.current) return
    settledRef.current = true
    await recordPaymentFailure(null, selectedPackage, {
      status: 'failure', reason, retryRoute, retryParams,
    })
    navigation.replace('payment-failed', {
      selectedPackage, amountLabel, status: 'failure', reason,
      retryRoute, retryParams,
    })
  }

  async function handleBridgeMessage(event: WebViewMessageEvent) {
    if (settledRef.current) return
    // Reject a bridge message posted from anywhere other than jodii's own
    // payment pages or Razorpay's hosted checkout — the only origins that
    // should ever be able to report a payment outcome here.
    if (!isTrustedOrigin(event.nativeEvent.url)) return
    let data: any
    try {
      data = JSON.parse(event.nativeEvent.data)
    } catch {
      return
    }

    // Mirrors PaymentWebviewActivity.WebAppEvents.onResponse()'s switch —
    // "payment_status"/"payment_status_time" both carry the outcome,
    // "PageClose" is the hosted page's own dismiss action.
    if (data.event_name === 'payment_status' || data.event_name === 'payment_status_time') {
      settledRef.current = true
      const status = String(data.status ?? '').toLowerCase()
      if (status === 'success') {
        await handlePaymentSuccess()
      } else {
        await settleFailure(data.message)
      }
    } else if (data.event_name === 'PageClose') {
      settledRef.current = true
      handleBack()
    }
  }

  // NOTE: onMessage/BRIDGE_SCRIPT is the real completion path — a hosted
  // page that fails to load entirely (blocked by the bank's anti-embedding
  // checks, mixed-content, wrong response) currently has no fallback here
  // and leaves the user on the loading overlay indefinitely. Out of scope
  // for this cleanup pass; flagged for a follow-up rather than silently left
  // as dead debug logging.
  function handleLoadError(_event: WebViewErrorEvent) {}
  function handleHttpError(_event: WebViewHttpErrorEvent) {}

  // Bank/gateway redirects (netbanking OTP pages, card 3DS, UPI VPA
  // verification) can land on virtually any bank's own https domain, so this
  // can't be a host allowlist — only the scheme is restricted, blocking a
  // hijack to intent://, market://, or other non-http(s) schemes that this
  // flow never legitimately needs.
  function handleShouldStartLoad(request: ShouldStartLoadRequest): boolean {
    try {
      return new URL(request.url).protocol === 'https:'
    } catch {
      return false
    }
  }
  async function handleNavStateChange(nav: WebViewNavigation) {
    if (settledRef.current) return

    // Fallback outcome detection — confirmed via a real device trace that
    // the bridge script (window.onWebAppsClick, injected via
    // injectedJavaScriptBeforeContentLoaded) doesn't reliably survive this
    // many cross-origin hops (jodii.app → razorpay.com → jodii.app again),
    // leaving the WebView stuck on a blank final page with no callback ever
    // firing. Razorpay's own callback redirect already carries the outcome
    // directly in its URL (?status=failed / ?status=captured), so read it
    // from there instead of waiting on the page's own JS.
    if (nav.url.includes('razorpay.com') && nav.url.includes('/callback/')) {
      const match = nav.url.match(/[?&]status=([^&]*)/)
      const status = match ? decodeURIComponent(match[1]).toLowerCase() : ''
      if (status) {
        settledRef.current = true
        if (status === 'success' || status === 'captured') {
          await handlePaymentSuccess()
        } else {
          await settleFailure(`Payment ${status}`)
        }
      }
    }
  }

  if (!request) {
    return (
      <View style={[s.screen, s.centered]}>
        <ScreenTopInset style={s.topInset} />
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  return (
    <View style={s.screen}>
      <ScreenTopInset />
      <WebView
        source={{ uri: request.uri, method: 'POST', body: request.body }}
        injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
        onMessage={handleBridgeMessage}
        onLoadStart={() => setPageLoading(true)}
        onLoadEnd={() => setPageLoading(false)}
        onError={handleLoadError}
        onHttpError={handleHttpError}
        onNavigationStateChange={handleNavStateChange}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        style={s.webview}
      />
      {pageLoading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator color={Colors.primaryDark} size="large" />
          <Text style={s.loadingText}>Loading payment page…</Text>
        </View>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: Colors.white },
  centered: { alignItems: 'center', justifyContent: 'center' },
  // Absolute so the strip doesn't add to the flex layout and shift the
  // spinner off dead-center — `centered`'s own justifyContent:'center' must
  // keep centering exactly as before.
  topInset: { position: 'absolute', top: 0, left: 0, right: 0 },
  webview:  { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, gap: 12,
  },
  loadingText: { fontFamily: SemanticFontsEnglish.bodyEnglishRegular, fontSize: FontSize.font13, color: Colors.textSecondary },
})
