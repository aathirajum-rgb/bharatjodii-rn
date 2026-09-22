// Re-applies the RNFirebaseDisableSPM Podfile flag on every prebuild. Without
// it, `expo prebuild --clean` regenerates ios/ from scratch and drops this
// line — react-native-firebase then resolves Firebase via Swift Package
// Manager again, and each RNFB pod embeds its own copy of the (non-dynamic)
// firebase-ios-sdk Swift Package products, colliding at link time with
// "duplicate symbol" errors during `pod install`/build. This project already
// pulls Firebase in via classic CocoaPods (the explicit `pod 'FirebaseCore'...`
// lines in ios/Podfile), so opting RNFB out of its own SPM resolution is the
// fix CocoaPods' own error message recommends, not a switch to dynamic
// frameworks (which would be a much bigger, riskier change for the other
// native bridges in this project).
const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const FLAG_LINE = "$RNFirebaseDisableSPM = true";

// Without this, `pod install` fails on a fresh prebuild with: "The Swift pod
// `FirebaseCoreInternal` depends upon `GoogleUtilities`, which does not
// define modules" — this project builds as static libraries (no
// use_frameworks!, see the comment above), and CocoaPods needs modular
// headers explicitly opted into for Swift pods to import plain-C pods like
// GoogleUtilities under that mode. Global `use_modular_headers!` (CocoaPods'
// own suggested fix) rather than scoping it to just GoogleUtilities/Firebase,
// since other Swift pods in this dependency tree could hit the same issue.
const MODULAR_HEADERS_LINE = 'use_modular_headers!';

module.exports = function withFirebaseIOS(config) {
  return withDangerousMod(config, [
    'ios',
    modConfig => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      let contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes(FLAG_LINE)) {
        contents = `${FLAG_LINE}\n\n${contents}`;
      }
      if (!contents.includes(MODULAR_HEADERS_LINE)) {
        contents = `${MODULAR_HEADERS_LINE}\n\n${contents}`;
      }
      fs.writeFileSync(podfilePath, contents);
      return modConfig;
    },
  ]);
};
