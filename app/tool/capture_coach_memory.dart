// flutter test tool/capture_coach_memory.dart --update-goldens
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/presentation/workspace_pages.dart';
import 'capture_coach_workspace.dart' show message;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
  });

  testWidgets('capture the implemented memory design', (t) async {
    // ignore: invalid_use_of_visible_for_testing_member
    SharedPreferences.setMockInitialValues({});
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    final repo = MockCoachRepository(store: store);
    await repo.persist([
      message('q1', 'برای شام غذای ساده و سریع می‌خوام.', 'user', 10),
      message(
        'a1',
        'یادم می‌مونه که زمان کمی برای آشپزی داری.',
        'assistant',
        11,
      ),
      for (var i = 0; i < 7; i++)
        message('recent$i', 'پیام اخیر گفتگو $i', 'user', 12 + i),
    ]);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'coach.memory.${repo.workspaceOwner}',
      jsonEncode([
        {
          'id': 'like',
          'key': 'food_like',
          'value': 'عدسی و غذاهای خونگی',
          'source': 'user',
        },
        {
          'id': 'pattern',
          'key': 'pattern',
          'value': 'غذای سریع با مواد اولیه کم',
          'source': 'user',
        },
        {
          'id': 'dislike',
          'key': 'food_dislike',
          'value': 'غذاهای خیلی چرب',
          'source': 'user',
        },
      ]),
    );
    final controller = CoachController(repository: repo);
    addTearDown(controller.dispose);
    await t.pumpWidget(
      MaterialApp(
        debugShowCheckedModeBanner: false,
        theme: appTheme(),
        builder: (_, child) =>
            Directionality(textDirection: TextDirection.rtl, child: child!),
        initialRoute: '/memory',
        routes: {
          '/': (_) => const Scaffold(),
          '/memory': (_) => CoachMemoryPage(controller: controller),
        },
      ),
    );
    await t.pumpAndSettle();
    Future<void> shot(String name) async {
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile(
          '../../references/screenshots/coach-workspace/$name.png',
        ),
      );
    }

    await shot('09-memory-redesign-mobile');
    await t.drag(find.byType(ListView), const Offset(0, -700));
    await t.pumpAndSettle();
    await shot('10-memory-redesign-recap');
    // A taller viewport shows the whole implemented page in one review image.
    t.view.physicalSize = const Size(390, 1180);
    await t.pumpAndSettle();
    await t.drag(find.byType(ListView), const Offset(0, 1500));
    await t.pumpAndSettle();
    await shot('11-memory-redesign-full');
  });
}
