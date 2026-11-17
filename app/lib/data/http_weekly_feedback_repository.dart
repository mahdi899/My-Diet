import 'customer_auth.dart';
import 'weekly_feedback.dart';

class HttpWeeklyFeedbackRepository implements WeeklyFeedbackRepository {
  HttpWeeklyFeedbackRepository(
    this.auth, {
    required this.current,
    required this.localPreferences,
  });
  final CustomerAuth auth;
  final WeeklyFeedback? Function() current;
  final WeeklyFeedbackRepository localPreferences;

  @override
  Future<List<WeeklyFeedback>> list(String owner) async {
    final context = current();
    if (context == null) return [];
    try {
      final data = await auth.api(
        'me/weekly-feedback?weekStart=${context.week}',
      );
      final details = data['details'] as Map?;
      return [
        WeeklyFeedback.fromJson({
          ...context.toJson(),
          'favorite': data['favorites'],
          'disliked': data['dislikes'],
          'availability':
              const {
                'available': 'easy',
                'partial': 'sometimes',
                'unavailable': 'hard',
              }[data['ingredientAvailability']] ??
              'easy',
          'budget':
              const {
                'affordable': 'comfortable',
                'tight': 'mixed',
                'unaffordable': 'expensive',
              }[data['affordability']] ??
              'comfortable',
          'portion':
              const {
                'too_small': 'small',
                'right': 'suitable',
                'too_large': 'large',
              }[data['portionSatisfaction']] ??
              'suitable',
          'service': data['serviceRating'] == null ? 'not_used' : 'good',
          if (details != null) ...Map<String, dynamic>.from(details),
          'owner': owner,
          'requestId': context.requestId,
          'planVersion': context.planVersion,
          'week': context.week,
          'rating': data['serviceRating'] ?? 0,
          'comment': data['comment'],
          'publicConsent': data['publishPermission'],
          'publicText': data['publicText'] ?? '',
        }),
      ];
    } on AuthFailure catch (error) {
      if (error.code == 'not_found') return [];
      rethrow;
    }
  }

  @override
  Future<void> save(WeeklyFeedback feedback) async {
    final details = Map<String, dynamic>.from(feedback.toJson())
      ..removeWhere(
        (key, _) => const {
          'owner',
          'comment',
          'publicConsent',
          'publicText',
          'rating',
        }.contains(key),
      );
    await auth.api(
      'me/weekly-feedback',
      method: 'PUT',
      body: {
        'weekStart': feedback.week,
        'favorites': feedback.favorite,
        'dislikes': feedback.disliked,
        'preparationDifficulty': feedback.difficult.isEmpty ? 'easy' : 'hard',
        'ingredientAvailability': const {
          'easy': 'available',
          'sometimes': 'partial',
          'hard': 'unavailable',
        }[feedback.availability],
        'affordability': const {
          'comfortable': 'affordable',
          'mixed': 'tight',
          'expensive': 'unaffordable',
        }[feedback.budget],
        'portionSatisfaction': const {
          'small': 'too_small',
          'suitable': 'right',
          'large': 'too_large',
        }[feedback.portion],
        'serviceRating': feedback.rating == 0 ? null : feedback.rating,
        'comment': feedback.comment,
        'publishPermission': feedback.publicConsent,
        'publicText': feedback.publicConsent ? feedback.publicText : '',
        'details': details,
      },
    );
  }

  @override
  Future<FoodPreferences?> preferences(String owner) =>
      localPreferences.preferences(owner);

  @override
  Future<void> savePreferences(String owner, FoodPreferences preferences) =>
      localPreferences.savePreferences(owner, preferences);
}
