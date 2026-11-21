package ir.sabzine.sabzine_flutter

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.plugin.common.MethodChannel
import ir.cafebazaar.poolakey.Payment
import ir.cafebazaar.poolakey.config.PaymentConfiguration
import ir.cafebazaar.poolakey.config.SecurityCheck
import ir.cafebazaar.poolakey.entity.PurchaseInfo
import ir.cafebazaar.poolakey.request.PurchaseRequest

object StoreBillingBridge {
    fun purchase(activity: FlutterFragmentActivity, sku: String, payload: String, result: MethodChannel.Result) {
        val payment = payment(activity, result) ?: return
        val reply = StoreBillingReply(activity, result)
        payment.connect {
            connectionSucceed {
                payment.getPurchasedProducts {
                    querySucceed { purchases ->
                        val owned = purchases.firstOrNull { it.productId == sku }
                        if (owned != null) reply.success(owned.toPayload()) else buy(activity, payment, sku, payload, reply)
                    }
                    queryFailed { buy(activity, payment, sku, payload, reply) }
                }
            }
            connectionFailed { error ->
                reply.error("billing_unavailable", error.message ?: "بازار در دسترس نیست")
            }
        }
    }

    fun consume(activity: FlutterFragmentActivity, token: String, result: MethodChannel.Result) {
        val payment = payment(activity, result) ?: return
        val reply = StoreBillingReply(activity, result)
        payment.connect {
            connectionSucceed {
                payment.consumeProduct(token) {
                    consumeSucceed { reply.success(true) }
                    consumeFailed { error -> reply.error("billing_failed", error.message ?: "مصرف خرید انجام نشد") }
                }
            }
            connectionFailed { error ->
                reply.error("billing_unavailable", error.message ?: "بازار در دسترس نیست")
            }
        }
    }

    private fun payment(activity: FlutterFragmentActivity, result: MethodChannel.Result): Payment? {
        val rsa = BuildConfig.STORE_RSA_KEY
        if (rsa.isBlank()) {
            result.error("billing_unconfigured", "کلید پرداخت بازار در این نسخه تنظیم نشده است", null)
            return null
        }
        return Payment(
            context = activity,
            config = PaymentConfiguration(
                localSecurityCheck = SecurityCheck.Enable(rsaPublicKey = rsa),
                shouldSupportSubscription = false,
            ),
        )
    }

    private fun buy(
        activity: FlutterFragmentActivity,
        payment: Payment,
        sku: String,
        payload: String,
        reply: StoreBillingReply,
    ) {
        payment.purchaseProduct(
            registry = activity.activityResultRegistry,
            request = PurchaseRequest(productId = sku, payload = payload),
        ) {
            purchaseSucceed { info -> reply.success(info.toPayload()) }
            purchaseCanceled { reply.error("billing_canceled", "پرداخت لغو شد") }
            purchaseFailed { error -> reply.error("billing_failed", error.message ?: "پرداخت انجام نشد") }
            failedToBeginFlow { error -> reply.error("billing_unavailable", error.message ?: "شروع پرداخت بازار ممکن نشد") }
        }
    }

    private fun PurchaseInfo.toPayload(): Map<String, String?> = mapOf(
        "productId" to productId,
        "purchaseToken" to purchaseToken,
        "orderId" to orderId,
        "signature" to dataSignature,
    )
}
