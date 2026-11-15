import 'package:flutter/material.dart';
import '../../data/demo_store.dart';

void mealLogFeedback(
  BuildContext context,
  DemoStore store, {
  required MealLogCheckpoint before,
  required MealLogCheckpoint after,
  bool removed = false,
}) {
  final messenger = ScaffoldMessenger.of(context);
  messenger.hideCurrentSnackBar();
  messenger.showSnackBar(
    SnackBar(
      content: Text(
        removed
            ? 'ثبت وعده برگردانده شد.'
            : 'وضعیت وعده ذخیره شد؛ خلاصهٔ روز به‌روز است.',
      ),
      duration: const Duration(seconds: 6),
      action: SnackBarAction(
        label: removed ? 'بازگردانی' : 'برگرداندن',
        onPressed: () async {
          try {
            await store.restoreMealCheckpoint(before, expected: after);
            if (!messenger.mounted) return;
            messenger.showSnackBar(
              const SnackBar(content: Text('تغییر برگردانده شد.')),
            );
          } catch (_) {
            if (!messenger.mounted) return;
            messenger.showSnackBar(
              const SnackBar(
                content: Text('برگردانده نشد؛ ثبت فعلی را دوباره بررسی کن.'),
              ),
            );
          }
        },
      ),
    ),
  );
}
