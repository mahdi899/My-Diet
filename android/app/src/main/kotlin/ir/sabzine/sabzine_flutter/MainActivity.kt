package ir.sabzine.sabzine_flutter

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import android.content.Intent

class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "ir.sabzine/registration")
            .setMethodCallHandler { call, result ->
                if (call.method != "open") {
                    result.notImplemented()
                    return@setMethodCallHandler
                }
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("https://my-diet.ir/demo/")))
                    result.success(null)
                } catch (error: android.content.ActivityNotFoundException) {
                    result.error("no_browser", "No browser available", null)
                }
            }
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "ir.sabzine/share")
            .setMethodCallHandler { call, result ->
                if (call.method != "text") { result.notImplemented(); return@setMethodCallHandler }
                val text = call.argument<String>("text")
                if (text.isNullOrBlank()) { result.error("invalid_text", "متن خالی است", null); return@setMethodCallHandler }
                try {
                    val intent = Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_TEXT, text)
                    }
                    startActivity(Intent.createChooser(intent, "اشتراک‌گذاری لیست خرید"))
                    result.success(true) // Chooser opened; does not claim delivery to another person.
                } catch (error: android.content.ActivityNotFoundException) { result.success(false) }
            }
    }
}
