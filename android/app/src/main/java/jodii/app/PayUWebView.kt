package jodii.app

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import androidx.appcompat.app.AppCompatActivity
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.payu.paymentparamhelper.siparams.SIParams
import com.payu.paymentparamhelper.siparams.SIParamsDetails
import com.payu.paymentparamhelper.siparams.enums.BillingCycle
import com.payu.paymentparamhelper.siparams.enums.BillingLimit
import com.payu.paymentparamhelper.siparams.enums.BillingRule
import com.payu.upisdk.Upi
import com.payu.upisdk.bean.UpiConfig
import com.payu.upisdk.callbacks.PayUUPICallback
import com.payu.upisdk.generatepostdata.PaymentParamsUpiSdk
import com.payu.upisdk.generatepostdata.PostDataGenerate

// Ported from jodii android project's UPIWebviewActivity.java —
// startPayUPayment() + PayUUPICallback (lines 423-524). All merchant
// credentials (key, hash, txnId, bank code, SI eligibility/details) come from
// the backend's own order-creation response — see paymentService.ts
// initPayUNative() — nothing PayU-specific is configured natively.
class PayUWebView : AppCompatActivity() {

  private val TAG = "PayUWebView"
  private var txnId: String = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    setContentView(R.layout.payu_web_view)

    val merchantKey  = intent.getStringExtra("merchantKey") ?: ""
    txnId            = intent.getStringExtra("txnId") ?: ""
    val productInfo  = intent.getStringExtra("productInfo") ?: ""
    val firstName    = intent.getStringExtra("firstName") ?: ""
    val email        = intent.getStringExtra("email") ?: ""
    val amount       = intent.getStringExtra("amount") ?: ""
    val phone        = intent.getStringExtra("phone") ?: ""
    val surl         = intent.getStringExtra("surl") ?: ""
    val furl         = intent.getStringExtra("furl") ?: ""
    val hash         = intent.getStringExtra("hash") ?: ""
    val bankcode     = intent.getStringExtra("bankcode") ?: ""
    val upiAppPkg    = intent.getStringExtra("upiAppPackageName")

    Log.d(TAG, "onCreate: merchantKey=$merchantKey txnId=$txnId bankcode=$bankcode upiAppPkg=$upiAppPkg " +
      "amount=$amount hasHash=${hash.isNotEmpty()} si=${intent.getBooleanExtra("si", false)}")

