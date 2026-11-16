// Real Flutter widgets; explicit sample recipe and fake transport only.
import 'dart:io';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:shared_preferences_platform_interface/shared_preferences_async_platform_interface.dart';
import 'package:shared_preferences_platform_interface/in_memory_shared_preferences_async.dart';
import 'package:sabzine_flutter/core/photos/photos.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/plan/cooking_page.dart';
import 'package:sabzine_flutter/features/plan/plan_tab.dart';
import 'package:sabzine_flutter/presentation/screens/wallet_flow.dart';
import 'package:sabzine_flutter/presentation/onboarding/widgets/plan_theater.dart';
import 'package:sabzine_flutter/presentation/session/live_session.dart';
import '../../../app/test/cooking_mode_test.dart'
    show cookingMeal, cookingHost, tapCooking;
import '../../../app/test/operation_states_test.dart' show FaultPlans, statusHost;
import '../../../app/test/session/home_test.dart'
    show FakeCommerce, liveStore, requestWith;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
    SharedPreferencesAsyncPlatform.instance =
        InMemorySharedPreferencesAsync.empty();
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
    await (FontLoader(
      'MaterialIcons',
    )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
    await FoodPhotoResolver.load();
  });
  testWidgets(
    'capture cooking, real waiting/error recovery, payment failure and submission',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      const key = ValueKey('capture-cooking-status');
      Future<void> mount(Widget child) async {
        await t.pumpWidget(RepaintBoundary(key: key, child: child));
        await t.pumpAndSettle();
      }

      Future<void> shot(String name) async {
        expect(t.takeException(), isNull);
        await t.runAsync(() async {
          final boundary = t.renderObject<RenderRepaintBoundary>(
            find.byKey(key),
          );
          final picture = await boundary.toImage(pixelRatio: 2);
          final data = await picture.toByteData(format: ui.ImageByteFormat.png);
          final file = File(
            '../references/flutter-app-review/2026-11-16/$name.png',
          );
          await file.parent.create(recursive: true);
          await file.writeAsBytes(data!.buffer.asUint8List());
          picture.dispose();
        });
      }

      await mount(cookingHost(const CookingPage(meal: cookingMeal)));
      await shot('cooking');
      await tapCooking(t, find.byKey(const ValueKey('cooking-add-timer')));
      await t.tap(find.text('شروع تایمر'));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('cooking-timer')),
        100,
        scrollable: find.byType(Scrollable).first,
      );
      await t.pumpAndSettle();
      await shot('cooking-timer');
      await t.pumpWidget(const SizedBox());
      final plans = FaultPlans()..request = requestWith('in_review');
      final store = liveStore(FakeCommerce(), plans);
      await refreshLive(store);
      await mount(statusHost(store, const PlanTab()));
      await shot('specialist-review');
      await t.pumpWidget(const SizedBox());
      store.dispose();
      final failed = FaultPlans()..failRequest = true;
      final failedStore = liveStore(FakeCommerce(), failed);
      await refreshLive(failedStore);
      await mount(statusHost(failedStore, const PlanTab()));
      await shot('plan-error');
      await t.pumpWidget(const SizedBox());
      failedStore.dispose();
      final paymentStore = DemoStore()..loginDemoUser();
      paymentStore.questionnaireComplete = true;
      paymentStore.userRequestId = null;
      await mount(statusHost(paymentStore, const PlanServicesScreen()));
      await tapCooking(t, find.byKey(const ValueKey('plan-monthly')));
      await t.tap(find.text('پرداخت و فعال‌سازی پلن'));
      await t.pumpAndSettle();
      await t.tap(find.text('پرداخت ناموفق / انصراف'));
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('payment-error')),
        200,
        scrollable: find.byType(Scrollable).first,
      );
      await t.pumpAndSettle();
      await shot('payment-error');
      await t.pumpWidget(const SizedBox());
      paymentStore.dispose();
      await mount(
        cookingHost(const Scaffold(body: SafeArea(child: PlanBuildTheater()))),
      );
      await shot('registering-answers');
      await t.pumpWidget(const SizedBox());
    },
  );
}
