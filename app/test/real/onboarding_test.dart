import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/real/core/api.dart';
import 'package:sabzine_flutter/real/core/digits.dart';
import 'package:sabzine_flutter/real/core/jalali.dart';
import 'package:sabzine_flutter/real/onboarding/controller.dart';
import 'package:sabzine_flutter/real/onboarding/repository.dart';
import 'package:sabzine_flutter/real/onboarding/spec.dart';

final specJson = <String, dynamic>{
  'version': 2,
  'tracks': [
    for (final t in ['lose', 'gain'])
      {
        'id': t,
        'title': t,
        'badge': 'b',
        'image': 'i',
        'description': 'd',
        'kcalHint': 'k',
      },
  ],
  'groups': {'basics': 'پایه', 'health': 'سلامت'},
  'insights': [
    {'afterKey': 'weight', 'title': 'نکته', 'body': 'متن', 'icon': 'sparkle'},
  ],
  'questions': [
    {
      'key': 'weight',
      'group': 'basics',
      'kind': 'number',
      'title': 'وزن',
      'required': true,
    },
    {
      'key': 'target_weight',
      'group': 'basics',
      'kind': 'number',
      'title': 'وزن هدف',
      'required': true,
      'tracks': ['lose'],
    },
    {
      'key': 'conditions',
      'group': 'health',
      'kind': 'multi',
      'title': 'بیماری',
      'required': true,
      'options': [
        {'code': 'none', 'label': 'ندارم', 'exclusive': true},
        {'code': 'diabetes', 'label': 'دیابت'},
        {'code': 'other', 'label': 'سایر'},
      ],
      'followUp': {
        'whenCodes': ['other'],
        'key': 'conditions_other',
        'placeholder': 'بنویس',
        'required': true,
      },
    },
    {
      'key': 'insulin',
      'group': 'health',
      'kind': 'single',
      'title': 'انسولین',
      'required': true,
      'options': [
        {'code': 'yes', 'label': 'بله'},
        {'code': 'no', 'label': 'خیر'},
      ],
      'showIf': {
        'key': 'conditions',
        'in': ['diabetes'],
      },
    },
  ],
};

class FakeOnboarding implements OnboardingRepository {
  final saved = <Map<String, Object?>>[];
  int version = 0;
  ApiException? failNext;
  bool submitted = false;

  @override
  Future<void> consent() async {}

  @override
  Future<OnboardingSpec> spec() async => OnboardingSpec.fromJson(specJson);

  @override
  Future<OnboardingState> state() async => const OnboardingState(
    nextStep: NextStep.start,
    claimedFromDemo: false,
    track: null,
    missing: [],
  );

  @override
  Future<int> saveDraft({
    String? track,
    required Answers patch,
    String? stepKey,
    int? progress,
    int? baseVersion,
  }) async {
    final fail = failNext;
    if (fail != null) {
      failNext = null;
      throw fail;
    }
    saved.add({...patch, '_track': ?track});
    return ++version;
  }

  @override
  Future<ProfileSummary> submit({required Answers patch}) async {
    submitted = true;
    return ProfileSummary.fromJson({
      'track': 'lose',
      'bmi': 24.5,
      'weightKg': 70,
      'heightCm': 170,
      'age': 30,
      'bmrKcal': 1500,
      'tdeeKcal': 2000,
      'targetKcal': 1700,
      'proteinG': 120,
      'carbsG': 180,
      'fatG': 55,
      'safetyTier': 'standard',
      'consented': false,
    });
  }
}

OnboardingController make(FakeOnboarding repo, {OnboardingState? state}) =>
    OnboardingController(
      repository: repo,
      spec: OnboardingSpec.fromJson(specJson),
      state:
          state ??
          const OnboardingState(
            nextStep: NextStep.start,
            claimedFromDemo: false,
            track: null,
            missing: [],
          ),
      saveDelay: const Duration(milliseconds: 5),
    );

