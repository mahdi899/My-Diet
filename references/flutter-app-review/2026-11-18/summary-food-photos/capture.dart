// Run from app: flutter test --no-pub ../references/flutter-app-review/2026-11-18/summary-food-photos/capture.dart
import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:sabzine_flutter/features/coach/presentation/today_summary.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    await FoodPhotoResolver.load();
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  testWidgets('capture expanded summary in the real coach page', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(780, 1800);
    tester.view.devicePixelRatio = 2;
    addTearDown(tester.view.reset);
    final store = DemoStore(clock: () => DateTime(2026, 11, 17, 12, 30))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    await store.setMealEaten(store.today, 0, true);
    await store.setMealEaten(store.today, 1, true);
    addTearDown(store.dispose);
    const capture = ValueKey('summary-capture');
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: appTheme(),
          builder: (context, child) => MediaQuery(
            data: MediaQuery.of(context).copyWith(disableAnimations: true),
            child: Directionality(
              textDirection: TextDirection.rtl,
              child: child!,
            ),
          ),
          home: RepaintBoundary(
            key: capture,
            child: CoachPage(
              repository: MockCoachRepository(
                store: store,
                charDelay: Duration.zero,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('coach-summary-toggle')));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);

    Future<void> shot(Finder finder, String name) async {
      final context = tester.element(find.byType(MaterialApp));
      await tester.runAsync(() async {
        for (final widget in tester.widgetList<Image>(find.byType(Image))) {
          await precacheImage(widget.image, context);
        }
      });
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.runAsync(() async {
        final boundary = tester.renderObject<RenderRepaintBoundary>(finder);
        final picture = await boundary.toImage(pixelRatio: 2);
        final bytes = await picture.toByteData(format: ui.ImageByteFormat.png);
        final file = File(
          '../references/flutter-app-review/2026-11-18/summary-food-photos/$name.png',
        );
        await file.writeAsBytes(bytes!.buffer.asUint8List());
        picture.dispose();
      });
    }

    await shot(find.byKey(capture), 'coach-expanded');
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          debugShowCheckedModeBanner: false,
          theme: appTheme(),
          home: Directionality(
            textDirection: TextDirection.rtl,
            child: Scaffold(
              body: Align(
                alignment: Alignment.topCenter,
                child: RepaintBoundary(
                  key: capture,
                  child: CoachTodaySummary(
                    expanded: true,
                    onToggle: () {},
                    onRing: () {},
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await shot(find.byKey(capture), 'summary-expanded');
    await tester.pumpWidget(const SizedBox());
  });
}
