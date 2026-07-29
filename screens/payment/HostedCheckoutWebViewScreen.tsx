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
  WebViewErrorEvent, WebViewHttpErrorEvent, WebViewNavigation,
} from 'react-native-webview/lib/WebViewTypes'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Colors } from '../../constants/colors'
import {
  getHostedCheckoutRequest, handlePaymentSuccess, recordPaymentFailure,
  type SelectedPackage,
} from '../../service/paymentService'

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

// Diagnostics only — reports what actually rendered, in case the hosted
// page never calls the bridge at all (e.g. an empty/error response body).
const DEBUG_BODY_DUMP_SCRIPT = `
  window.ReactNativeWebView.postMessage(JSON.stringify({
    event_name: 'DBG_BODY_DUMP',
    length: document.body ? document.body.innerHTML.length : -1,
    snippet: document.body ? document.body.innerHTML.slice(0, 500) : '(no body)',
  }));
  true;
`

type Props = {
  navigation: any
  route: {
    params: {
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
  const insets = useSafeAreaInsets()
  const { selectedPackage, amountLabel, method, bank, card, amount, retryRoute, retryParams } = route.params

  const [request, setRequest] = useState<{ uri: string; body: string } | null>(null)
  const [pageLoading, setPageLoading] = useState(true)
  const settledRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    getHostedCheckoutRequest(selectedPackage.PACKAGEID, amount, method, bank, card).then(req => {
      if (cancelled) return
      if (!req) {
        Alert.alert('Error', 'Could not start payment. Please try again.')
        navigation.goBack()
        return
      }
      // Diagnostics only — bypasses the WebView entirely to see the exact
      // raw response (status/content-type/body) independent of whether the
      // WebView can render it as HTML at all.
      fetch(req.uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: req.body,
      }).then(async res => {
        const text = await res.text()
        console.error('DBG_HOSTED_CHECKOUT_RAW_FETCH', method, res.status,
          JSON.stringify(Object.fromEntries(res.headers.entries())), text.slice(0, 800))
      }).catch(err => {
        console.error('DBG_HOSTED_CHECKOUT_RAW_FETCH_ERR', method, err?.message)
      })
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
        navigation.goBack()
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
    console.error('DBG_HOSTED_CHECKOUT_BRIDGE', method, event.nativeEvent.data)
    if (settledRef.current) return
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
      navigation.goBack()
    }
  }

  // Diagnostics only — onMessage/BRIDGE_SCRIPT is the real completion path.
  // Without these, a hosted page that fails to load (blocked by the bank's
  // anti-embedding checks, mixed-content, wrong response) shows "processing"
  // then a blank WebView with nothing logged anywhere.
  function handleLoadError(event: WebViewErrorEvent) {
    console.error('DBG_HOSTED_CHECKOUT_LOAD_ERROR', method, JSON.stringify(event.nativeEvent))
  }
  function handleHttpError(event: WebViewHttpErrorEvent) {
    console.error('DBG_HOSTED_CHECKOUT_HTTP_ERROR', method, JSON.stringify(event.nativeEvent))
  }
  async function handleNavStateChange(nav: WebViewNavigation) {
    console.error('DBG_HOSTED_CHECKOUT_NAV', method, JSON.stringify({
      url: nav.url, loading: nav.loading, title: nav.title,
    }))
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
      <View style={[s.screen, s.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={Colors.primaryDark} size="large" />
      </View>
    )
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top }]}>
      <WebView
        source={{ uri: request.uri, method: 'POST', body: request.body }}
        injectedJavaScriptBeforeContentLoaded={BRIDGE_SCRIPT}
        injectedJavaScript={DEBUG_BODY_DUMP_SCRIPT}
        onMessage={handleBridgeMessage}
        onLoadStart={() => setPageLoading(true)}
        onLoadEnd={() => setPageLoading(false)}
        onError={handleLoadError}
        onHttpError={handleHttpError}
        onNavigationStateChange={handleNavStateChange}
        mixedContentMode="always"
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
  webview:  { flex: 1 },
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.white, gap: 12,
  },
  loadingText: { fontFamily: 'Poppins-Regular', fontSize: 13, color: Colors.textSecondary },
})
