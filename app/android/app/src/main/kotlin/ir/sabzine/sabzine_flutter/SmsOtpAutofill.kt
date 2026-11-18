package ir.sabzine.sabzine_flutter

import android.app.Activity
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.google.android.gms.auth.api.phone.SmsRetriever
import com.google.android.gms.common.api.CommonStatusCodes
import com.google.android.gms.common.api.Status
import io.flutter.plugin.common.BinaryMessenger
import io.flutter.plugin.common.MethodChannel

/** One verification SMS, shared only after the system consent dialog. */
@Suppress("DEPRECATION")
class SmsOtpAutofill(private val activity: Activity, messenger: BinaryMessenger) {
    private val channel = MethodChannel(messenger, "ir.sabzine/sms_otp")
    private var starting: MethodChannel.Result? = null
    private var waiting: MethodChannel.Result? = null
    private var registered = false
    private var completed = false
    private var message: String? = null
    private var consentRequest: Int? = null
    private var nextRequest = 50100

    private val receiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            if (intent.action != SmsRetriever.SMS_RETRIEVED_ACTION) return
            val status = intent.extras?.get(SmsRetriever.EXTRA_STATUS) as? Status ?: return
            when (status.statusCode) {
                CommonStatusCodes.SUCCESS -> {
                    val consent = intent.getParcelableExtra<Intent>(SmsRetriever.EXTRA_CONSENT_INTENT)
                    if (consent == null) { finish(null); return }
                    val request = nextRequest++
                    if (nextRequest > 59999) nextRequest = 50100
                    consentRequest = request
                    try {
                        activity.startActivityForResult(consent, request)
                    } catch (_: android.content.ActivityNotFoundException) {
                        finish(null)
                    }
                }
                CommonStatusCodes.TIMEOUT -> finish(null)
            }
        }
    }

    init {
        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "start" -> start(result)
                "read" -> {
                    waiting?.success(null)
                    waiting = null
                    if (completed || !registered) {
                        result.success(message)
                        message = null
                    } else {
                        waiting = result
                    }
                }
                "stop" -> { stop(); result.success(null) }
                else -> result.notImplemented()
            }
        }
    }

    private fun start(result: MethodChannel.Result) {
        stop()
        starting = result
        try {
            val filter = IntentFilter(SmsRetriever.SMS_RETRIEVED_ACTION)
            // Only Google Play services may send to this dynamically registered receiver.
            if (Build.VERSION.SDK_INT >= 33) {
                activity.registerReceiver(receiver, filter, SmsRetriever.SEND_PERMISSION, null, Context.RECEIVER_EXPORTED)
            } else {
                activity.registerReceiver(receiver, filter, SmsRetriever.SEND_PERMISSION, null)
            }
            registered = true
            SmsRetriever.getClient(activity).startSmsUserConsent(null)
                .addOnSuccessListener {
                    if (starting === result) { starting = null; result.success(null) }
                }
                .addOnFailureListener {
                    if (starting === result) {
                        starting = null
                        result.error("unavailable", "SMS autofill is unavailable", null)
                        stop()
                    }
                }
        } catch (_: Exception) {
            starting = null
            result.error("unavailable", "SMS autofill is unavailable", null)
            stop()
        }
    }

    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?): Boolean {
        if (requestCode != consentRequest) return false
        finish(if (resultCode == Activity.RESULT_OK) data?.getStringExtra(SmsRetriever.EXTRA_SMS_MESSAGE) else null)
        return true
    }

    private fun unregister() {
        if (registered) {
            activity.unregisterReceiver(receiver)
            registered = false
        }
    }

    private fun finish(sms: String?) {
        consentRequest = null
        completed = true
        message = sms
        unregister()
        waiting?.let { result -> waiting = null; message = null; result.success(sms) }
    }

    private fun stop() {
        consentRequest = null
        starting?.error("canceled", "SMS request canceled", null)
        starting = null
        waiting?.success(null)
        waiting = null
        unregister()
        completed = false
        message = null
    }

    fun dispose() {
        stop()
        channel.setMethodCallHandler(null)
    }
}
