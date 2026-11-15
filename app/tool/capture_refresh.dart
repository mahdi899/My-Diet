import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/screens/user.dart';
import 'package:sabzine_flutter/presentation/screens/pricing_admin.dart';
import 'package:sabzine_flutter/presentation/screens/wallet_flow.dart';
import '../test/wallet_flow_test.dart' show tapPlan;
import '../test/ui_refresh_test.dart' show completeProgram;

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
  testWidgets('Capture updated real Flutter panels', (t) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = DemoStore(clock: () => DateTime(2026, 10, 28))
      ..loginDemoUser()
      ..questionnaireComplete = true;
    s.approveActiveUserRequest();
    await s.setMealEaten(s.today, 0, true);
    Future<void> shot(String name) async {
      await t.pumpAndSettle();
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../../references/screenshots/refresh/$name.png'),
      );
    }

    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    await shot('01-home');
    await Scrollable.ensureVisible(
      t.element(find.byTooltip('پیام به متخصص')),
      alignment: .3,
    );
    await shot('02-reviews');
    await t.tap(find.byType(NavigationDestination).at(2));
    await shot('03-tracking');
    await t.tap(find.byType(NavigationDestination).at(3));
    await shot('04-profile');
    await Scrollable.ensureVisible(
      t.element(find.text('درباره برنامه')),
      alignment: .1,
    );
    await shot('05-about');
    s.login(AppRole.admin);
    await shot('06-admin');
    final nav = Navigator.of(t.element(find.byType(Scaffold).first));
    nav.push(
      MaterialPageRoute<void>(builder: (_) => const PricingAdminScreen()),
    );
    await shot('07-prices');
    nav.pop();
    await t.pumpAndSettle();
    s.login(AppRole.user);
    await t.pumpAndSettle();
    Navigator.of(
      t.element(find.byType(Scaffold).first),
    ).push(MaterialPageRoute<void>(builder: (_) => const PlanServicesScreen()));
    await shot('08-wallet');
    await t.pumpWidget(const SizedBox());
    s.dispose();
    final done = DemoStore(clock: () => DateTime(2026, 10, 30))
      ..loginDemoUser()
      ..questionnaireComplete = true;
    done.approveActiveUserRequest();
    await completeProgram(done);
    await t.pumpWidget(SabzineApp(store: done, splashDuration: Duration.zero));
    await shot('09-reward');
    await tapPlan(t, find.text('ثبت بازخورد این هفته'));
    await shot('10-feedback');
    expect(find.byType(ProgramReviewSubmitScreen), findsOneWidget);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    done.dispose();
  });
}
