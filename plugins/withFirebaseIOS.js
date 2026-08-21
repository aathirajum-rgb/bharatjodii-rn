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

module.exports = function withFirebaseIOS(config) {
  return withDangerousMod(config, [
    'ios',
    modConfig => {
      const podfilePath = path.join(modConfig.modRequest.platformProjectRoot, 'Podfile');
      const contents = fs.readFileSync(podfilePath, 'utf8');
      if (!contents.includes(FLAG_LINE)) {
        fs.writeFileSync(podfilePath, `${FLAG_LINE}\n\n${contents}`);
      }
      return modConfig;
    },
  ]);
};
