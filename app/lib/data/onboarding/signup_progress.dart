import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../../domain/onboarding/spec.dart';

/// Unfinished signup, kept on the device until the phone is verified.
/// The server draft starts only after an account exists.
class SignupCheckpoint {
  const SignupCheckpoint({
    required this.track,
    required this.answers,
    required this.stepKey,
    required this.progress,
    required this.stage,
    required this.offeredIds,
    this.specialistId,
    this.planId,
  });

  final String? track;
  final Answers answers;
  final String? stepKey;
  final int progress;

  /// quiz, analysis, specialists, plans, or phone.
  final String stage;
  final List<String> offeredIds;
  final String? specialistId;
  final String? planId;

  bool get hasProgress =>
      track != null ||
      answers.isNotEmpty ||
      (stepKey != null && stepKey!.isNotEmpty) ||
      stage != 'quiz';
}

class SignupProgressStore {
  SignupProgressStore({SharedPreferencesAsync? preferences})
    : _preferences = preferences ?? SharedPreferencesAsync();

  static const key = 'sabzine.signup.progress.v1';
  final SharedPreferencesAsync _preferences;

  Future<SignupCheckpoint?> read() async {
    final raw = await _preferences.getString(key);
    if (raw == null || raw.isEmpty) return null;
    try {
      final json = jsonDecode(raw);
      if (json is! Map) return null;
      final answers = json['answers'];
      return SignupCheckpoint(
        track: json['track'] as String?,
        answers: answers is Map
            ? answers.map((key, value) => MapEntry(key.toString(), value))
            : {},
        stepKey: json['stepKey'] as String?,
        progress: (json['progress'] as num?)?.toInt() ?? 0,
        stage: json['stage'] as String? ?? 'quiz',
        offeredIds: ((json['offeredIds'] as List?) ?? const [])
            .map((id) => id.toString())
            .toList(),
        specialistId: json['specialistId'] as String?,
        planId: json['planId'] as String?,
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> write(SignupCheckpoint checkpoint) {
    return _preferences.setString(
      key,
      jsonEncode({
        'track': checkpoint.track,
        'answers': checkpoint.answers,
        'stepKey': checkpoint.stepKey,
        'progress': checkpoint.progress,
        'stage': checkpoint.stage,
        'offeredIds': checkpoint.offeredIds,
        'specialistId': checkpoint.specialistId,
        'planId': checkpoint.planId,
      }),
    );
  }

  Future<void> clear() => _preferences.remove(key);
}
