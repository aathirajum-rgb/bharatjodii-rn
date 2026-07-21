module.exports = {
  dependencies: {
    // react-native-razorpay's Android module depends on com.razorpay:checkout,
    // which cannot coexist with com.razorpay:customui (duplicate classes —
    // see android/app/build.gradle). We use a custom native bridge on Android
    // (RazorpayBridgeModule/RazorpayWebView, built on customui) instead, but
    // keep react-native-razorpay for iOS, where no such conflict exists.
    'react-native-razorpay': {
      platforms: {
        android: null,
      },
    },
  },
}
