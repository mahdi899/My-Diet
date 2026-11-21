import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/core/network/api_client.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/session/services.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/domain/common/failure.dart';
import 'package:sabzine_flutter/domain/common/day.dart';
import 'package:sabzine_flutter/domain/plan/plan.dart';
import 'package:sabzine_flutter/features/plan/plan_states.dart';
import 'package:sabzine_flutter/presentation/widgets/brand_scene.dart';
import 'package:sabzine_flutter/presentation/session/live_session.dart';
import 'session/home_test.dart'
    show FakeCommerce, FakePlans, liveStore, requestWith;

class FaultPlans extends FakePlans {
  bool failRequest = false, failPublished = false;
  int latestCalls = 0;
  @override
  Future<PlanRequestInfo?> latestRequest() async {
    latestCalls++;
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
    String? gateway,
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
  Future<PlanCheckout> confirmStorePurchase(
    String paymentId, {
    required String productId,
    required String purchaseToken,
    String? orderId,
    String? signature,
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
  setUp(() => SharedPreferences.setMockInitialValues({}));
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

  testWidgets('plan status recovers automatically after a first-load failure', (
    t,
  ) async {
    t.view.physicalSize = const Size(320, 720);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final plans = FaultPlans()..failRequest = true;
    final store = liveStore(FakeCommerce(), plans)..login(AppRole.user);
    await refreshLive(store);
    expect(store.liveReady, isFalse);
    await t.pumpWidget(
      statusHost(store, const PanelShell(role: AppRole.user), scale: 1.5),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('tab-plan')));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('plan-error')), findsOneWidget);
    expect(find.byKey(const ValueKey('plan-skeleton')), findsNothing);
    expect(find.text('بررسی وضعیت'), findsNothing);
    expect(find.text('تلاش دوباره'), findsNothing);
    plans.failRequest = false;
    plans.request = requestWith('queued');
    await t.pump(const Duration(seconds: 8));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('plan-error')), findsNothing);
    expect(find.text('درخواستت ثبت شده'), findsOneWidget);
    expect(store.hasUserRequest, isTrue);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('online plan updates continue after publication and on resume', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 844);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final plans = FaultPlans()..request = requestWith('queued');
    final store = liveStore(FakeCommerce(), plans)..login(AppRole.user);
    addTearDown(store.dispose);
    await refreshLive(store);
    await t.pumpWidget(statusHost(store, const PanelShell(role: AppRole.user)));
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('tab-plan')));
    await t.pumpAndSettle();
    expect(find.text('درخواستت ثبت شده'), findsOneWidget);
    expect(find.text('بررسی وضعیت'), findsNothing);

    plans.request = requestWith('in_review');
    await t.pump(const Duration(seconds: 8));
    await t.pumpAndSettle();
    expect(find.text('برنامه‌ات در دست متخصص است'), findsOneWidget);

    PublishedPlan published(String title) => PublishedPlan.fromJson({
      'requestId': 'r1',
      'weekStart': dateKey(startOfWeek(store.today)),
      'days': [
        {
          'date': dateKey(store.today),
          'meals': [
            {
              'mealUid': 'live-meal',
              'mealType': 'breakfast',
              'suggestedTime': '08:00',
              'title': title,
              'calories': 400,
            },
          ],
        },
      ],
    });
    plans.request = requestWith('published');
    plans.plan = published('صبحانهٔ اول');
    await t.pump(const Duration(seconds: 8));
    await t.pumpAndSettle();
    expect(find.byKey(const ValueKey('plan-tab')), findsOneWidget);
    expect(store.userRequest.isPublished, isTrue);

    plans.plan = published('صبحانهٔ اصلاح‌شده');
    await t.pump(const Duration(seconds: 8));
    await t.pumpAndSettle();
    expect(store.mealsOn(store.today).single.title, 'صبحانهٔ اصلاح‌شده');

    plans.failRequest = true;
    await t.pump(const Duration(seconds: 8));
    await t.pumpAndSettle();
    expect(store.liveNotice, isNotNull);
    plans.failRequest = false;
    await t.pump(const Duration(seconds: 8));
    await t.pumpAndSettle();
    expect(store.liveNotice, isNull);

    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.paused);
    final pausedCalls = plans.latestCalls;
    plans.plan = published('صبحانهٔ تازه');
    await t.pump(const Duration(seconds: 24));
    expect(plans.latestCalls, pausedCalls);
    t.binding.handleAppLifecycleStateChanged(AppLifecycleState.resumed);
    await t.pumpAndSettle();
    expect(plans.latestCalls, pausedCalls + 1);
    expect(store.mealsOn(store.today).single.title, 'صبحانهٔ تازه');

    await t.tap(find.byKey(const ValueKey('tab-home')));
    await t.pumpAndSettle();
    plans.plan = published('صبحانهٔ نهایی');
    await t.tap(find.byKey(const ValueKey('tab-plan')));
    await t.pumpAndSettle();
    expect(store.mealsOn(store.today).single.title, 'صبحانهٔ نهایی');
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });

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
        PlanStatus.reviewing: 'برنامه‌ات در دست متخصص است',
        PlanStatus.needsInfo: 'متخصص منتظر پاسخ توست',
        PlanStatus.ready: 'در حال دریافت نسخهٔ منتشرشده',
      }.entries) {
        request.status = entry.key;
        store.update();
        await t.pumpAndSettle();
        await t.pump(const Duration(seconds: 6));
        expect(find.text(entry.value), findsOneWidget);
        expect(
          t.widget<BrandScene>(find.byType(BrandScene)).kind,
          switch (entry.key) {
            PlanStatus.generating ||
            PlanStatus.ready => BrandSceneKind.planBuilding,
            PlanStatus.reviewing => BrandSceneKind.specialistReview,
            _ => BrandSceneKind.needsInformation,
          },
        );
        expect(find.text('برنامه‌ات آماده است'), findsNothing);
        expect(request.isPublished, isFalse);
      }
      request.status = PlanStatus.reviewing;
      store.planAwaitingDoctor = true;
      store.update();
      await t.pumpAndSettle();
      expect(find.text('برنامه‌ات در حال تأیید توسط دکتر است'), findsOneWidget);
      expect(find.text('در حال تأیید دکتر'), findsOneWidget);
      expect(
        find.text('پیش‌نویس آماده شده و متخصص تغذیه در حال بررسی آن است.'),
        findsNothing,
      );
      store.planAwaitingDoctor = false;
      request.status = PlanStatus.needsInfo;
      request.infoAnswer = 'حساسیتی ندارم.';
      store.update();
      await t.pumpAndSettle();
      expect(find.text('اطلاعات تکمیلی در حال بررسی است'), findsOneWidget);
      expect(find.text('متخصص منتظر پاسخ توست'), findsNothing);
      expect(
        t.widget<BrandScene>(find.byType(BrandScene)).kind,
        BrandSceneKind.specialistReview,
      );
      request.infoAnswerReviewed = true;
      store.approveActiveUserRequest();
      await t.pumpAndSettle();
      expect(find.text('برنامه‌ات آماده است'), findsOneWidget);
      expect(request.isPublished, isTrue);
      expect(
        t.widget<BrandScene>(find.byType(BrandScene)).kind,
        BrandSceneKind.planReady,
      );
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
