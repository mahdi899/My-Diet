import 'dart:math';

import '../../../data/customer_auth.dart';
import '../../../domain/common/day.dart';
import '../../../domain/common/digits.dart';

class PlanChangeReason {
  const PlanChangeReason(this.id, this.label);
  final String id, label;
}

class PlanChangeMeal {
  const PlanChangeMeal(this.title, this.amount, this.instructions);
  final String title, amount, instructions;
}

class PlanChangeDay {
  const PlanChangeDay(this.label, this.meals);
  final String label;
  final List<PlanChangeMeal> meals;
}

class PlanChangeData {
  const PlanChangeData({
    required this.versionId,
    required this.days,
    required this.reasons,
  });
  final String versionId;
  final List<PlanChangeDay> days;
  final List<PlanChangeReason> reasons;
}

/// Uses the authenticated transport, including its session-refresh retry.
class PlanChangeRepository {
  const PlanChangeRepository(this.auth);
  final CustomerAuth auth;

  Future<PlanChangeData> load() async {
    final results = await Future.wait([
      auth.api('me/plan'),
      auth.api('me/plan-change-reasons'),
    ]);
    final plan = results[0];
    if (plan == null) throw StateError('هنوز برنامهٔ تأییدشده نداری.');
    if (plan is! Map ||
        plan['versionId'] is! String ||
        (plan['versionId'] as String).isEmpty) {
      throw const FormatException('Missing published version');
    }
    if (plan['expired'] == true) {
      throw StateError('هفتهٔ این برنامه پایان یافته است.');
    }
    final days = <PlanChangeDay>[];
    for (final day in (plan['days'] as List)) {
      final date = DateTime.tryParse(day['date'] as String? ?? '');
      final meals = <PlanChangeMeal>[];
      for (final meal in day['meals'] as List) {
        final options = (meal['options'] as List?) ?? const [];
        final selected =
            options
                .where((o) => o['optionId'] == meal['selectedOptionId'])
                .firstOrNull ??
            options.firstOrNull;
        final type = switch (meal['mealType']) {
          'breakfast' => 'صبحانه',
          'lunch' => 'ناهار',
          'dinner' => 'شام',
          _ => 'میان‌وعده',
        };
        final optionIngredients =
            (selected?['ingredients'] as List?) ?? const [];
        final ingredients = optionIngredients.isNotEmpty
            ? optionIngredients
            : selected == null || selected['kind'] == 'primary'
            ? (meal['items'] as List?) ?? const []
            : const [];
        meals.add(
          PlanChangeMeal(
            '$type · ${selected?['title'] ?? meal['title'] ?? ''}',
            ingredients
                .map(
                  (i) => [i['name'], i['quantity'], i['unit']]
                      .where((part) => part != null && '$part'.isNotEmpty)
                      .map((part) => fa('$part'))
                      .join(' '),
                )
                .join('، '),
            selected?['instructions'] as String? ?? '',
          ),
        );
      }
      days.add(
        PlanChangeDay(
          date == null ? 'روز ${fa(days.length + 1)}' : persianDate(date),
          meals,
        ),
      );
    }
    final reasons = <PlanChangeReason>[];
    for (final row in results[1] as List) {
      if (row['active'] == false) continue;
      final id = row['id'] as String;
      final label = (row['label'] as String).trim();
      if (id.isNotEmpty &&
          label.isNotEmpty &&
          !reasons.any((r) => r.id == id)) {
        reasons.add(PlanChangeReason(id, label));
      }
    }
    return PlanChangeData(
      versionId: plan['versionId'] as String,
      days: days,
      reasons: reasons,
    );
  }

  Future<void> submit({
    required String commandId,
    required String versionId,
    required List<String> reasonIds,
    required String explanation,
  }) async {
    final result = await auth.api(
      'me/plan-changes',
      method: 'POST',
      body: {
        'commandId': commandId,
        'versionId': versionId,
        'reasonIds': reasonIds,
        'explanation': explanation,
        'targets': <Object>[],
      },
    );
    if (result is! Map ||
        result['id'] is! String ||
        (result['id'] as String).isEmpty) {
      throw const FormatException('Missing submission receipt');
    }
  }
}

String newPlanChangeCommandId() {
  final random = Random.secure();
  final bytes = List.generate(16, (_) => random.nextInt(256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
  return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
}
