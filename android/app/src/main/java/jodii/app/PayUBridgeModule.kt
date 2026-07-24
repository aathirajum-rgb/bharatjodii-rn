package jodii.app

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*

// PayU is a silent, account-wide substitute for the Razorpay UPI flow — see
// paymentService.ts initPayUNative(). The old Android app chose Razorpay vs
// PayU per-account via PAYCONFIG.PAYSOURCE ('1' = Razorpay, '2' = PayU), with
// no user-visible difference; this bridge exists purely so that substitution
// still works from React Native. Ported from UPIWebviewActivity.java's
// startPayUPayment()/PayUUPICallback (jodii android project).
class PayUBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val TAG = "PayUBridge"

  override fun getName(): String = "PayUBridge"

  companion object {
    lateinit var sharedReactContext: ReactApplicationContext
  }

  init {
    sharedReactContext = reactContext
  }

  @ReactMethod
  fun openCheckout(options: ReadableMap) {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      Log.e(TAG, "No current activity found — cannot open checkout")
      return
    }

    val intent = Intent(activity, PayUWebView::class.java).apply {
      putExtra("merchantKey", options.getString("merchantKey"))
      putExtra("txnId", options.getString("txnId"))
      putExtra("productInfo", options.getString("productInfo"))
      putExtra("firstName", options.getString("firstName"))
      putExtra("email", options.getString("email"))
      putExtra("amount", options.getString("amount"))
      putExtra("phone", options.getString("phone"))
      putExtra("surl", options.getString("surl"))
      putExtra("furl", options.getString("furl"))
      putExtra("hash", options.getString("hash"))
      putExtra("bankcode", options.getString("bankcode"))

      if (options.hasKey("upiAppPackageName")) putExtra("upiAppPackageName", options.getString("upiAppPackageName"))

      // Standing Instructions — only attached when the order-creation response
      // marked this order as recurring (si == 1). Mirrors getSiParamsDetails().
      if (options.hasKey("si") && options.getBoolean("si")) {
        putExtra("si", true)
        putExtra("siBillingAmount", options.getString("siBillingAmount"))
        putExtra("siBillingCurrency", options.getString("siBillingCurrency"))
        putExtra("siBillingCycle", options.getString("siBillingCycle"))
        putExtra("siBillingInterval", options.getInt("siBillingInterval"))
        putExtra("siPaymentStartDate", options.getString("siPaymentStartDate"))
        putExtra("siPaymentEndDate", options.getString("siPaymentEndDate"))
      }
    }

    activity.startActivity(intent)
  }
}
