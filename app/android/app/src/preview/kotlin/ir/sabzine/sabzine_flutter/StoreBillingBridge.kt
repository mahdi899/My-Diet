package ir.sabzine.sabzine_flutter

import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.plugin.common.MethodChannel

/** Test builds have no store billing. Payment is completed by the server preview gateway. */
object StoreBillingBridge {
    @Suppress("UNUSED_PARAMETER")
    fun purchase(
        activity: FlutterFragmentActivity,
        sku: String,
        payload: String,
        result: MethodChannel.Result,
    ) {
        result.error("billing_unavailable", "این نسخهٔ آزمایشی پرداخت فروشگاهی ندارد", null)
    }

    @Suppress("UNUSED_PARAMETER")
    fun consume(activity: FlutterFragmentActivity, token: String, result: MethodChannel.Result) {
        result.success(true)
    }
}
