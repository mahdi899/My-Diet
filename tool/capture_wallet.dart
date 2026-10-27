// flutter test tool/capture_wallet.dart --update-goldens --no-pub
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/widgets/ui.dart';
import '../test/wallet_flow_test.dart' show tapWallet;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    final fonts = FontLoader('Vazirmatn')
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
      ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf'));
    await fonts.load();
    final icons = FontLoader('MaterialIcons')
      ..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'));
    await icons.load();
  });
  testWidgets('Capture the real mock-wallet purchase and recharge flow', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.resetPhysicalSize);
    addTearDown(t.view.resetDevicePixelRatio);
    final s = DemoStore();
    s.login(AppRole.user);
    s.questionnaireComplete = true;
    s.questionnaire.consent = true;
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    Future<void> shot(String name) async {
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../screenshots/wallet/$name.png'),
      );
    }

    await shot('00-dashboard');
    await tapWallet(t, find.byKey(const ValueKey('get-food-plan')));
    await shot('01-services-no-selection');
    await tapWallet(t, find.byKey(const ValueKey('service-new-plan')));
    await shot('02-insufficient-balance');
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'شارژ کیف پول'));
    await shot('03-token-packages');
    await tapWallet(t, find.byKey(const ValueKey('package-p200')));
    await shot('04-selected-package');
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'خرید توکن'));
    await shot('05-mock-gateway');
    await tapWallet(t, find.text('پرداخت ناموفق / انصراف'));
    await shot('06-payment-failed');
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'خرید توکن'));
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'پرداخت موفق'));
    await shot('07-recharge-success');
    await tapWallet(t, find.widgetWithText(FilledButton, 'باشه'));
    await shot('08-sufficient-balance');
    await tapWallet(t, find.widgetWithText(PrimaryButton, 'برداشت از کیف پول'));
    await shot('09-service-success');
    await tapWallet(t, find.widgetWithText(TextButton, 'باشه'));
    await shot('10-dashboard-after-purchase');
    await tapWallet(t, find.byKey(const ValueKey('get-food-plan')));
    await tapWallet(t, find.text('ابزار تست کیف پول'));
    await t.ensureVisible(find.byKey(const ValueKey('wallet-debug-balance')));
    await t.pumpAndSettle();
    await shot('11-debug-panel');
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    await t.pump();
    s.dispose();
  });
}
