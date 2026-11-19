import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/presentation/profile_sheet.dart';
import 'package:sabzine_flutter/presentation/screens/privacy.dart';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final signedIn in [false, true]) {
    testWidgets('privacy opens from profile (signed in: $signedIn)', (
      tester,
    ) async {
      tester.view.physicalSize = const Size(320, 740);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final store = DemoStore();
      if (signedIn) store.login(AppRole.user);
      await tester.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            theme: appTheme(),
            builder: (context, child) => MediaQuery(
              data: MediaQuery.of(
                context,
              ).copyWith(textScaler: const TextScaler.linear(1.8)),
              child: Directionality(
                textDirection: TextDirection.rtl,
                child: child!,
              ),
            ),
            home: const Scaffold(body: CoachProfileSheet()),
          ),
        ),
      );
      await tester.pumpAndSettle();
      await tester.scrollUntilVisible(
        find.text('حریم خصوصی'),
        250,
        scrollable: find.byType(Scrollable).first,
      );
      await tester.pumpAndSettle();
      await tester.ensureVisible(find.text('حریم خصوصی'));
      await tester.pumpAndSettle();
      expect(find.text('گفت‌وگو با متخصص انسانی'), findsNothing);
      await tester.tap(find.text('حریم خصوصی'));
      await tester.pumpAndSettle();
      expect(find.byType(PrivacyScreen), findsOneWidget);
      await tester.scrollUntilVisible(
        find.text('کنترل اطلاعاتت'),
        250,
        scrollable: find.descendant(
          of: find.byKey(const ValueKey('privacy-page')),
          matching: find.byType(Scrollable),
        ),
      );
      expect(tester.takeException(), isNull);
      await tester.pageBack();
      await tester.pumpAndSettle();
      expect(find.byType(CoachProfileSheet), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    });
  }
}
