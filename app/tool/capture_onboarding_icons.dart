// flutter test tool/capture_onboarding_icons.dart --update-goldens
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/icons/diet_icon.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/presentation/onboarding/controller.dart';
import 'package:sabzine_flutter/presentation/onboarding/onboarding_flow.dart';
import '../test/onboarding/onboarding_test.dart' show FakeOnboarding;

const _out =
    '../../references/flutter-app-review/2026-11-17/onboarding-icons-v2';
const _symbols = {
  DietIconKind.seated: 'خیلی کم',
  DietIconKind.walking: 'کم',
  DietIconKind.cycling: 'متوسط',
  DietIconKind.running: 'زیاد',
  DietIconKind.strength: 'خیلی زیاد',
  DietIconKind.female: 'زن',
  DietIconKind.male: 'مرد',
  DietIconKind.pregnancy: 'بارداری',
  DietIconKind.scale: 'وزن',
  DietIconKind.leaf: 'گیاهی',
  DietIconKind.heart: 'سلامت',
  DietIconKind.shield: 'مراقبت',
  DietIconKind.medicine: 'دارو',
  DietIconKind.clock: 'زمان',
  DietIconKind.wallet: 'بودجه',
  DietIconKind.moon: 'خواب',
  DietIconKind.sun: 'انرژی',
  DietIconKind.person: 'مشخصات',
  DietIconKind.meal: 'غذا',
  DietIconKind.water: 'آب',
};
const _foodOut =
    '../../references/flutter-app-review/2026-11-17/onboarding-food-icons';
const _foodSymbols = {
  DietIconKind.mealOne: '۱ وعده',
  DietIconKind.mealTwo: '۲ وعده',
  DietIconKind.mealThree: '۳ وعده',
  DietIconKind.mealMore: 'بیشتر',
  DietIconKind.shield: 'بدون حساسیت',
  DietIconKind.dairy: 'لبنیات',
  DietIconKind.nuts: 'آجیل',
  DietIconKind.egg: 'تخم‌مرغ',
  DietIconKind.wheat: 'گلوتن',
  DietIconKind.foodAllergy: 'سایر حساسیت‌ها',
};

Widget preview(Widget child) => MaterialApp(
  debugShowCheckedModeBanner: false,
  theme: appTheme(),
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(disableAnimations: true),
    child: Directionality(textDirection: TextDirection.rtl, child: child!),
  ),
  home: child,
);

void main() {
  setUpAll(() async {
    final fonts = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await fonts.load();
  });
  testWidgets('capture full icon family and actual mobile questions', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(620, 660);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      preview(
        Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text(
                  'آنبوردینگ · خطی دورنگ',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    for (final entry in _symbols.entries)
                      Container(
                        width: 108,
                        height: 132,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F8F3),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            DietIcon(entry.key, size: 80),
                            const SizedBox(height: 6),
                            Text(
                              entry.value,
                              style: const TextStyle(fontSize: 14),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('$_out/family.png'),
    );
    expect(tester.takeException(), isNull);

    tester.view.physicalSize = const Size(390, 844);
    final spec = OnboardingSpec.fromJson(
      jsonDecode(
        File(
          '../references/flutter-app-review/2026-11-15/onboarding-spec.json',
        ).readAsStringSync(),
      ),
    );
    final controller = OnboardingController(
      repository: FakeOnboarding(),
      spec: spec,
      state: OnboardingState(
        nextStep: NextStep.start,
        claimedFromDemo: false,
        track: spec.tracks.first.id,
        missing: const [],
      ),
    );
    for (final name in ['activity', 'sex', 'sleep_wake']) {
      controller.index = controller.steps.indexWhere((step) => step.id == name);
      controller.answers['activity'] = 'very_low';
      await tester.pumpWidget(
        preview(
          OnboardingFlow(
            key: ValueKey(name),
            controller: controller,
            onDone: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_out/$name.png'),
      );
      expect(tester.takeException(), isNull);
    }
    for (final name in ['meals_per_day', 'allergies']) {
      controller.index = controller.steps.indexWhere((step) => step.id == name);
      controller.answers['meals_per_day'] = '3';
      controller.answers['allergies'] = ['dairy'];
      await tester.pumpWidget(
        preview(
          OnboardingFlow(
            key: ValueKey(name),
            controller: controller,
            onDone: (_) {},
          ),
        ),
      );
      await tester.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('$_foodOut/$name.png'),
      );
      expect(tester.takeException(), isNull);
    }
    controller.dispose();
    await tester.pumpWidget(const SizedBox());
  });
  testWidgets('capture meal counts and food allergy symbols', (tester) async {
    tester.view.physicalSize = const Size(620, 390);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      preview(
        Scaffold(
          body: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                const Text(
                  'وعده‌ها و حساسیت‌های غذایی',
                  style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 20),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  children: [
                    for (final entry in _foodSymbols.entries)
                      Container(
                        width: 108,
                        height: 132,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0F8F3),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            DietIcon(entry.key, size: 80),
                            const SizedBox(height: 6),
                            Text(
                              entry.value,
                              style: const TextStyle(fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await expectLater(
      find.byType(MaterialApp),
      matchesGoldenFile('$_foodOut/family.png'),
    );
    expect(tester.takeException(), isNull);
  });
}
