import '../../core/format/digits.dart' show latin;
import '../../presentation/session/customer_scope.dart';
import '../plan/goal_math.dart';

/// A presentation of actual daily records. Looking ahead never marks an earlier
/// meal as eaten, skipped, or completed.
class HomeDayFocus {
  const HomeDayFocus({
    required this.title,
    required this.message,
    required this.completed,
    required this.total,
    required this.review,
    this.next,
  });

  factory HomeDayFocus.from(CustomerWorkspace store) {
    final now = store.today;
    final meals = store.mealsOn(now);
    final open = <NextMeal>[];
    for (var i = 0; i < meals.length; i++) {
      if (!store.mealEaten(now, i) && store.consumedMealOn(now, i) == null) {
        open.add(NextMeal(now, i, meals[i]));
      }
    }
    final completed = meals.length - open.length;
    final review = now.hour >= 21 || (meals.isNotEmpty && open.isEmpty);
    NextMeal? next;
    for (final candidate in open) {
      final match = RegExp(
        r'^(\d{1,2}):(\d{2})$',
      ).firstMatch(latin(candidate.meal.time.trim()));
      if (match == null) continue;
      final hour = int.parse(match[1]!);
      final minute = int.parse(match[2]!);
      if (hour > 23 || minute > 59) continue;
      if (hour * 60 + minute >= now.hour * 60 + now.minute - 45) {
        next = candidate;
        break;
      }
    }
    next ??= open.firstOrNull;
    final title = meals.isEmpty
        ? 'یک شروع برای خودت'
        : review
        ? 'امروزت در یک نگاه'
        : completed > 0
        ? 'قدم بعدی امروزت'
        : now.hour < 12
        ? 'امروز را خوش‌طعم شروع کن'
        : 'وقت یک انتخاب خوش‌طعم';
    final message = meals.isEmpty
        ? (store.hasUserRequest
              ? 'وضعیت برنامه‌ات را ببین؛ تا آماده‌شدنش کنارت هستیم.'
              : 'با شناخت سلیقه و عادت‌هایت، مسیرت را شروع کن.')
        : review
        ? '${fa(completed)} وعده از ${fa(meals.length)} وعده را ثبت کردی. هر قدمت ارزش دیده‌شدن دارد.'
        : completed > 0
        ? '${fa(completed)} وعده ثبت شده؛ با ریتم خودت ادامه بده.'
        : 'برنامه برای زندگی توست؛ از همین وعده شروع کنیم.';
    return HomeDayFocus(
      title: title,
      message: message,
      completed: completed,
      total: meals.length,
      review: review,
      next: next,
    );
  }

  final String title, message;
  final int completed, total;
  final bool review;
  final NextMeal? next;
}
