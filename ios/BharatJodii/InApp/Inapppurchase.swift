//
//  Inapppurchase.swift
//  jodii
//
//  StoreKit 2 (Product/Transaction/VerificationResult, async/await) — not
//  react-native-iap, not StoreKit 1's SKPaymentQueue/SKProductsRequest (the
//  previous version of this file). The backend (nbvpnode's JODII-535,
//  src/nbpayment's iospayrecval) independently re-fetches and verifies each
//  transaction from Apple's App Store Server API using only the transaction
//  id — so this module only ever needs to hand JS a transaction id, never a
//  receipt blob. The mobile app never decides a purchase is "successful" on
//  its own; see service/iapService.ts's verifyAndActivateIosMembership().
//
//  Injected into the Xcode project by plugins/withIosStoreKitBridge.js on
//  every `expo prebuild` — do not hand-edit the copy under ios/, edit this
//  file instead.
//

import Foundation
import StoreKit
import React

enum StoreError: Error {
    case failedVerification
}

// Apple's docs recommend this exact check for every VerificationResult:
// `.verified` means StoreKit validated the JWS signature itself; `.unverified`
// means it couldn't (jailbroken device, tampered payload, etc.) and must never
// be treated as a real purchase.
func checkVerified<T>(_ result: VerificationResult<T>) throws -> T {
    switch result {
    case .unverified:
        throw StoreError.failedVerification
    case .verified(let safe):
        return safe
    }
}

// Product.SubscriptionPeriod.Unit (StoreKit 2) is a plain, non-raw-valued
// enum — unlike StoreKit 1's SKProduct.PeriodUnit, which was Int-backed
// (day=0, week=1, month=2, year=3). Mapped to the same numbering here so
// the JS-facing subscriptionUnit contract (a number) doesn't change.
func periodUnitRawValue(_ unit: Product.SubscriptionPeriod.Unit) -> Int {
    switch unit {
    case .day: return 0
    case .week: return 1
    case .month: return 2
    case .year: return 3
    @unknown default: return -1
    }
}

@objc(Inapppurchase)
class Inapppurchase: NSObject {

    static let shared = Inapppurchase()
    private var products: [String: Product] = [:]
    private var updatesTask: Task<Void, Never>?

    override init() {
        super.init()
        // Replaces SKPaymentTransactionObserver. Transaction.updates delivers
        // every transaction for the lifetime of the app — new purchases,
        // renewals, and (per Apple's docs) any transaction that finished
        // while the app wasn't running — which is what previously needed the
        // UserDefaults-backed checkPendingTransactions() dance in the
        // StoreKit 1 version of this file.
        updatesTask = Task.detached { [weak self] in
            for await result in Transaction.updates {
                await self?.handle(updatedTransaction: result)
            }
        }
    }

    deinit {
        updatesTask?.cancel()
    }

