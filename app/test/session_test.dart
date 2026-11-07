import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/session_storage.dart';
import 'package:sabzine_flutter/screens/entry.dart';
import 'package:sabzine_flutter/screens/onboarding.dart';
import 'package:sabzine_flutter/screens/wallet_flow.dart';
import 'widget_test.dart' show mobile;

class MemorySession implements SessionStorage {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String next) async {
    value = next;
  }

  @override
  Future<void> clear() async {
    value = null;
  }
}

void main() {
  test(
    'Thirty day session survives restart, does not slide, expires at exact boundary and logout clears it',
    () async {
      final issued = DateTime.utc(2026, 10, 28, 9);
      var now = issued;
      final memory = MemorySession();
      final first = DemoStore(sessionStorage: memory, clock: () => now);
      first.login(AppRole.user, phone: '09123456789');
      await first.saveUserSession();
      expect(first.sessionExpiresAt, issued.add(const Duration(days: 30)));
      now = issued.add(const Duration(days: 29, hours: 23));
      final resumed = DemoStore(sessionStorage: memory, clock: () => now);
      await resumed.restoreUserSession();
      expect(resumed.userSignedIn, true);
      expect(resumed.sessionPhone, '09123456789');
      expect(resumed.sessionExpiresAt, first.sessionExpiresAt);
      now = issued.add(const Duration(days: 30));
      expect(resumed.userSignedIn, false);
      final expired = DemoStore(sessionStorage: memory, clock: () => now);
      await expired.restoreUserSession();
      expect(expired.userSignedIn, false);
      expect(memory.value, isNull);
      expired.login(AppRole.user);
      await expired.saveUserSession();
      expired.logout();
      await expired.saveUserSession();
      expect(memory.value, isNull);
      expect(expired.entryStage, EntryStage.home);
      expect(expired.userSignedIn, false);
      first.dispose();
      resumed.dispose();
      expired.dispose();
    },
  );

  test(
    'Corrupted, future-issued or extended session never authenticates',
    () async {
      final now = DateTime.utc(2026, 10, 28), memory = MemorySession();
      for (final raw in [
        '{broken',
        jsonEncode({
          'version': 1,
          'issuedAt': now.add(const Duration(days: 1)).toIso8601String(),
          'expiresAt': now.add(const Duration(days: 31)).toIso8601String(),
        }),
        jsonEncode({
          'version': 1,
          'issuedAt': now.toIso8601String(),
          'expiresAt': now.add(const Duration(days: 90)).toIso8601String(),
        }),
      ]) {
        memory.value = raw;
        final s = DemoStore(sessionStorage: memory, clock: () => now);
        await s.restoreUserSession();
        expect(s.userSignedIn, false);
        s.dispose();
      }
    },
  );

  testWidgets(
    'Guest opens dashboard without form; purchase asks login first; cancel returns guest home',
    (t) async {
      mobile(t);
      final s = DemoStore();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      expect(find.byType(LoginScreen), findsNothing);
      expect(find.byType(OnboardingScreen), findsNothing);
      expect(find.text('امروز هم برای خودت قدم بردار'), findsNothing);
      expect(find.byType(TextFormField), findsNothing);
      final request = find.byKey(const ValueKey('get-food-plan'));
      await t.ensureVisible(request);
      await t.tap(request);
      await t.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(OnboardingScreen), findsNothing);
      await t.tap(find.byTooltip('بازگشت به داشبورد'));
      await t.pumpAndSettle();
      expect(find.byType(NavigationBar), findsOneWidget);
      expect(s.pendingPlanAcquisition, false);
      await t.ensureVisible(request);
      await t.tap(request);
      await t.pumpAndSettle();
      await t.tap(find.text('ورود مستقیم با حساب نمایشی'));
      await t.pumpAndSettle();
      expect(find.byType(OnboardingScreen), findsOneWidget);
      expect(s.userSignedIn, true);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );

  testWidgets(
    'Restored session skips login on purchase and expired foreground session asks again',
    (t) async {
      mobile(t);
      var now = DateTime.utc(2026, 10, 28);
      final memory = MemorySession();
      final first = DemoStore(sessionStorage: memory, clock: () => now)
        ..login(AppRole.user);
      await first.saveUserSession();
      now = now.add(const Duration(days: 10));
      final s = DemoStore(sessionStorage: memory, clock: () => now)
        ..questionnaireComplete = true;
      await s.restoreUserSession();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      final request = find.byKey(const ValueKey('get-food-plan'));
      await t.ensureVisible(request);
      await t.tap(request);
      await t.pumpAndSettle();
      expect(find.byType(PlanServicesScreen), findsOneWidget);
      expect(find.byType(LoginScreen), findsNothing);
      // Back to dashboard, then let the session expire without restarting the app.
      Navigator.of(t.element(find.byType(PlanServicesScreen))).pop();
      await t.pumpAndSettle();
      now = DateTime.utc(2026, 11, 27);
      await t.ensureVisible(request);
      await t.tap(request);
      await t.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(s.userSignedIn, false);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      first.dispose();
      s.dispose();
    },
  );
}
