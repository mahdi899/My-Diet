import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/testing.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/real/commerce/commerce.dart';
import 'package:sabzine_flutter/real/home/home_shell.dart';
import 'package:sabzine_flutter/real/home/topup_sheet.dart';
import 'package:sabzine_flutter/real/onboarding/repository.dart';
import 'package:sabzine_flutter/real/onboarding/spec.dart';
import 'package:sabzine_flutter/real/plan/plan.dart';
import 'package:sabzine_flutter/real/session.dart';
import 'package:sabzine_flutter/theme.dart';

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
  VoidCallback? onOrder;
  bool hosted = false;
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
    balance += 500000; // the server credited it after the gateway callback
    return 'credited';
  }

  @override
  Future<OrderResult> placeOrder({
    required String serviceCode,
    required int expectedPriceToman,
    required String idempotencyKey,
    String? parentRequestId,
  }) async {
    orders.add(idempotencyKey);
    balance -= expectedPriceToman;
    onOrder?.call();
    return const OrderResult(orderId: 'o1', requestId: 'r1');
  }
}

class FakePlans implements PlanRepository {
  PlanRequestInfo? request;
  PublishedPlan? plan;
  final eaten = <String, bool>{};

  @override
  Future<PlanRequestInfo?> latestRequest() async => request;
  @override
  Future<PublishedPlan?> publishedPlan() async => plan;
  @override
  Future<void> setEaten(String mealUid, bool value) async =>
      eaten[mealUid] = value;
  @override
  Future<void> answerQuestion(String questionId, String body) async {}
  @override
  Future<ShoppingList> shopping(String weekStart) async => const ShoppingList(
    weekStart: '2026-11-07',
    revision: 1,
    items: [],
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

PublishedPlan samplePlan() {
  final now = DateTime.now();
  String d(int add) {
    final x = now.add(Duration(days: add));
    return '${x.year}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  }

  Map<String, dynamic> option(String id, String kind, String title) => {
    'optionId': id,
    'kind': kind,
    'title': title,
    'calories': 450,
    'preparationMinutes': 20,
    'instructions': 'پخت ساده',
    'ingredients': [
      {'name': 'عدس'},
    ],
  };

  return PublishedPlan.fromJson({
    'requestId': 'r1',
    'weekStart': d(0),
    'expired': false,
    'days': [
      for (var i = 0; i < 7; i++)
        {
          'date': d(i),
          'dayIndex': i,
          'meals': [
            {
              'mealUid': 'm$i-1',
              'mealType': 'breakfast',
              'suggestedTime': '07:30',
              'title': 'نان و پنیر',
              'plannedCalories': 400,
              'loggable': i == 0,
              'selectedOptionId': 'a$i',
              'options': [
                option('a$i', 'primary', 'نان و پنیر و گردو'),
                option('b$i', 'ai_alternative', 'املت ساده'),
                option('c$i', 'specialist_alternative', 'کته کره'),
              ],
            },
            {
              'mealUid': 'm$i-2',
              'mealType': 'lunch',
              'suggestedTime': '13:00',
              'title': 'عدس‌پلو',
              'plannedCalories': 600,
              'loggable': i == 0,
              'options': [option('x$i', 'primary', 'عدس‌پلو')],
            },
          ],
        },
    ],
  });
}

Future<void> pumpShell(
  WidgetTester tester, {
  required FakeCommerce commerce,
  required FakePlans plans,
}) async {
  SharedPreferences.setMockInitialValues({});
  tester.view.physicalSize = const Size(800, 1600);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  final session = SessionController(
    CustomerAuth(
      baseUrl: 'http://x',
      storage: _Memory(),
      client: MockClient((_) async => http.Response('{}', 200)),
    ),
  );
  await tester.pumpWidget(
    MaterialApp(
      theme: appTheme(),
      builder: (context, child) =>
          Directionality(textDirection: TextDirection.rtl, child: child!),
      home: HomeShell(
        session: session,
        services: Services(
          onboarding: _Onboarding(),
          commerce: commerce,
          plans: plans,
        ),
      ),
    ),
  );
  await tester.pump(const Duration(milliseconds: 100));
  await tester.pump(const Duration(milliseconds: 600));
}

Future<void> leave(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  testWidgets('no request: wallet too low asks to top up, then pays once', (
    tester,
  ) async {
    final commerce = FakeCommerce(balance: 0);
    final plans = FakePlans();
    await pumpShell(tester, commerce: commerce, plans: plans);

    expect(find.text('سه قدم تا شروع رژیم'), findsOneWidget);
    expect(find.text('شارژ کیف پول'), findsOneWidget);
    expect(find.textContaining('۴۹۰,۰۰۰'), findsWidgets);

    await tester.tap(find.text('شارژ کیف پول'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('پرداخت'), findsOneWidget);
    await tester.tap(find.text('پرداخت'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 600));
    expect(commerce.topups, ['p1']);
    expect(commerce.balance, 500000);

    // Sheet closed, balance now covers the plan.
    expect(find.text('پرداخت از کیف پول و شروع'), findsOneWidget);
    commerce.onOrder = () => plans.request = requestWith('queued');
    await tester.tap(find.text('پرداخت از کیف پول و شروع'));
    await tester.pump(const Duration(milliseconds: 100));
    await tester.pump(const Duration(milliseconds: 600));
    expect(commerce.orders.length, 1);
    expect(find.text('درخواستت ثبت شد'), findsOneWidget);
    await leave(tester);
  });

  testWidgets('generating and in-review phases are reflected honestly', (
    tester,
  ) async {
    final plans = FakePlans()..request = requestWith('generating');
    await pumpShell(tester, commerce: FakeCommerce(balance: 1), plans: plans);
    expect(find.text('هوش مصنوعی داره برنامه‌ات رو می‌چینه'), findsOneWidget);
    expect(find.textContaining('بعد از تأیید دکتر'), findsNothing);
    await leave(tester);

    final review = FakePlans()..request = requestWith('in_review');
    await pumpShell(tester, commerce: FakeCommerce(balance: 1), plans: review);
    expect(find.text('دکتر داره برنامه‌ات رو بررسی می‌کنه'), findsOneWidget);
    expect(find.textContaining('بعد از تأیید دکتر'), findsWidgets);
    await leave(tester);
  });

  testWidgets('doctor question can be answered from the waiting screen', (
    tester,
  ) async {
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
    await pumpShell(tester, commerce: FakeCommerce(balance: 1), plans: plans);
    expect(find.text('دکتر یه سؤال داره'), findsOneWidget);
    expect(find.text('آلرژی به گردو داری؟'), findsOneWidget);
    await leave(tester);
  });

  testWidgets(
    'published plan: celebration once, then today with options and eaten toggle',
    (tester) async {
      final plans = FakePlans()
        ..request = requestWith('published')
        ..plan = samplePlan();
      await pumpShell(tester, commerce: FakeCommerce(balance: 1), plans: plans);

      expect(find.text('برنامه‌ات تأیید شد'), findsOneWidget);
      await tester.pump(const Duration(seconds: 3));
      await tester.tap(find.text('ببینم برنامه چیه'));
      await tester.pump(const Duration(milliseconds: 100));
      await tester.pump(const Duration(seconds: 1));

      expect(find.text('امروز'), findsWidgets);
      expect(find.text('نان و پنیر و گردو'), findsOneWidget);

      // Open the meal: all three approved options are visible.
      await tester.tap(find.text('نان و پنیر و گردو'));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.text('املت ساده'), findsOneWidget);
      expect(find.text('کته کره'), findsOneWidget);
      await tester.tapAt(const Offset(10, 10));
      await tester.pump(const Duration(milliseconds: 500));

      await tester.tap(find.byTooltip('خوردم').first);
      await tester.pump(const Duration(milliseconds: 100));
      expect(plans.eaten['m0-1'], isTrue);
      await leave(tester);
    },
  );

  testWidgets(
    'hosted gateway: opens the page, then waits for the server to credit',
    (tester) async {
      final commerce = FakeCommerce(balance: 0)..hosted = true;
      final opened = <Uri>[];
      openExternalUrl = (u) async => opened.add(u);
      addTearDown(() => openExternalUrl = null);
      await pumpShell(tester, commerce: commerce, plans: FakePlans());

      await tester.tap(find.text('شارژ کیف پول'));
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 500));
      await tester.tap(find.text('پرداخت'));
      await tester.pump(const Duration(milliseconds: 100));
      expect(opened.single.toString(), 'https://pay.example/StartPay/A1');
      expect(commerce.topups, ['p1']);
      // First poll says pending, the second finds the credit.
      for (var i = 0; i < 6; i++) {
        await tester.pump(const Duration(seconds: 2));
      }
      await tester.pump(const Duration(milliseconds: 600));
      expect(commerce.statusPolls, greaterThanOrEqualTo(2));
      expect(find.text('پرداخت از کیف پول و شروع'), findsOneWidget);
      await leave(tester);
    },
  );
}
