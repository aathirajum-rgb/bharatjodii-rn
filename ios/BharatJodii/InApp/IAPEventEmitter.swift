//
//  IAPEventEmitter.swift
//  jodii
//
//  Dedicated RCTEventEmitter for the IAP module's "pendingPurchase" recovery
//  event (see Inapppurchase.swift's checkPendingTransactions()). The luv-rn
//  reference app reuses its call-feature VoipcallEmitter for this same event
//  — this app has no voice/video calling, so this is a minimal, IAP-only
//  emitter instead of dragging in an unrelated class.
//
//  Injected into the Xcode project by plugins/withIosStoreKitBridge.js on
//  every `expo prebuild` — do not hand-edit the copy under ios/, edit this
//  file instead.
//

import Foundation
import React

@objc(IAPEventEmitter)
class IAPEventEmitter: RCTEventEmitter {

    static var shared: IAPEventEmitter?
    private var hasListeners = false

    override init() {
        super.init()
        IAPEventEmitter.shared = self
    }

    override static func requiresMainQueueSetup() -> Bool {
        return true
    }

    override func supportedEvents() -> [String]! {
        return ["pendingPurchase"]
    }

    override func startObserving() {
        hasListeners = true
    }

    override func stopObserving() {
        hasListeners = false
    }

    @objc func emitPendingPurchase(_ transactionId: String, _ productId: String, _ orderId: String) {
        guard hasListeners else { return }
        sendEvent(withName: "pendingPurchase", body: ["transactionId": transactionId, "productId": productId, "orderId": orderId])
    }
}
