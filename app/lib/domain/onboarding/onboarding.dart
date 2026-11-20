import 'spec.dart';

enum NextStep { start, resume, gaps, consent, enterApp }

NextStep _step(String raw) => switch (raw) {
  'resume' => NextStep.resume,
  'gaps' => NextStep.gaps,
  'consent' => NextStep.consent,
  'enter_app' => NextStep.enterApp,
  _ => NextStep.start,
};

/// What the server worked out from the answers: shown on the review screen and the plan header.
class ProfileSummary {
  const ProfileSummary({
    required this.track,
    required this.bmi,
    required this.weightKg,
    required this.targetWeightKg,
    required this.heightCm,
    required this.age,
    required this.bmrKcal,
    required this.tdeeKcal,
    required this.targetKcal,
    required this.proteinG,
    required this.carbsG,
    required this.fatG,
    required this.doctorOnly,
    required this.safetyReasons,
    required this.consented,
    this.reportedMealsPerDay,
    this.plannedMealsPerDay,
  });
  factory ProfileSummary.fromJson(Map<String, dynamic> j) => ProfileSummary(
    track: j['track'] as String,
    bmi: (j['bmi'] as num).toDouble(),
    weightKg: (j['weightKg'] as num).toDouble(),
    targetWeightKg: (j['targetWeightKg'] as num?)?.toDouble(),
    heightCm: (j['heightCm'] as num).toDouble(),
    age: j['age'] as int,
    bmrKcal: j['bmrKcal'] as int,
    tdeeKcal: j['tdeeKcal'] as int,
    targetKcal: j['targetKcal'] as int,
    proteinG: j['proteinG'] as int,
    carbsG: j['carbsG'] as int,
    fatG: j['fatG'] as int,
    doctorOnly: j['safetyTier'] == 'doctor_only',
    safetyReasons: ((j['safetyReasons'] as List?) ?? const []).cast<String>(),
    consented: j['consented'] == true,
    reportedMealsPerDay: (j['reportedMealsPerDay'] as num?)?.toInt(),
    plannedMealsPerDay: (j['plannedMealsPerDay'] as num?)?.toInt(),
  );
  final String track;
  final double bmi, weightKg, heightCm;
  final double? targetWeightKg;
  final int age, bmrKcal, tdeeKcal, targetKcal, proteinG, carbsG, fatG;
  final bool doctorOnly, consented;
  final int? reportedMealsPerDay, plannedMealsPerDay;
  final List<String> safetyReasons;
}

class DraftSnapshot {
  const DraftSnapshot({
    required this.answers,
    required this.stepKey,
    required this.progress,
    required this.version,
  });
  final Answers answers;
  final String? stepKey;
  final int progress, version;
}

class OnboardingState {
  const OnboardingState({
    required this.nextStep,
    required this.claimedFromDemo,
    required this.track,
    required this.missing,
    this.draft,
    this.profile,
  });
  factory OnboardingState.fromJson(Map<String, dynamic> j) {
    final d = j['draft'] as Map<String, dynamic>?;
    return OnboardingState(
      nextStep: _step(j['nextStep'] as String),
      claimedFromDemo: j['claimedFromDemo'] == true,
      track: j['track'] as String?,
      missing: ((j['missing'] as List?) ?? const []).cast<String>(),
      draft: d == null
          ? null
          : DraftSnapshot(
              answers: Map<String, Object?>.from(d['answers'] as Map),
              stepKey: d['stepKey'] as String?,
              progress: (d['progress'] as num?)?.toInt() ?? 0,
              version: d['version'] as int,
            ),
      profile: j['profile'] == null
          ? null
          : ProfileSummary.fromJson(j['profile'] as Map<String, dynamic>),
    );
  }
  final NextStep nextStep;
  final bool claimedFromDemo;
  final String? track;
  final List<String> missing;
  final DraftSnapshot? draft;
  final ProfileSummary? profile;
}

abstract interface class OnboardingRepository {
  Future<OnboardingSpec> spec();
  Future<OnboardingState> state();

  /// Merges `patch` into the server draft. A null value deletes that answer.
  /// Returns the new draft version.
  Future<int> saveDraft({
    String? track,
    required Answers patch,
    String? stepKey,
    int? progress,
    int? baseVersion,
  });
  Future<ProfileSummary> submit({required Answers patch});
  Future<void> consent();
}
