//
//  Inapppurchase.swift
//  jodii
//
//  Ported from the luv-rn app's Inapppurchase.swift (same architecture,
//  same NativeModules.Inapppurchase surface expected by the JS side —
//  see service/iapService.ts). StoreKit 1 (SKPaymentQueue/SKProductsRequest),
//  not react-native-iap or StoreKit 2.
//
//  Injected into the Xcode project by plugins/withIosStoreKitBridge.js on
//  every `expo prebuild` — do not hand-edit the copy under ios/, edit this
//  file instead.
//

import Foundation
import StoreKit
import React

enum IAPAction {
    case purchase
    case restore
}

@objc(Inapppurchase)
class Inapppurchase: NSObject, SKProductsRequestDelegate, SKPaymentTransactionObserver {

    static let shared = Inapppurchase()
    private var productRequest: SKProductsRequest?
    private var products: [SKProduct] = []
    private var resolve: RCTPromiseResolveBlock?
    private var reject: RCTPromiseRejectBlock?
    private var currentAction: IAPAction?

    // Restore Transaction
    var restoredTransactions = String()
    var hasRestoredItems = false

    override init() {
        super.init()
        SKPaymentQueue.default().add(self)
    }

    @objc func fetchProducts(_ productIds: [String], resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        self.resolve = resolve
        self.reject = reject

        productRequest = SKProductsRequest(productIdentifiers: Set(productIds))
        productRequest?.delegate = self
        productRequest?.start()
    }

    func productsRequest(_ request: SKProductsRequest, didReceive response: SKProductsResponse) {
        self.products = response.products
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency

        let productsInfo = response.products.map { product -> [String: Any] in
            formatter.locale = product.priceLocale

            var productInfo: [String: Any] = [
                "id": product.productIdentifier,
                "title": product.localizedTitle,
                "description": product.localizedDescription,
                "price": product.price.stringValue,
                "localizedPrice": formatter.string(from: product.price) ?? product.price.stringValue,
                "currencyCode": product.priceLocale.currencyCode ?? ""
            ]

            // Subscription duration (if available)
            if let subscriptionPeriod = product.subscriptionPeriod {
                productInfo["subscriptionUnit"] = subscriptionPeriod.unit.rawValue
                productInfo["subscriptionNumberOfUnits"] = subscriptionPeriod.numberOfUnits
            }

            // Introductory discount (if available)
            if let intro = product.introductoryPrice {
                productInfo["introPrice"] = intro.price.stringValue
                productInfo["introPriceLocale"] = formatter.string(from: intro.price) ?? ""
                productInfo["introDuration"] = "\(intro.subscriptionPeriod.numberOfUnits) \(intro.subscriptionPeriod.unit.rawValue)"
            }

            return productInfo
        }

        resolve?(productsInfo)
    }

