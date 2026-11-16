import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/core/network/api_client.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/session/services.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/domain/common/failure.dart';
import 'package:sabzine_flutter/domain/plan/plan.dart';
import 'package:sabzine_flutter/features/plan/plan_states.dart';
import 'package:sabzine_flutter/features/plan/plan_tab.dart';
import 'package:sabzine_flutter/presentation/session/live_session.dart';
import 'session/home_test.dart'
    show FakeCommerce, FakePlans, liveStore, requestWith;

class FaultPlans extends FakePlans {
  bool failRequest = false, failPublished = false;
  @override
  Future<PlanRequestInfo?> latestRequest() async {
    if (failRequest) {
      throw const ApiException('ارتباط قطع شد؛ دوباره تلاش کن.', offline: true);
    }
    return super.latestRequest();
  }

  @override
  Future<PublishedPlan?> publishedPlan() async {
    if (failPublished) {
      throw const ApiException('دریافت برنامه انجام نشد.', offline: true);
    }
    return super.publishedPlan();
  }
}

class RetryCheckout extends FakeCommerce implements PlanCheckoutRepository {
  bool pending = true;
  final keys = <String>[];
  @override
  Future<PlanCheckout> startCheckout({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
    String? planId,
  }) async {
    keys.add(idempotencyKey);
    if (pending) {
      throw const AppFailure('نتیجه هنوز مشخص نیست.', code: 'payment_pending');
    }
    return const PlanCheckout(status: 'paid');
  }

  @override
  Future<PlanCheckout> checkoutStatus(String paymentId) =>
      throw UnimplementedError();
  @override
  Future<PlanCheckout> completeCheckoutSandbox(
    String paymentId, {
    required bool success,
  }) => throw UnimplementedError();
  @override
  Future<PlanSubscription?> subscription() async => null;
  @override
  Future<List<PlanPurchase>> purchases() async => [];
}

Widget statusHost(DemoStore store, Widget child, {double scale = 1}) =>
    DemoScope(
      store: store,
      child: MaterialApp(
        theme: appTheme(),
        debugShowCheckedModeBanner: false,
        builder: (context, child) => MediaQuery(
          data: MediaQuery.of(context).copyWith(
            disableAnimations: true,
            textScaler: TextScaler.linear(scale),
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: child!,
          ),
        ),
        home: Scaffold(body: child),
      ),
    );

void main() {
  test(
    'failed refresh retains the actual request and previous published cache',
    () async {
      final plans = FaultPlans()..request = requestWith('queued');
      final store = liveStore(FakeCommerce(), plans);
      addTearDown(store.dispose);
      await refreshLive(store);
      final request = store.userRequest;
      store.serverMealUids['saved-meal'] = 'uid';
      plans.failRequest = true;
      await refreshLive(store);
      expect(identical(store.userRequest, request), isTrue);
      expect(store.serverMealUids['saved-meal'], 'uid');
      expect(store.liveNotice, contains('ارتباط قطع شد'));
      plans.failRequest = false;
      plans.failPublished = true;
      await refreshLive(store);
      expect(identical(store.userRequest, request), isTrue);
      expect(store.liveNotice, 'دریافت برنامه انجام نشد.');
      plans.failPublished = false;
      await refreshLive(store);
      expect(store.liveNotice, isNull);
      expect(store.userRequest.status, PlanStatus.queued);
    },
  );

  testWidgets(
    'first-load failure has a working retry rather than an endless skeleton',
    (t) async {
      t.view.physicalSize = const Size(320, 720);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final plans = FaultPlans()..failRequest = true;
      final store = liveStore(FakeCommerce(), plans);
      await refreshLive(store);
      expect(store.liveReady, isFalse);
      await t.pumpWidget(statusHost(store, const PlanTab(), scale: 1.5));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('plan-error')), findsOneWidget);
      expect(find.byKey(const ValueKey('plan-skeleton')), findsNothing);
      plans.failRequest = false;
      plans.request = requestWith('queued');
      await t.ensureVisible(find.text('تلاش دوباره'));
      await t.tap(find.text('تلاش دوباره'));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('plan-error')), findsNothing);
      expect(find.text('درخواستت ثبت شده'), findsOneWidget);
      expect(store.hasUserRequest, isTrue);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'generation, review, missing info and publication stay tied to actual state',
    (t) async {
      final store = DemoStore()..loginDemoUser();
      final request = store.userRequest;
      request.question = 'به چه غذایی حساسیت داری؟';
      await t.pumpWidget(
        statusHost(
          store,
          const SingleChildScrollView(child: PlanProgressCard()),
        ),
      );
      for (final entry in {
        PlanStatus.generating: 'برنامه‌ات در حال آماده‌سازی است',
        PlanStatus.reviewing: 'در حال بررسی متخصص',
        PlanStatus.needsInfo: 'متخصص منتظر پاسخ توست',
        PlanStatus.ready: 'در حال دریافت نسخهٔ منتشرشده',
      }.entries) {
        request.status = entry.key;
        store.update();
        await t.pumpAndSettle();
        await t.pump(const Duration(seconds: 6));
        expect(find.text(entry.value), findsOneWidget);
        expect(find.text('برنامه‌ات آماده است'), findsNothing);
        expect(request.isPublished, isFalse);
      }
      request.status = PlanStatus.needsInfo;
      request.infoAnswer = 'حساسیتی ندارم.';
      store.update();
      await t.pumpAndSettle();
      expect(find.text('اطلاعات تکمیلی در حال بررسی است'), findsOneWidget);
      expect(find.text('متخصص منتظر پاسخ توست'), findsNothing);
      request.infoAnswerReviewed = true;
      store.approveActiveUserRequest();
      await t.pumpAndSettle();
      expect(find.text('برنامه‌ات آماده است'), findsOneWidget);
      expect(request.isPublished, isTrue);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  test(
    'pending payment exposes its exact state and recovery reuses the same order key',
    () async {
      final commerce = RetryCheckout();
      final plans = FaultPlans()..request = requestWith('queued');
      final store = liveStore(commerce, plans);
      final services = store.liveServices!;
      store.liveServices = Services(
        onboarding: services.onboarding,
        commerce: commerce,
        plans: plans,
      );
      addTearDown(store.dispose);
      await syncLiveCatalog(store);
      String? failureCode;
      expect(
        await checkoutLiveService(
          store,
          'new-plan',
          confirmSandbox: () async => false,
          onFailure: (f) => failureCode = f.code,
        ),
        isFalse,
      );
      expect(failureCode, 'payment_pending');
      final key = store.liveOrderKey;
      expect(key, isNotNull);
      commerce.pending = false;
      expect(
        await checkoutLiveService(
          store,
          'new-plan',
          confirmSandbox: () async => false,
        ),
        isTrue,
      );
      expect(commerce.keys, [key, key]);
      expect(store.liveOrderKey, isNull);
      expect(store.userRequest.status, PlanStatus.queued);
      expect(store.userRequest.isPublished, isFalse);
    },
  );
}
