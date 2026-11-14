import 'package:sabzine_flutter/application/commerce/settle_topup.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/presentation/session/live_session.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/core/network/api_client.dart';
import 'package:sabzine_flutter/domain/onboarding/onboarding.dart';
import 'package:sabzine_flutter/domain/onboarding/spec.dart';
import 'package:sabzine_flutter/domain/plan/plan.dart';
import 'package:sabzine_flutter/data/session/services.dart';

class _Memory implements AuthTokenStorage {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
  @override
  Future<void> clear() async {}
}

class FakeCommerce implements CommerceRepository {
  FakeCommerce({this.balance = 0});
  int balance;
  final orders = <String>[];
  final topups = <String>[];
  bool hosted = false;
  bool failOffline = false;
  int statusPolls = 0;

  @override
  Future<Catalog> catalog() async => const Catalog(
    services: [
      ServiceOffer(code: 'new_plan', title: 'برنامه', priceToman: 490000),
    ],
    topups: [
      TopupPackage(code: 'p1', amountToman: 500000),
      TopupPackage(code: 'p2', amountToman: 1000000),
    ],
  );

  @override
  Future<Wallet> wallet() async => Wallet(cashToman: balance, promoToman: 0);

  @override
  Future<List<String>> gateways() async =>
      hosted ? ['sandbox', 'zarinpal'] : ['sandbox'];

  @override
  Future<TopupStart> startTopup(String packageCode, {String? gateway}) async {
    topups.add(packageCode);
    if (gateway == 'zarinpal') {
      return const TopupStart(
        paymentId: 'pay-2',
        gateway: 'zarinpal',
        redirectUrl: 'https://pay.example/StartPay/A1',
      );
    }
    return const TopupStart(paymentId: 'pay-1', gateway: 'sandbox');
  }

  @override
  Future<Wallet> completeSandbox(String paymentId) async {
    balance += 500000;
    return wallet();
  }

  @override
  Future<String> topupStatus(String paymentId) async {
    statusPolls++;
    if (statusPolls < 2) return 'pending';
    balance += 500000;
    return 'credited';
  }

  @override
  Future<OrderResult> placeOrder({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
  }) async {
    if (failOffline) {
      failOffline = false;
      throw const ApiException('ارتباط قطع شد', offline: true);
    }
    orders.add(idempotencyKey);
    balance -= expectedPriceToman;
    return const OrderResult(orderId: 'o1', requestId: 'r1');
  }
}

class FakePlans implements PlanRepository {
  PlanRequestInfo? request;
  PublishedPlan? plan;
  final answers = <String, String>{};

  @override
  Future<PlanRequestInfo?> latestRequest() async => request;
  @override
  Future<PublishedPlan?> publishedPlan() async => plan;
  @override
  Future<void> setEaten(String mealUid, bool value) async {}
  @override
  Future<void> answerQuestion(String questionId, String body) async {
    answers[questionId] = body;
  }

  @override
  Future<ShoppingList> shopping(String weekStart) async => ShoppingList(
    weekStart: weekStart,
    revision: 1,
    items: const [],
    incomplete: false,
  );
  @override
  Future<ShoppingList> flagShopping(
    String weekStart,
    ShoppingItem item,
    int revision, {
    required bool alreadyHave,
    required bool purchased,
  }) => shopping(weekStart);
}

class _Onboarding implements OnboardingRepository {
  @override
  Future<void> consent() async {}
  @override
  Future<OnboardingSpec> spec() => throw UnimplementedError();
  @override
  Future<OnboardingState> state() => throw UnimplementedError();
  @override
  Future<int> saveDraft({
    String? track,
    required Map<String, Object?> patch,
    String? stepKey,
    int? progress,
    int? baseVersion,
  }) => throw UnimplementedError();
  @override
  Future<ProfileSummary> submit({required Map<String, Object?> patch}) =>
      throw UnimplementedError();
}

PlanRequestInfo requestWith(
  String status, {
  List<Map<String, dynamic>> questions = const [],
}) => PlanRequestInfo.fromJson({
  'id': 'r1',
  'status': status,
  'kind': 'new',
  'questions': questions,
});

DemoStore liveStore(FakeCommerce commerce, FakePlans plans) {
  final store = DemoStore(
    customerAuth: CustomerAuth(
      baseUrl: 'http://x',
      storage: _Memory(),
      client: MockClient((_) async => http.Response('{}', 200)),
    ),
  );
  store.liveServices = Services(
    onboarding: _Onboarding(),
    commerce: commerce,
    plans: plans,
  );
  store.questionnaire.name = 'مهدی';
  return store;
}

void main() {
  test('sandbox top-up credits the wallet', () async {
    final commerce = FakeCommerce();
    final wallet = await settleTopup(commerce, 'p1');
    expect(commerce.topups, ['p1']);
    expect(wallet.total, 500000);
  });

  test('hosted gateway opens the page and waits for credit', () async {
    final commerce = FakeCommerce()..hosted = true;
    final opened = <Uri>[];
    final wallet = await settleTopup(
      commerce,
      'p1',
      openUrl: (uri) async => opened.add(uri),
      pollEvery: Duration.zero,
    );
    expect(opened.single.toString(), 'https://pay.example/StartPay/A1');
    expect(commerce.statusPolls, greaterThanOrEqualTo(2));
    expect(wallet.total, 500000);
  });

  test(
    'a plan purchase uses one idempotency key and then shows the request',
    () async {
      final commerce = FakeCommerce(balance: 600000);
      final plans = FakePlans();
      final store = liveStore(commerce, plans);
      await syncLiveCatalog(store);
      expect(store.newPlanPrice, 490000);
      expect(store.walletBalance, 600000);

      commerce.failOffline = true;
      expect(await buyLiveService(store, 'new-plan'), isFalse);
      final key = store.liveOrderKey;
      expect(key, isNotNull);
      expect(commerce.orders, isEmpty);

      plans.request = requestWith('queued');
      expect(await buyLiveService(store, 'new-plan'), isTrue);
      expect(commerce.orders, [key]);
      expect(store.liveReady, isTrue);
      expect(store.userRequest.status, PlanStatus.queued);
      expect(store.hasUserRequest, isTrue);
    },
  );

  test(
    'an open doctor question can be answered from the original home data',
    () async {
      final plans = FakePlans()
        ..request = requestWith(
          'awaiting_user',
          questions: [
            {
              'id': 'q1',
              'prompt': 'آلرژی به گردو داری؟',
              'required': true,
              'status': 'open',
            },
          ],
        );
      final store = liveStore(FakeCommerce(balance: 1), plans);
      await refreshLive(store);
      expect(store.liveOpenQuestions.single.prompt, 'آلرژی به گردو داری؟');
      expect(store.userRequest.status, PlanStatus.needsInfo);

      plans.request = requestWith('in_review');
      expect(await answerLiveQuestion(store, 'q1', 'نه'), isTrue);
      expect(plans.answers['q1'], 'نه');
      expect(store.liveOpenQuestions, isEmpty);
      expect(store.userRequest.status, PlanStatus.reviewing);
    },
  );
}