    @objc func purchaseProduct(_ productId: String, orderId: String, resolver resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {

        self.resolve = resolve
        self.reject = reject

        // Persist orderId whenever it's non-empty, right before submitting the
        // SKPayment — this is what checkPendingTransactions()/savePendingTransaction()
        // recover if the app is killed/backgrounded before the transaction
        // observer callback fires. Keep this condition as `!orderId.isEmpty`:
        // the luv-rn reference app once had this inverted (`if orderId.isEmpty`),
        // which meant the real orderId was never saved and recovered purchases
        // reported a dummy fallback ID to the backend.
        if !orderId.isEmpty {
            UserDefaults.standard.set(orderId, forKey: "orderId")
        }
        guard let product = products.first(where: { $0.productIdentifier == productId }) else {
            reject("E_PRODUCT_NOT_FOUND", "Product not found", nil)
            return
        }
        let payment = SKPayment(product: product)
        SKPaymentQueue.default().add(payment)
    }

    @objc func restorePurchases(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        self.resolve = resolve
        self.reject = reject
        SKPaymentQueue.default().restoreCompletedTransactions()
    }


    public func baseEncoding(tranction: SKPaymentTransaction) -> String {
        var encodingString = String()
        let appStoreUrl = Bundle.main.appStoreReceiptURL

        if let url = appStoreUrl {
            do {
                let receiptData = try Data(contentsOf: url, options: [])
                let receiptStr = receiptData.base64EncodedString()
                encodingString = receiptStr
            } catch {
                ///print(error)
            }
        }
        return encodingString
    }

    func urlEncodeString(from string: String?) -> String? {
        let URLEncodeStringChars: CharacterSet? = {
            var chars = CharacterSet.urlQueryAllowed
            chars.remove(charactersIn: "!*'();:@&=+$,/?%#[]")
            return chars
        }()
        if URLEncodeStringChars != nil {
            if let URLEncodeStringChars = URLEncodeStringChars {
                return string?.addingPercentEncoding(withAllowedCharacters: URLEncodeStringChars)
            }
            return nil
        }

        // to be thread safe
        if let URLEncodeStringChars = URLEncodeStringChars {
            return string?.addingPercentEncoding(withAllowedCharacters: URLEncodeStringChars)
        }
        return nil
    }

    func paymentQueue(_ queue: SKPaymentQueue, updatedTransactions transactions: [SKPaymentTransaction]) {
        for transaction in transactions {
            switch transaction.transactionState {
            case .purchased:
                let encodingString = baseEncoding(tranction: transaction)
                if resolve != nil {
                    resolve?(["status": "success", "productId": encodingString])
                    SKPaymentQueue.default().finishTransaction(transaction)
                    cleanup()
                } else {
                    let orderId = UserDefaults.standard.string(forKey: "orderId") ?? "0"
                    savePendingTransaction(encodingString, productId: transaction.payment.productIdentifier, orderId: orderId)
                    SKPaymentQueue.default().finishTransaction(transaction)
                }
            case .failed:
                SKPaymentQueue.default().finishTransaction(transaction)
                if let error = transaction.error {
                    if let skError = error as? SKError {
                        self.paymentfailedReason(error: skError)
                    }
                }
                cleanup()
            case .restored:
                let encodingString = baseEncoding(tranction: transaction)
                restoredTransactions = encodingString
                SKPaymentQueue.default().finishTransaction(transaction)
            case .purchasing, .deferred:
                break
            default:
                break
            }
        }
    }

    func paymentfailedReason(error: SKError) {
        switch error.code {
        case .paymentCancelled:
            reject?("E_PURCHASE_CANCELLED", "User canceled the purchase.", nil)
        case .paymentInvalid:
            reject?("E_PURCHASE_INVALID", "The payment is invalid.", nil)
        case .paymentNotAllowed:
            reject?("E_PURCHASE_NOT_ALLOWED", "The user is not allowed to make the payment.", nil)
        default:
            reject?("E_PURCHASE_FAILED", error.localizedDescription, nil)
        }
    }

    func paymentQueueRestoreCompletedTransactionsFinished(_ queue: SKPaymentQueue) {
        if restoredTransactions.count > 0 {
            resolve?(["status": "success", "data": restoredTransactions])
        } else {
            resolve?(["status": "Failed", "message": "No purchases found"])
        }
        restoredTransactions.removeAll()
        cleanup()
    }

    func paymentQueue(_ queue: SKPaymentQueue, restoreCompletedTransactionsFailedWithError error: Error) {
        reject?("E_RESTORE_FAILED", error.localizedDescription, error)
        cleanup()
    }

    private func cleanup() {
        resolve = nil
        reject = nil
    }

    private func savePendingTransaction(_ receipt: String, productId: String, orderId: String) {
        let pending: [String: Any] = ["receipt": receipt, "productId": productId, "timestamp": Date().timeIntervalSince1970, "orderId": orderId]
        UserDefaults.standard.set(pending, forKey: "pendingIAPTransaction")
        self.checkPendingTransactions()
    }

    @objc func checkPendingTransactions() {
        guard let pending = UserDefaults.standard.dictionary(forKey: "pendingIAPTransaction"),
              let receipt = pending["receipt"] as? String,
              let productId = pending["productId"] as? String,
              let orderId = pending["orderId"] as? String else {
            return
        }
        IAPEventEmitter.shared?.emitPendingPurchase(receipt, productId, orderId)
        UserDefaults.standard.removeObject(forKey: "pendingIAPTransaction")
    }
}
