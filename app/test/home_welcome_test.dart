import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/home/home_tab.dart';
import 'package:sabzine_flutter/features/home/home_welcome.dart';

Widget host(DemoStore store, Widget page, {double scale = 1}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(
        context,
      ).copyWith(disableAnimations: true, textScaler: TextScaler.linear(scale)),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: Scaffold(backgroundColor: Colors.white, body: page),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });
  testWidgets('home focus reflects real records and the next meal', (t) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final now = DateTime(2026, 11, 9, 12, 30);
    final store = DemoStore(clock: () => now)..loginDemoUser();
    store.approveActiveUserRequest();
    addTearDown(store.dispose);
    await t.pumpWidget(host(store, const HomeTab()));
    await t.pumpAndSettle();
    expect(find.text('سلام سارا جان'), findsOneWidget);
    expect(find.text('از ناهار شروع کنیم؟'), findsOneWidget);
    expect(find.text('۰ از ۴'), findsOneWidget);
    final first = t.widget<Container>(
      find.byKey(const ValueKey('home-progress-segment-0')),
    );
    expect((first.decoration as BoxDecoration).color, Colors.transparent);
    expect(store.eatenCount(now), 0);
    await store.recordMeal(now, 1, 'according');
    await t.pumpAndSettle();
    expect(find.text('۱ از ۴'), findsOneWidget);
    expect(find.text('بریم سراغ میان‌وعده؟'), findsOneWidget);
    for (final i in [0, 2, 3]) {
      await store.recordMeal(now, i, 'according');
    }
    await t.pumpAndSettle();
    expect(find.text('۴ از ۴'), findsOneWidget);
    expect(find.text('امروزت در یک نگاه'), findsOneWidget);
    expect(find.byKey(const ValueKey('home-next-meal')), findsNothing);
    expect(find.byKey(const ValueKey('home-day-review')), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
  testWidgets('waiting home offers plan status without invented progress', (
    t,
  ) async {
    var opened = 0;
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    await t.pumpWidget(host(store, HomeTab(onOpenPlan: () => opened++)));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('home-focus-progress')), findsNothing);
    expect(find.text('وضعیت برنامه'), findsOneWidget);
    await t.tap(find.text('وضعیت برنامه'));
    await t.pumpAndSettle();
    expect(opened, 1);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
  testWidgets('long Persian greeting fits a narrow screen with large text', (
    t,
  ) async {
    t.view.physicalSize = const Size(320, 720);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final store = DemoStore();
    addTearDown(store.dispose);
    var profile = 0;
    await t.pumpWidget(
      host(
        store,
        SingleChildScrollView(
          child: HomeWelcome(
            name: 'محمدحسین',
            now: DateTime(2026, 11, 9, 22),
            profilePhoto: 'invalid!',
            onProfile: () => profile++,
          ),
        ),
        scale: 1.5,
      ),
    );
    await t.pumpAndSettle();
    expect(find.text('شب بخیر'), findsOneWidget);
    expect(find.text('سلام محمدحسین جان'), findsOneWidget);
    await t.tap(find.text('م'));
    expect(profile, 1);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });
}
