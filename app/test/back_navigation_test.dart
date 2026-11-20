import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/coach_launcher.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';

import 'widget_test.dart' show mobile;

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> start(WidgetTester tester) async {
    mobile(tester);
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    await tester.pumpWidget(SabzineApp(store: store));
    await tester.pumpAndSettle();
  }

  Future<void> back(WidgetTester tester) async {
    await tester.binding.handlePopRoute();
    await tester.pumpAndSettle();
  }

  testWidgets('system back from chat and plan returns home without exiting', (
    tester,
  ) async {
    await start(tester);
    for (final key in ['tab-coach', 'tab-plan']) {
      await tester.tap(find.byKey(ValueKey(key)));
      await tester.pumpAndSettle();
      await back(tester);
      expect(find.byKey(const ValueKey('shell-page-1')), findsOneWidget);
      expect(find.byType(AlertDialog), findsNothing);
    }
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'home exits only after yes and both no and back dismiss the dialog',
    (tester) async {
      var exits = 0;
      final messenger =
          TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger;
      messenger.setMockMethodCallHandler(SystemChannels.platform, (call) async {
        if (call.method == 'SystemNavigator.pop') exits++;
        return null;
      });
      addTearDown(
        () => messenger.setMockMethodCallHandler(SystemChannels.platform, null),
      );
      await start(tester);
      await back(tester);
      expect(find.text('می‌خوای از اپ خارج شی؟'), findsOneWidget);
      expect(exits, 0);
      await tester.tap(find.text('نه'));
      await tester.pumpAndSettle();
      expect(find.byType(AlertDialog), findsNothing);
      expect(exits, 0);
      await back(tester);
      await back(tester);
      expect(find.byType(AlertDialog), findsNothing);
      expect(exits, 0);
      await back(tester);
      await tester.tap(find.text('بله'));
      await tester.pumpAndSettle();
      expect(exits, 1);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  testWidgets('back closes chat history before leaving the chat', (
    tester,
  ) async {
    await start(tester);
    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('coach-history')));
    await tester.pumpAndSettle();
    expect(find.byType(Drawer), findsOneWidget);
    await back(tester);
    expect(find.byType(CoachPage), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    await back(tester);
    expect(find.byKey(const ValueKey('shell-page-1')), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('a separately opened coach returns to home on system back', (
    tester,
  ) async {
    await start(tester);
    await tester.tap(find.byKey(const ValueKey('tab-plan')));
    await tester.pumpAndSettle();
    openCoach(tester.element(find.byType(PanelShell)));
    await tester.pumpAndSettle();
    expect(find.byType(CoachPage), findsOneWidget);
    await back(tester);
    expect(find.byType(CoachPage), findsNothing);
    expect(find.byKey(const ValueKey('shell-page-1')), findsOneWidget);
    expect(find.byType(AlertDialog), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });
}
