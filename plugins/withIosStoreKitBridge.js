// Injects the custom StoreKit IAP bridge (Inapppurchase.swift/
// InAppPurchaseManagerBridge.h+.m, IAPEventEmitter.swift/.h+.m — see
// service/iapService.ts) into the iOS project on every prebuild. Mirrors
// plugins/withRazorpayAndroidBridge.js's approach on Android: without this
// plugin, `expo prebuild --clean` regenerates ios/ from scratch and drops
// these files, the PBXGroup/PBXSourcesBuildPhase entries, and the StoreKit
// framework link — breaking iOS payments with no build error.
//
// Ported from the luv-rn app's ios/Features/Auth/In-app/ (raw SKPaymentQueue/
// SKProductsRequest module, not react-native-iap). That app's Xcode project
// uses Xcode 16+ PBXFileSystemSynchronizedRootGroup folders, which pick up
// new files automatically just by existing on disk. This app's project.pbxproj
// is the classic file-list kind (confirmed: 0 PBXFileSystemSynchronizedRootGroup
// occurrences), so new files must be registered explicitly via the `xcode`
// library — done here through @expo/config-plugins' IOSConfig.XcodeUtils
// helpers rather than hand-editing project.pbxproj text.
const { withDangerousMod, withXcodeProject, IOSConfig } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, 'ios-native-src', 'inapppurchase');
const GROUP_NAME = 'InApp';
const FILES = [
  'Inapppurchase.swift',
  'InAppPurchaseManagerBridge.h',
  'InAppPurchaseManagerBridge.m',
  'IAPEventEmitter.swift',
  'IAPEventEmitter.h',
  'IAPEventEmitter.m',
];
const HEADER_FILES = new Set(['InAppPurchaseManagerBridge.h', 'IAPEventEmitter.h']);

function copyNativeSources(projectRoot) {
  const projectName = IOSConfig.XcodeUtils.getProjectName(projectRoot);
  const destDir = path.join(projectRoot, 'ios', projectName, GROUP_NAME);
  fs.mkdirSync(destDir, { recursive: true });
  for (const file of FILES) {
    fs.copyFileSync(path.join(SRC_DIR, file), path.join(destDir, file));
  }
}

module.exports = function withIosStoreKitBridge(config) {
  config = withDangerousMod(config, [
    'ios',
    modConfig => {
      copyNativeSources(modConfig.modRequest.projectRoot);
      return modConfig;
    },
  ]);

  config = withXcodeProject(config, modConfig => {
    const project = modConfig.modResults;
    const projectName = IOSConfig.XcodeUtils.getProjectName(modConfig.modRequest.projectRoot);
    const groupPath = `${projectName}/${GROUP_NAME}`;

    IOSConfig.XcodeUtils.ensureGroupRecursively(project, groupPath);
    const { uuid: targetUuid } = IOSConfig.XcodeUtils.getApplicationNativeTarget({ project, projectName });

    for (const file of FILES) {
      const filepath = `${groupPath}/${file}`;
      if (HEADER_FILES.has(file)) {
        // Headers are added as file references only (no PBXBuildFile/Sources
        // membership) — RCT_EXTERN_MODULE's .m files don't #import them, and
        // Obj-C headers exposing a UIViewController subclass compile nothing
        // on their own.
        IOSConfig.XcodeUtils.addResourceFileToGroup({
          filepath,
          groupName: groupPath,
          isBuildFile: false,
          project,
          targetUuid,
        });
      } else {
        IOSConfig.XcodeUtils.addBuildSourceFileToGroup({
          filepath,
          groupName: groupPath,
          project,
          targetUuid,
        });
      }
    }

    // Required for SKPaymentQueue/SKProductsRequest — confirmed by the luv-rn
    // reference app's own project.pbxproj, which links this explicitly rather
    // than relying on implicit/auto-linking.
    IOSConfig.XcodeUtils.addFramework({ project, projectName, framework: 'StoreKit.framework' });

    return modConfig;
  });

  return config;
};
