package ir.sabzine.sabzine_flutter

import android.app.Activity
import io.flutter.plugin.common.MethodChannel
import java.util.concurrent.atomic.AtomicBoolean

internal class StoreBillingReply(
    private val activity: Activity,
    private val result: MethodChannel.Result,
) {
    private val sent = AtomicBoolean(false)

    fun success(value: Any?) = send { result.success(value) }

    fun error(code: String, message: String) = send { result.error(code, message, null) }

    private fun send(block: () -> Unit) {
        if (!sent.compareAndSet(false, true)) return
        activity.runOnUiThread {
            try {
                block()
            } catch (_: IllegalStateException) {
            }
        }
    }
}
