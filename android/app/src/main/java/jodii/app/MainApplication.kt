package jodii.app

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
// @generated begin razorpay-bridge-package - expo prebuild (DO NOT MODIFY) sync-52858cbdb1ea211a14c8a464b963d73936d700a7
          add(RazorpayBridgePackage())
// @generated end razorpay-bridge-package
// @generated begin payu-bridge-package - expo prebuild (DO NOT MODIFY) sync-0fba1f13108bb05c6787f41e1a779dcdf4de5c16
          add(PayUBridgePackage())
// @generated end payu-bridge-package
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        }
    )
  }

  override fun onCreate() {
    super.onCreate()
    installSplashScreenTransferCrashRecovery()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }

  // Documented AOSP platform race in the OS's OWN splash-screen transfer
  // machinery (android.app.ActivityThread.syncTransferSplashscreenViewTransaction
  // -> SurfaceControl.checkNotReleased()), hit reproducibly on this app when
  // backgrounding (HOME) and immediately reopening while the native splash
  // handoff is still in flight. Reported against the same AOSP codepath across
  // several unrelated frameworks with no app-level fix available — Flutter
  // #125122, react-native-bootsplash #381, Capacitor splash-screen #1856, and
  // Google's own tracker https://issuetracker.google.com/issues/242118185.
  // expo-splash-screen's SplashScreenManager.kt already applies Google's
  // documented mitigation (clearing its own exit-animation listener on
  // onActivityStopped) for API 31-33, but that only cancels OUR androidx-level
  // listener — it can't retract a transfer the framework already queued at the
  // OS level before backgrounding, which is exactly what this variant hits.
  // The exception is thrown from framework code on the main thread, so it
  // can't be try/caught from app code at its source. Rather than let this one
  // precisely-identified, harmless NPE (the splash view is being torn down
  // either way) drop the user out to the home screen looking like a real
  // crash, recognize it exactly and recover by relaunching instead. Every
  // other exception is untouched and still crashes normally.
  private fun installSplashScreenTransferCrashRecovery() {
    val previousHandler = Thread.getDefaultUncaughtExceptionHandler()
    Thread.setDefaultUncaughtExceptionHandler { thread, throwable ->
      if (isSplashScreenTransferRace(throwable)) {
        android.util.Log.w(
          "MainApplication",
          "Recovering from known AOSP splash-screen transfer race by relaunching",
          throwable
        )
        val relaunch = packageManager.getLaunchIntentForPackage(packageName)
        relaunch?.addFlags(
          android.content.Intent.FLAG_ACTIVITY_NEW_TASK or
            android.content.Intent.FLAG_ACTIVITY_CLEAR_TASK
        )
        if (relaunch != null) startActivity(relaunch)
        android.os.Process.killProcess(android.os.Process.myPid())
        return@setDefaultUncaughtExceptionHandler
      }
      previousHandler?.uncaughtException(thread, throwable)
    }
  }

  private fun isSplashScreenTransferRace(t: Throwable): Boolean =
    t is NullPointerException &&
      t.message?.contains("SurfaceControl.checkNotReleased") == true &&
      t.stackTrace.any { it.methodName == "syncTransferSplashscreenViewTransaction" }
}
