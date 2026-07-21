package jodii.app

import android.content.Intent
import android.util.Log
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

// Ported from a sibling Matrimony.com RN project's working Razorpay Custom
// Integration bridge (rn-hybrid), adapted to this project's package name and
// REST (not GraphQL) checkout API. See RazorpayWebView.kt for the actual
// payment submission — this module only launches that Activity and exposes
// getAppsWhichSupportUpi() (real installed-UPI-app detection with package
// names, e.g. Google Pay's com.google.android.apps.nbu.paisa.user) so the JS
// side can target a specific app instead of Razorpay's own generic picker.
class RazorpayBridgeModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val TAG = "RazorpayBridge"

  override fun getName(): String = "RazorpayBridge"

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

    val intent = Intent(activity, RazorpayWebView::class.java).apply {
      putExtra("amount", options.getInt("amount"))
      putExtra("orderId", options.getString("orderId"))
      putExtra("receiptId", options.getString("receiptId"))
      putExtra("email", options.getString("email"))
      putExtra("contact", options.getString("contact"))
      putExtra("method", options.getString("method"))
      putExtra("razorpayKey", options.getString("razorpayKey"))

      if (options.hasKey("bank")) putExtra("bank", options.getString("bank"))
      if (options.hasKey("upiAppPackageName")) putExtra("upiAppPackageName", options.getString("upiAppPackageName"))
      if (options.hasKey("vpa")) putExtra("vpa", options.getString("vpa"))
      if (options.hasKey("name")) putExtra("name", options.getString("name"))
      if (options.hasKey("cardNumber")) putExtra("cardNumber", options.getString("cardNumber"))
      if (options.hasKey("expiryMonth")) putExtra("expiryMonth", options.getInt("expiryMonth"))
      if (options.hasKey("expiryYear")) putExtra("expiryYear", options.getInt("expiryYear"))
      if (options.hasKey("cvv")) putExtra("cvv", options.getString("cvv"))
      if (options.hasKey("recurring")) putExtra("recurring", options.getBoolean("recurring"))
      if (options.hasKey("customerId")) putExtra("customerId", options.getString("customerId"))
    }

    activity.startActivity(intent)
  }

  @ReactMethod
  fun getAppsWhichSupportUpi() {
    com.razorpay.Razorpay.getAppsWhichSupportUpi(reactContext) { list ->
      try {
        val array = Arguments.createArray()
        for (appData in list) {
          val appObject = Arguments.createMap()
          appObject.putString("appName", appData.appName)
          appObject.putString("packageName", appData.packageName)
          array.pushMap(appObject)
        }
        val result = Arguments.createMap()
        result.putArray("apps", array)
        sendEvent("RazorpayUpiApps", result)
      } catch (e: Exception) {
        Log.e(TAG, "getAppsWhichSupportUpi failed", e)
        sendEvent("RazorpayUpiApps", Arguments.createMap().apply { putArray("apps", Arguments.createArray()) })
      }
    }
  }

  private fun sendEvent(eventName: String, params: WritableMap) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, params)
  }
}