void main() {
  group('Jalali', () {
    test('converts known dates', () {
      final j = Jalali.fromDate(DateTime(2026, 11, 8));
      expect((j.year, j.month, j.day), (1405, 8, 17));
      final nowruz = Jalali.fromDate(DateTime(2026, 3, 21));
      expect((nowruz.year, nowruz.month, nowruz.day), (1405, 1, 1));
      expect(j.formatFull(), '۱۷ آبان ۱۴۰۵');
    });

    test('week index is Saturday first', () {
      expect(weekdayNames[saturdayIndex(DateTime(2026, 11, 7))], 'شنبه');
      expect(weekdayNames[saturdayIndex(DateTime(2026, 11, 13))], 'جمعه');
    });
  });

  group('digits', () {
    test('persian digits and grouping', () {
      expect(fa('a1'), 'a۱');
      expect(latin('۱۲۳٣'), '1233');
      expect(money(1250000), '۱,۲۵۰,۰۰۰');
      expect(faNumber(68.5), '۶۸٫۵');
    });
  });

  group('OnboardingSpec', () {
    final spec = OnboardingSpec.fromJson(specJson);

    test('track filters questions', () {
      expect(
        spec.active('lose', {}).map((q) => q.key),
        contains('target_weight'),
      );
      expect(
        spec.active('gain', {}).map((q) => q.key),
        isNot(contains('target_weight')),
      );
    });

    test('showIf reveals insulin only for diabetes', () {
      expect(
        spec.active('lose', {}).map((q) => q.key),
        isNot(contains('insulin')),
      );
      expect(
        spec
            .active('lose', {
              'conditions': ['diabetes'],
            })
            .map((q) => q.key),
        contains('insulin'),
      );
    });

    test('required follow-up text counts for completeness', () {
      final q = spec.byKey('conditions')!;
      expect(
        spec.isAnswered(q, {
          'conditions': ['other'],
        }),
        isFalse,
      );
      expect(
        spec.isAnswered(q, {
          'conditions': ['other'],
          'conditions_other': 'آسم',
        }),
        isTrue,
      );
      expect(
        spec.isAnswered(q, {
          'conditions': ['none'],
        }),
        isTrue,
      );
    });

    test('missing lists only active required questions', () {
      final missing = spec.missing('gain', {'weight': 80});
      expect(missing, ['conditions']);
    });
  });

  group('OnboardingController', () {
    test('track first, then questions with insight after weight', () {
      final c = make(FakeOnboarding());
      expect(c.current, isA<TrackStep>());
      expect(c.canAdvance, isFalse);
      c.setTrack('lose');
      expect(c.canAdvance, isTrue);
      c.next();
      expect((c.current as QuestionStep).question.key, 'weight');
      c.setAnswer('weight', 70);
      c.next();
      expect(c.current, isA<InsightStep>());
      expect(c.progress, lessThan(1));
      c.dispose();
    });

    test('required question blocks next until answered', () {
      final c = make(FakeOnboarding())..setTrack('lose');
      c.next();
      expect(c.canAdvance, isFalse);
      c.next();
      expect((c.current as QuestionStep).question.key, 'weight');
      c.dispose();
    });

    test('answers are autosaved with a quiet debounce', () async {
      final repo = FakeOnboarding();
      final c = make(repo)..setTrack('lose');
      c.next();
      c.setAnswer('weight', 70);
      c.setAnswer('weight', 71);
      await Future<void>.delayed(const Duration(milliseconds: 40));
      expect(repo.saved.length, 1);
      expect(repo.saved.single['weight'], 71);
      expect(c.hasUnsynced, isFalse);
      c.dispose();
    });

    test(
      'offline failure keeps the patch and retries on the next flush',
      () async {
        final repo = FakeOnboarding()
          ..failNext = const ApiException('offline', offline: true);
        final c = make(repo)..setTrack('lose');
        c.setAnswer('weight', 70);
        expect(await c.flush(), isFalse);
        expect(c.syncError, isNotNull);
        expect(c.hasUnsynced, isTrue);
        expect(await c.flush(), isTrue);
        expect(c.syncError, isNull);
        expect(repo.saved.last['weight'], 70);
        c.dispose();
      },
    );

    test('submit refuses when answers could not be saved', () async {
      final repo = FakeOnboarding()
        ..failNext = const ApiException('x', offline: true);
      final c = make(repo)..setTrack('lose');
      c.setAnswer('weight', 70);
      // first flush inside submit fails, so nothing is submitted
      final profile = await c.submit();
      expect(profile, isNull);
      expect(repo.submitted, isFalse);
      expect(c.submitError, isNotNull);
      c.dispose();
    });

    test('submit succeeds once synced', () async {
      final repo = FakeOnboarding();
      final c = make(repo)..setTrack('lose');
      c.setAnswer('weight', 70);
      final profile = await c.submit();
      expect(profile?.targetKcal, 1700);
      expect(repo.submitted, isTrue);
      c.dispose();
    });

    test('gaps-only mode shows just the missing questions then review', () {
      final repo = FakeOnboarding();
      final c = make(
        repo,
        state: const OnboardingState(
          nextStep: NextStep.gaps,
          claimedFromDemo: true,
          track: 'gain',
          missing: ['conditions'],
          draft: DraftSnapshot(
            answers: {'weight': 80},
            stepKey: null,
            progress: 30,
            version: 3,
          ),
        ),
      );
      expect(c.steps.length, 2);
      expect((c.steps.first as QuestionStep).question.key, 'conditions');
      expect(c.steps.last, isA<ReviewStep>());
      c.dispose();
    });

    test('resume lands on the first open required question', () {
      final c = make(
        FakeOnboarding(),
        state: const OnboardingState(
          nextStep: NextStep.resume,
          claimedFromDemo: false,
          track: 'lose',
          missing: [],
          draft: DraftSnapshot(
            answers: {'weight': 80, 'target_weight': 70},
            stepKey: null,
            progress: 40,
            version: 2,
          ),
        ),
      );
      expect((c.current as QuestionStep).question.key, 'conditions');
      c.dispose();
    });

    test('changing an answer reveals dependent questions in place', () {
      final c = make(FakeOnboarding())..setTrack('gain');
      while (!(c.current is QuestionStep &&
          (c.current as QuestionStep).question.key == 'conditions')) {
        if (c.current is QuestionStep) {
          final q = (c.current as QuestionStep).question;
          c.setAnswer(q.key, 80);
        }
        c.next();
      }
      expect(
        c.steps.whereType<QuestionStep>().map((s) => s.question.key),
        isNot(contains('insulin')),
      );
      c.setAnswer('conditions', ['diabetes']);
      expect(
        c.steps.whereType<QuestionStep>().map((s) => s.question.key),
        contains('insulin'),
      );
      expect((c.current as QuestionStep).question.key, 'conditions');
      c.dispose();
    });
  });
}
