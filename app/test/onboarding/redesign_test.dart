import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/network/api_client.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/presentation/onboarding/controller.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/onboarding/onboarding_flow.dart';
import 'package:sabzine_flutter/presentation/onboarding/profile_result.dart';
import 'package:sabzine_flutter/presentation/screens/onboarding.dart';
import 'package:sabzine_flutter/presentation/screens/questionnaire.dart';

const _spec = <String, dynamic>{
  'version': 2,
  'tracks': [
    {
      'id': 'lose',
      'title': 'کاهش',
      'badge': 'هدف',
      'image': 'i',
      'description': 'کم کردن وزن',
      'kcalHint': 'k',
    },
  ],
  'groups': {'basics': 'پایه'},
  'questions': [
    {
      'key': 'note',
      'group': 'basics',
      'kind': 'text',
      'title': 'یادداشت',
      'required': false,
    },
  ],
};

class _Boom implements OnboardingRepository {
  @override
  Future<void> consent() async {}

  @override
  Future<OnboardingSpec> spec() async => OnboardingSpec.fromJson(_spec);

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
  }) async => 1;

  @override
  Future<ProfileSummary> submit({required Answers patch}) async {
    throw const ApiException('ارتباط قطع شد');
  }
}

ProfileSummary _profile() => ProfileSummary.fromJson({
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
});

void main() {
  testWidgets('reduced motion skips the building theater', (tester) async {
    tester.view.physicalSize = const Size(800, 1400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    await tester.pumpWidget(
      MaterialApp(
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(disableAnimations: true),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: child!,
          ),
        ),
        home: ProfileResultScreen(profile: _profile(), onContinue: () {}),
      ),
    );

    expect(find.text('در حال ساخت برنامه شما'), findsNothing);
    expect(find.text('شروع کن'), findsOneWidget);
    expect(find.text('برنامه‌ات آماده است'), findsOneWidget);
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
  });

  testWidgets('a failed submit drops the theater and shows the error', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(800, 1600);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    final controller = OnboardingController(
      repository: _Boom(),
      spec: OnboardingSpec.fromJson(_spec),
      state: const OnboardingState(
        nextStep: NextStep.start,
        claimedFromDemo: false,
        track: null,
        missing: [],
      ),
      saveDelay: const Duration(milliseconds: 5),
    );
    var done = 0;
    await tester.pumpWidget(
      MaterialApp(
        theme: appTheme(),
        builder: (context, child) =>
            Directionality(textDirection: TextDirection.rtl, child: child!),
        home: OnboardingFlow(controller: controller, onDone: (_) => done++),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await tester.tap(find.text('کاهش'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 700));
    expect(find.text('یادداشت'), findsOneWidget);

    await tester.tap(find.text('ثبت پاسخ‌ها'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    expect(done, 0);
    expect(find.text('ارتباط قطع شد'), findsOneWidget);
    expect(find.text('در حال ساخت برنامه شما'), findsNothing);

    controller.dispose();
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(milliseconds: 400));
  });

  testWidgets('intro offers the questionnaire and the first step lays out', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    final store = DemoStore();
    addTearDown(store.dispose);

    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          theme: appTheme(),
          builder: (context, child) =>
              Directionality(textDirection: TextDirection.rtl, child: child!),
          home: const OnboardingScreen(role: AppRole.user),
        ),
      ),
    );
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('شروع پرسش‌نامه'), findsOneWidget);
    expect(find.text('غذا، برای تو'), findsOneWidget);
    expect(tester.takeException(), isNull);

    await tester.tap(find.text('شروع پرسش‌نامه'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(QuestionnaireScreen), findsOneWidget);
    expect(find.text('ادامه'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