    try {
      val paymentParams = PaymentParamsUpiSdk()
      paymentParams.setKey(merchantKey)
      paymentParams.setProductInfo(productInfo)
      paymentParams.setFirstName(firstName)
      paymentParams.setEmail(email)
      paymentParams.setTxnId(txnId)
      paymentParams.setAmount(amount)
      paymentParams.setSurl(surl)
      paymentParams.setFurl(furl)
      paymentParams.setUdf1("")
      paymentParams.setUdf2("")
      paymentParams.setUdf3("")
      paymentParams.setUdf4("")
      paymentParams.setUdf5("")
      paymentParams.setUserCredentials("default")
      paymentParams.setPhone(phone)
      paymentParams.setHash(hash)
      Log.d(TAG, "paymentParams built OK")

      if (intent.getBooleanExtra("si", false)) {
        val siDetails = SIParamsDetails()
        siDetails.setBillingAmount(intent.getStringExtra("siBillingAmount") ?: "")
        siDetails.setBillingCurrency(intent.getStringExtra("siBillingCurrency") ?: "")
        siDetails.setBillingCycle(billingCycleFrom(intent.getStringExtra("siBillingCycle")))
        siDetails.setPaymentStartDate(intent.getStringExtra("siPaymentStartDate") ?: "")
        siDetails.setPaymentEndDate(intent.getStringExtra("siPaymentEndDate") ?: "")
        siDetails.setBillingInterval(intent.getIntExtra("siBillingInterval", 1))
        siDetails.setBillingLimit(BillingLimit.ON)
        siDetails.setBillingRule(BillingRule.EXACT)

        val siParams = SIParams()
        siParams.setFree_trial(false)
        siParams.setSi_details(siDetails)
        paymentParams.setSiParams(siParams)
        Log.d(TAG, "siParams attached OK")
      }

      val postData = PostDataGenerate.PostDataBuilder(this)
        .setPaymentMode(bankcode)
        .setPaymentParamUpiSdk(paymentParams)
        .build()
        .toString()
      Log.d(TAG, "postData built OK, length=${postData.length}")

      val upiConfig = UpiConfig()
      upiConfig.setMerchantKey(merchantKey)
      upiConfig.setPayuPostData(postData)
      upiConfig.setPostUrl("https://secure.payu.in/_payment")
      if (!upiAppPkg.isNullOrEmpty()) upiConfig.setPackageNameForSpecificApp(upiAppPkg)
      Log.d(TAG, "upiConfig built OK, calling Upi.getInstance().makePayment")

      Upi.getInstance().makePayment(callback, this, upiConfig)
      Log.d(TAG, "makePayment call returned (async — waiting on callback)")
    } catch (e: Throwable) {
      // Throwable (not just Exception) — a NoSuchMethodError/NoClassDefFoundError
      // from R8/ProGuard stripping a PayU SDK class in the release build would
      // otherwise bypass a plain `catch (e: Exception)` and crash the whole app.
      Log.e(TAG, "PayU payment submit failed: ${e.javaClass.name}: ${e.message}", e)
      sendResult(false, null, "EXCEPTION", "${e.javaClass.simpleName}: ${e.message}")
    }
  }

  private fun billingCycleFrom(value: String?): BillingCycle {
    return when (value?.lowercase()) {
      "yearly"  -> BillingCycle.YEARLY
      "monthly" -> BillingCycle.MONTHLY
      "weekly"  -> BillingCycle.WEEKLY
      "daily"   -> BillingCycle.DAILY
      "adhoc"   -> BillingCycle.ADHOC
      else      -> BillingCycle.ONCE
    }
  }

  private val callback = object : PayUUPICallback() {
    override fun onPaymentSuccess(payuResult: String?, merchantResponse: String?) {
      super.onPaymentSuccess(payuResult, merchantResponse)
      sendResult(true, payuResult, null, null)
    }

    override fun onPaymentFailure(payuResult: String?, merchantResponse: String?) {
      super.onPaymentFailure(payuResult, merchantResponse)
      Log.d(TAG, "PayU payment failure: $payuResult")
      sendResult(false, payuResult, "PAYMENT_FAILURE", null)
    }

    override fun onUpiErrorReceived(code: Int, errormsg: String?) {
      super.onUpiErrorReceived(code, errormsg)
      Log.d(TAG, "PayU UPI error $code: $errormsg")
      sendResult(false, null, code.toString(), errormsg)
    }
  }

  private fun sendResult(success: Boolean, payuResult: String?, errorCode: String?, errorMessage: String?) {
    val params: WritableMap = Arguments.createMap().apply {
      putBoolean("success", success)
      putString("txnId", txnId)
      putString("payuResult", payuResult)
      putString("errorCode", errorCode)
      putString("errorMessage", errorMessage)
    }
    try {
      PayUBridgeModule.sharedReactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit(if (success) "PayUPaymentSuccess" else "PayUPaymentFailure", params)
    } catch (e: Exception) {
      Log.e(TAG, "Failed to emit PayU payment result event", e)
    }
    finish()
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent): Boolean {
    if (keyCode == KeyEvent.KEYCODE_BACK) {
      try {
        PayUBridgeModule.sharedReactContext
          .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
          .emit("PayUBackPressed", Arguments.createMap())
      } catch (e: Exception) {
        Log.e(TAG, "Failed to emit back-pressed event", e)
      }
      finish()
      return true
    }
    return super.onKeyDown(keyCode, event)
  }
}
