// Actual Flutter widget renders. Offline fixture data, no production requests.
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/photos/food_photo_resolver.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/presentation/onboarding/controller.dart';
import 'package:sabzine_flutter/presentation/onboarding/onboarding_flow.dart';

class _LocalAnswers implements OnboardingRepository {
  _LocalAnswers(this.value);
  final OnboardingSpec value;
  int version = 1;
  @override
  Future<OnboardingSpec> spec() async => value;
  @override
  Future<OnboardingState> state() async => const OnboardingState(nextStep: NextStep.start, claimedFromDemo: false, track: null, missing: []);
  @override
  Future<int> saveDraft({String? track, required Answers patch, String? stepKey, int? progress, int? baseVersion}) async => ++version;
  @override
  Future<ProfileSummary> submit({required Answers patch}) => throw UnimplementedError('This visual harness never submits');
  @override
  Future<void> consent() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await (FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'))).load();
    await (FontLoader('MaterialIcons')..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await FoodPhotoResolver.load();
  });

  testWidgets('render all four implemented UI changes', (tester) async {
    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.reset);

    Future<void> settle() async {
      await tester.pump();
      for (var i = 0; i < 8; i++) { await tester.pump(const Duration(milliseconds: 180)); }
      await tester.runAsync(() async { await Future<void>.delayed(const Duration(milliseconds: 180)); });
      await tester.pump(const Duration(milliseconds: 600));
    }
    Future<void> shot(String name) async {
      await settle();
      expect(tester.takeException(), isNull);
      await expectLater(find.byType(MaterialApp), matchesGoldenFile('implemented/$name.png'));
    }

    var now = DateTime(2026, 11, 9, 12, 30);
    final store = DemoStore(clock: () => now)..loginDemoUser();
    store.approveActiveUserRequest();
    await tester.pumpWidget(SabzineApp(store: store, splashDuration: Duration.zero));
    await tester.runAsync(() async {
      final context = tester.element(find.byType(Scaffold).first);
      for (final meal in store.mealsOn(store.today)) {
        final photo = FoodPhotoResolver.instance!.resolve(title: meal.title, mealType: meal.name, ingredients: [for (final item in meal.ingredients) item.name]);
        await precacheImage(AssetImage(photo.path), context);
        await precacheImage(ResizeImage(AssetImage(photo.path), width: 390), context);
        await precacheImage(AssetImage(photo.thumb), context);
      }
    });
    await shot('01-home');
    await tester.ensureVisible(find.byKey(const ValueKey('home-meal-details')));
    await tester.tap(find.byKey(const ValueKey('home-meal-details')));
    await shot('02-food-detail');
    await tester.drag(find.byType(CustomScrollView).first, const Offset(0, -360));
    await shot('02b-food-ingredients');
    Navigator.of(tester.element(find.byType(CustomScrollView).first)).pop();
    await settle();
    now = DateTime(2026, 11, 9, 22);
    store.update();
    await tester.drag(find.byKey(const ValueKey('home-tab')), const Offset(0, 1500));
    await shot('01b-home-evening');
    now = DateTime(2026, 11, 9, 12, 30);
    store.update();
    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await shot('04-coach');
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    store.dispose();

    final spec = OnboardingSpec.fromJson(jsonDecode(File('../references/flutter-app-review/2026-11-15/onboarding-spec.json').readAsStringSync()) as Map<String,dynamic>);
    final controller = OnboardingController(repository: _LocalAnswers(spec), spec: spec,
      state: const OnboardingState(nextStep: NextStep.resume, claimedFromDemo: false, track: 'weight_loss', missing: [],
        draft: DraftSnapshot(answers: {'name':'سارا','age':29,'sex':'female','height_cm':168,'weight_kg':72,'target_weight_kg':65}, stepKey:'height_cm', progress: 12, version:1)));
    await tester.pumpWidget(MaterialApp(debugShowCheckedModeBanner: false, theme: appTheme(), builder: (context, child) => Directionality(textDirection: TextDirection.rtl, child: child!),
      home: OnboardingFlow(controller: controller, onDone: (_) {})));
    await shot('03-onboarding');
    await tester.tap(find.byKey(const ValueKey('onboarding-profile-preview')));
    await shot('03b-profile-summary');
    await tester.pumpWidget(const SizedBox());
    await tester.pump();
    controller.dispose();
  });
}
