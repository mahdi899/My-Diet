import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/application/commerce/settle_checkout.dart';
import 'package:sabzine_flutter/domain/commerce/commerce.dart';
import 'package:sabzine_flutter/domain/common/failure.dart';
import 'package:sabzine_flutter/data/commerce/http_commerce_repository.dart';
import 'package:sabzine_flutter/core/network/api_client.dart';

class CheckoutApiStub implements ApiClient {
  final paths = <String>[];
  Map<String, dynamic>? checkoutBody;
  Map<String, String>? checkoutHeaders;
  @override
  Future<dynamic> get(String path) async {
    paths.add(path);
    return switch (path) {
      'me/subscription' => {
        'subscription': {
          'title': 'همراه',
          'status': 'active',
          'endsAt': '2026-12-15T00:00:00Z',
          'includedChanges': true,
        },
      },
      'me/orders' => [
        {
          'id': 'order-1',
          'title': 'همراه',
          'priceToman': 1990000,
          'status': 'paid',
        },
      ],
      _ => throw StateError('Unexpected request: $path'),
    };
  }

  @override
  Future<dynamic> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String> headers = const {},
  }) async {
    paths.add(path);
    checkoutBody = body;
    checkoutHeaders = headers;
    return {
      'status': 'pending',
      'paymentId': 'payment-1',
      'gateway': 'zarinpal',
      'redirectUrl': 'https://gateway.test/pay',
    };
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

class CheckoutStub implements PlanCheckoutRepository {
  String gateway = 'zarinpal', initialStatus = 'pending';
  List<String> results = ['pending', 'paid'];
  final keys = <String>[];
  int completions = 0;

  @override
  Future<PlanCheckout> startCheckout({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
    String? planId,
  }) async {
    keys.add(idempotencyKey);
    return PlanCheckout(
      status: initialStatus,
      gateway: gateway,
      paymentId: 'payment-1',
      redirectUrl: 'https://gateway.test/pay',
    );
  }

  @override
  Future<PlanCheckout> checkoutStatus(String paymentId) async =>
      PlanCheckout(status: results.removeAt(0));

  @override
  Future<PlanCheckout> completeCheckoutSandbox(
    String paymentId, {
    required bool success,
  }) async {
    completions++;
    return PlanCheckout(status: success ? 'paid' : 'failed');
  }

  @override
  Future<List<PlanPurchase>> purchases() async => [];
  @override
  Future<PlanSubscription?> subscription() async => null;
}

void main() {
  test(
    'Repository sends selected plan and restores subscription without a wallet request',
    () async {
      final api = CheckoutApiStub();
      final commerce = HttpCommerceRepository(api);
      await commerce.startCheckout(
        serviceCode: 'new_plan',
        expectedPriceToman: 1990000,
        idempotencyKey: 'same-attempt',
        planId: 'monthly',
      );
      expect(api.checkoutBody, {
        'serviceCode': 'new_plan',
        'expectedPriceToman': 1990000,
        'planId': 'monthly',
      });
      expect(api.checkoutHeaders, {'Idempotency-Key': 'same-attempt'});
      final subscription = await commerce.subscription();
      expect(subscription!.title, 'همراه');
      expect(subscription.activeAt(DateTime.utc(2026, 11, 15)), isTrue);
      expect(subscription.activeAt(DateTime.utc(2026, 12, 15)), isFalse);
      expect(subscription.includedChanges, isTrue);
      expect((await commerce.purchases()).single.priceToman, 1990000);
      expect(api.paths, ['me/checkouts', 'me/subscription', 'me/orders']);
    },
  );
  test(
    'Hosted checkout waits for verified payment and reuses attempt key',
    () async {
      final commerce = CheckoutStub();
      final opened = <Uri>[];
      await settleCheckout(
        commerce,
        serviceCode: 'new_plan',
        expectedPriceToman: 500000,
        idempotencyKey: 'same-attempt',
        openUrl: (url) async => opened.add(url),
        confirmSandbox: () async =>
            throw StateError('Hosted payment cannot use sandbox'),
        pollEvery: Duration.zero,
      );
      expect(opened.single.toString(), 'https://gateway.test/pay');
      expect(commerce.completions, 0);
      expect(commerce.keys, ['same-attempt']);
    },
  );

  test('Declined verification never returns a successful checkout', () async {
    final commerce = CheckoutStub()..results = ['failed'];
    await expectLater(
      settleCheckout(
        commerce,
        serviceCode: 'new_plan',
        expectedPriceToman: 500000,
        idempotencyKey: 'declined-attempt',
        openUrl: (_) async {},
        confirmSandbox: () async => true,
        pollEvery: Duration.zero,
      ),
      throwsA(
        isA<AppFailure>().having(
          (failure) => failure.code,
          'code',
          'payment_failed',
        ),
      ),
    );
  });

  test('Pending checkout stays retryable with the same key', () async {
    final commerce = CheckoutStub()..results = ['pending'];
    Future<void> checkout() => settleCheckout(
      commerce,
      serviceCode: 'new_plan',
      expectedPriceToman: 500000,
      idempotencyKey: 'retry-attempt',
      openUrl: (_) async {},
      confirmSandbox: () async => true,
      pollEvery: Duration.zero,
      attempts: 1,
    );
    await expectLater(
      checkout(),
      throwsA(
        isA<AppFailure>().having(
          (failure) => failure.code,
          'code',
          'payment_pending',
        ),
      ),
    );
    commerce.results = ['paid'];
    await checkout();
    expect(commerce.keys, ['retry-attempt', 'retry-attempt']);
  });

  test(
    'Sandbox requires user confirmation and cancellation fails checkout',
    () async {
      final commerce = CheckoutStub()..gateway = 'sandbox';
      await expectLater(
        settleCheckout(
          commerce,
          serviceCode: 'new_plan',
          expectedPriceToman: 500000,
          idempotencyKey: 'sandbox-attempt',
          confirmSandbox: () async => false,
        ),
        throwsA(
          isA<AppFailure>().having(
            (failure) => failure.code,
            'code',
            'payment_failed',
          ),
        ),
      );
      expect(commerce.completions, 1);
    },
  );

  test('An already paid checkout never opens a second gateway', () async {
    final commerce = CheckoutStub()..initialStatus = 'paid';
    await settleCheckout(
      commerce,
      serviceCode: 'new_plan',
      expectedPriceToman: 500000,
      idempotencyKey: 'paid-attempt',
      confirmSandbox: () async => throw StateError('Already paid'),
    );
    expect(commerce.completions, 0);
  });
}