    @objc func fetchProducts(_ productIds: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                let storeProducts = try await Product.products(for: productIds)
                for product in storeProducts {
                    self.products[product.id] = product
                }

                let productsInfo = storeProducts.map { product -> [String: Any] in
                    var productInfo: [String: Any] = [
                        "id": product.id,
                        "title": product.displayName,
                        "description": product.description,
                        "price": "\(product.price)",
                        "localizedPrice": product.displayPrice,
                        "currencyCode": product.priceFormatStyle.currencyCode,
                    ]

                    if let subscription = product.subscription {
                        productInfo["subscriptionUnit"] = periodUnitRawValue(subscription.subscriptionPeriod.unit)
                        productInfo["subscriptionNumberOfUnits"] = subscription.subscriptionPeriod.value
                        if let intro = subscription.introductoryOffer {
                            productInfo["introPrice"] = "\(intro.price)"
                            productInfo["introDuration"] = "\(intro.period.value) \(periodUnitRawValue(intro.period.unit))"
                        }
                    }
                    return productInfo
                }
                resolve(productsInfo)
            } catch {
                reject("E_PRODUCT_FETCH_FAILED", error.localizedDescription, error)
            }
        }
    }

    @objc func purchaseProduct(_ productId: String, orderId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let product = products[productId] else {
            reject("E_PRODUCT_NOT_FOUND", "Product not found", nil)
            return
        }

        // Persisted so a purchase that finishes after the app is killed/
        // backgrounded (before this Task resumes) can still be matched back
        // to its order — read back in handle(updatedTransaction:) below.
        // Keep this unconditional set (not `if !orderId.isEmpty`) — the
        // luv-rn reference app this was ported from once had that inverted,
        // which meant the real orderId was never saved and recovered
        // purchases reported a dummy fallback id to the backend.
        UserDefaults.standard.set(orderId, forKey: "orderId")

        Task {
            do {
                let result = try await product.purchase()
                switch result {
                case .success(let verification):
                    let transaction = try checkVerified(verification)
                    resolve(["status": "success", "transactionId": String(transaction.id)])
                    // Deliberately NOT calling transaction.finish() here — JS
                    // only finishes once ITS OWN backend has independently
                    // verified this transaction with Apple and activated
                    // membership (see finishTransaction() below). Until then
                    // StoreKit keeps redelivering it via Transaction.updates,
                    // so a killed app / failed network call before the
                    // backend confirms doesn't lose the purchase.
                case .userCancelled:
                    reject("E_PURCHASE_CANCELLED", "User canceled the purchase.", nil)
                case .pending:
                    reject("E_PURCHASE_PENDING", "Purchase is pending approval (e.g. Ask to Buy).", nil)
                @unknown default:
                    reject("E_PURCHASE_FAILED", "Unknown purchase result.", nil)
                }
            } catch StoreError.failedVerification {
                reject("E_PURCHASE_INVALID", "Apple could not verify this transaction.", nil)
            } catch {
                reject("E_PURCHASE_FAILED", error.localizedDescription, error)
            }
        }
    }

    // Called by JS only after its backend has verified the transaction with
    // Apple and activated membership — see service/iapService.ts. Finishing
    // removes it from the queue/Transaction.updates for good; never call this
    // before that backend confirmation.
    @objc func finishTransaction(_ transactionId: NSString, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        guard let idValue = UInt64(transactionId as String) else {
            reject("E_INVALID_TRANSACTION_ID", "Invalid transaction id", nil)
            return
        }
        Task {
            for await result in Transaction.all {
                if let transaction = try? checkVerified(result), transaction.id == idValue {
                    await transaction.finish()
                    resolve(true)
                    return
                }
            }
            resolve(false) // already finished, or not found — not an error
        }
    }

    @objc func restorePurchases(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        Task {
            do {
                try await AppStore.sync()

                var restored: [[String: String]] = []
                for await result in Transaction.currentEntitlements {
                    if let transaction = try? checkVerified(result) {
                        restored.append(["productId": transaction.productID, "transactionId": String(transaction.id)])
                    }
                }

                if restored.isEmpty {
                    resolve(["status": "Failed", "message": "No purchases found"])
                } else {
                    // NOTE: a restored transaction has no app-generated OrderId
                    // (that only exists for a fresh checkout via
                    // getCheckoutDetails()) — the backend contract for
                    // crediting membership FROM a restore, without a
                    // pre-existing OrderId row, isn't defined yet. This
                    // currently only reports what StoreKit found; it does not
                    // re-activate membership. Wire that once backend decides
                    // how a restore should be recorded.
                    resolve(["status": "success", "data": restored])
                }
            } catch {
                reject("E_RESTORE_FAILED", error.localizedDescription, error)
            }
        }
    }

    // StoreKit 2 delivers unfinished transactions through Transaction.updates
    // itself (see init()'s updatesTask, started at app launch) — no
    // UserDefaults polling needed like StoreKit 1 required. Kept as a no-op
    // so the existing JS call site (App.tsx's usePendingPurchase()) doesn't
    // need a native-surface change.
    @objc func checkPendingTransactions() {}

    private func handle(updatedTransaction result: VerificationResult<Transaction>) async {
        guard let transaction = try? checkVerified(result) else { return }
        let orderId = UserDefaults.standard.string(forKey: "orderId") ?? ""
        IAPEventEmitter.shared?.emitPendingPurchase(String(transaction.id), transaction.productID, orderId)
        // Not finished here either — same reasoning as purchaseProduct().
    }
}
