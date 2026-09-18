//
//  IAPEventEmitter.m
//  jodii
//
//  Exposes the Swift IAPEventEmitter class to JS as NativeModules.IAPEventEmitter
//  (consumed via NativeEventEmitter — see service/iapService.ts's
//  usePendingPurchase()).
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(IAPEventEmitter, RCTEventEmitter)

@end
