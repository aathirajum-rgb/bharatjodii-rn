package jodii.app

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.webkit.WebView
import android.widget.ProgressBar
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.razorpay.PaymentData
import com.razorpay.PaymentResultWithDataListener
import com.razorpay.Razorpay
import org.json.JSONObject

// Ported from a sibling Matrimony.com RN project's working Razorpay Custom
// Integration bridge (rn-hybrid's RazorpayWebView.kt), adjusted so cardNumber
// stays a String end-to-end (the original passed it as a Double/Long through
// the JS bridge, which can't exactly represent a 16-digit number — JS numbers
// only have ~15-16 significant decimal digits of precision).
class RazorpayWebView : AppCompatActivity() {

  private var razorpay: Razorpay? = null
  private val TAG = "RazorpayWebView"

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.razorpay_web_view)

    val webProgress = findViewById<ProgressBar>(R.id.webProgress)
    val webView = findViewById<WebView>(R.id.webView)

    val method        = intent.getStringExtra("method") ?: ""
    val amount        = intent.getIntExtra("amount", 0)
    val orderId       = intent.getStringExtra("orderId") ?: ""
    val receiptId     = intent.getStringExtra("receiptId") ?: ""
    val email         = intent.getStringExtra("email") ?: ""
    val contact       = intent.getStringExtra("contact") ?: ""
    val razorpayKey   = intent.getStringExtra("razorpayKey") ?: ""
    val bank          = intent.getStringExtra("bank")
    val upiAppPkg     = intent.getStringExtra("upiAppPackageName")
    val vpa           = intent.getStringExtra("vpa")
    val cardName      = intent.getStringExtra("name")
    val cardNumber    = intent.getStringExtra("cardNumber")
    val expiryMonth   = if (intent.hasExtra("expiryMonth")) intent.getIntExtra("expiryMonth", 0) else null
    val expiryYear    = if (intent.hasExtra("expiryYear")) intent.getIntExtra("expiryYear", 0) else null
    val cvv           = intent.getStringExtra("cvv")
    val recurring     = intent.getBooleanExtra("recurring", false)
    val customerId    = intent.getStringExtra("customerId")

    try {
      razorpay = Razorpay(this, razorpayKey)
      webProgress.visibility = android.view.View.VISIBLE
      webView.visibility = android.view.View.VISIBLE
      razorpay?.setWebView(webView)

      val payload = JSONObject().apply {
        put("method", method)
        put("amount", amount)
        put("currency", "INR")
        put("order_id", orderId)
        put("email", email)
        put("contact", contact)

        when (method) {
          "upi" -> {
            if (!upiAppPkg.isNullOrEmpty()) {
              put("_[flow]", "intent")
              put("upi_app_package_name", upiAppPkg)
            } else if (!vpa.isNullOrEmpty()) {
              put("vpa", vpa)
            } else {
              // Neither a specific app (not installed / not detected) nor a
              // manual VPA was supplied — submitting to Razorpay's SDK with
              // no UPI target at all is not a valid payload and was crashing
              // instead of failing gracefully. Bail out before submit().
              sendResult(false, null, orderId, null, receiptId, "NO_UPI_TARGET", "No UPI app detected on this device and no UPI ID was provided.")
              return
            }
          }
          "card" -> {
            put("_[flow]", "intent")
            put("card[number]", cardNumber)
            put("card[name]", cardName)
            put("card[expiry_month]", expiryMonth)
            put("card[expiry_year]", expiryYear)
            put("card[cvv]", cvv)
          }
          "netbanking" -> {
            if (!bank.isNullOrEmpty()) put("bank", bank)
          }
        }

        if (recurring) {
          put("customer_id", customerId)
          put("recurring", "1")
        }
      }

      razorpay?.submit(payload, object : PaymentResultWithDataListener {
        override fun onPaymentSuccess(razorpayPaymentId: String?, paymentData: PaymentData?) {
          sendResult(true, razorpayPaymentId, paymentData?.orderId, paymentData?.signature, receiptId, null, null)
        }

        override fun onPaymentError(errorCode: Int, error: String?, paymentData: PaymentData?) {
          Log.e(TAG, "Payment error $errorCode: $error")
          sendResult(false, null, orderId, null, receiptId, errorCode.toString(), error)
        }
      })
    } catch (e: Exception) {
      Log.e(TAG, "paymentSubmit failed", e)
      sendResult(false, null, orderId, null, receiptId, "EXCEPTION", e.message)
    }
  }

  private fun sendResult(
    success: Boolean,
    paymentId: String?,
    orderId: String?,
    signature: String?,
    receiptId: String?,
    errorCode: String?,
    errorMessage: String?,
  ) {
    val params: WritableMap = Arguments.createMap().apply {
      putBoolean("success", success)
      putString("paymentId", paymentId)
      putString("orderId", orderId)
      putString("signature", signature)
      putString("receiptId", receiptId)
      putString("errorCode", errorCode)
      putString("errorMessage", errorMessage)
    }
    try {
      RazorpayBridgeModule.sharedReactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(if (success) "RazorpayPaymentSuccess" else "RazorpayPaymentFailure", params)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to emit payment result event", e)
    }
    finish()
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    if (keyCode == KeyEvent.KEYCODE_BACK) {
      try {
        RazorpayBridgeModule.sharedReactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("RazorpayBackPressed", Arguments.createMap())
      } catch (e: Exception) {
        Log.e(TAG, "Failed to emit back-pressed event", e)
      }
      finish()
      return true
    }
    return super.onKeyDown(keyCode, event)
  }
}
