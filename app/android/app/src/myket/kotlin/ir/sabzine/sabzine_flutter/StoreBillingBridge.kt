package ir.sabzine.sabzine_flutter

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.plugin.common.MethodChannel
import ir.myket.billingclient.IabHelper
import ir.myket.billingclient.util.Purchase

object StoreBillingBridge {
    fun purchase(activity: FlutterFragmentActivity, sku: String, payload: String, result: MethodChannel.Result) {
        val helper = helper(activity, result) ?: return
        val reply = StoreBillingReply(activity, result)
        helper.startSetup { setup ->
            if (!setup.isSuccess) {
                reply.error("billing_unavailable", setup.message ?: "مایکت در دسترس نیست")
                helper.dispose()
                return@startSetup
            }
            helper.queryInventoryAsync(false, listOf(sku)) { query, inventory ->
                val owned = if (query.isSuccess) inventory?.getPurchase(sku) else null
                if (owned != null) {
                    reply.success(owned.toPayload())
                    helper.dispose()
                    return@queryInventoryAsync
                }
                helper.launchPurchaseFlow(activity, sku, { purchaseResult, purchase ->
                    if (purchaseResult.isFailure || purchase == null) {
                        val canceled = purchaseResult.response == IabHelper.IABHELPER_USER_CANCELLED
                        reply.error(
                            if (canceled) "billing_canceled" else "billing_failed",
                            purchaseResult.message ?: "پرداخت انجام نشد",
                        )
                    } else {
                        reply.success(purchase.toPayload())
                    }
                    helper.dispose()
                }, payload)
            }
        }
    }

    fun consume(activity: FlutterFragmentActivity, token: String, result: MethodChannel.Result) {
        val helper = helper(activity, result) ?: return
        val reply = StoreBillingReply(activity, result)
        helper.startSetup { setup ->
            if (!setup.isSuccess) {
                reply.error("billing_unavailable", setup.message ?: "مایکت در دسترس نیست")
                helper.dispose()
                return@startSetup
            }
            helper.queryInventoryAsync(false, null) { query, inventory ->
                val owned = if (query.isSuccess) inventory?.allPurchases?.firstOrNull { it.token == token } else null
                if (owned == null) {
                    reply.success(true)
                    helper.dispose()
                    return@queryInventoryAsync
                }
                helper.consumeAsync(owned) { _, consumeResult ->
                    if (consumeResult.isSuccess) reply.success(true)
                    else reply.error("billing_failed", consumeResult.message ?: "مصرف خرید انجام نشد")
                    helper.dispose()
                }
            }
        }
    }

    private fun helper(activity: FlutterFragmentActivity, result: MethodChannel.Result): IabHelper? {
        val rsa = BuildConfig.STORE_RSA_KEY
        if (rsa.isBlank()) {
            result.error("billing_unconfigured", "کلید پرداخت مایکت در این نسخه تنظیم نشده است", null)
            return null
        }
        return IabHelper(activity, rsa).apply {
            enableDebugLogging(BuildConfig.DEBUG, "MyketBilling")
        }
    }

    private fun Purchase.toPayload(): Map<String, String?> = mapOf(
        "productId" to sku,
        "purchaseToken" to token,
        "orderId" to orderId,
        "signature" to signature,
    )
}
