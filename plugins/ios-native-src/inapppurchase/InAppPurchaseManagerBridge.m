//
//  InAppPurchaseManagerBridge.m
//  jodii
//
//  Exposes the Swift Inapppurchase class (SKPaymentQueue/SKProductsRequest —
//  see Inapppurchase.swift) to JS as NativeModules.Inapppurchase.
//

#import "InAppPurchaseManagerBridge.h"
#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(Inapppurchase, NSObject)

RCT_EXTERN_METHOD(fetchProducts:(NSArray *)productIds
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(purchaseProduct:(NSString *)productId
                  orderId:(NSString *)orderId
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(restorePurchases:(RCTPromiseResolveBlock)resolve
  rejecter:(RCTPromiseRejectBlock)reject)

RCT_EXTERN_METHOD(checkPendingTransactions)

@end
