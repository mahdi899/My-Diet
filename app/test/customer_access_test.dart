import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/entry.dart';
import 'package:sabzine_flutter/presentation/screens/expert.dart';
import 'package:sabzine_flutter/presentation/screens/shared.dart';
import 'package:sabzine_flutter/presentation/widgets/ui.dart';
import 'widget_test.dart' show mobile;

void main() {
  testWidgets(
    'legacy role state cannot open a staff panel in the customer app',
    (t) async {
      mobile(t);
      final store = DemoStore()..login(AppRole.expert);
      await t.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
      );
      await t.pumpAndSettle();
      expect(find.byType(ExpertHome), findsNothing);
      expect(find.text('ورود به عنوان متخصص'), findsNothing);
      expect(
        find.widgetWithText(NavigationDestination, 'خانه'),
        findsOneWidget,
      );
      store.showRoleSelection();
      await t.pumpAndSettle();
      expect(find.byType(EntryScreen), findsNothing);
      expect(find.byType(NavigationBar), findsOneWidget);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
  testWidgets(
    'guest messages and private tabs require login without exposing records',
    (t) async {
      mobile(t);
      final store = DemoStore();
      await t.pumpWidget(
        SabzineApp(store: store, splashDuration: Duration.zero),
      );
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('پیام‌ها'));
      await t.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      expect(find.byType(MessagesScreen), findsNothing);
      await t.tap(find.byTooltip('بازگشت به داشبورد'));
      await t.pumpAndSettle();
      await t.tap(find.byType(NavigationDestination).at(2));
      await t.pumpAndSettle();
      expect(find.byType(LoginScreen), findsOneWidget);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
  testWidgets('expiry closes a private route and returns to guest dashboard', (
    t,
  ) async {
    mobile(t);
    var now = DateTime.utc(2026, 11, 1);
    final store = DemoStore(clock: () => now)..loginDemoUser();
    await t.pumpWidget(SabzineApp(store: store, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    pushPage(t.element(find.byType(PanelShell)), const MessagesScreen());
    await t.pumpAndSettle();
    expect(find.byType(MessagesScreen), findsOneWidget);
    now = now.add(const Duration(days: 30));
    store.update();
    await t.pumpAndSettle();
    expect(store.hasUserRequest, false);
    expect(find.byType(MessagesScreen), findsNothing);
    expect(store.userSignedIn, false);
    await t.pumpWidget(const SizedBox());
    store.dispose();
  });
}
