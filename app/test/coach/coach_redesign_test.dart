import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:sabzine_flutter/features/coach/presentation/today_summary.dart';
import 'package:sabzine_flutter/features/plan/meal_detail_page.dart';

class _SpyCoach extends MockCoachRepository {
  _SpyCoach(DemoStore store) : super(store: store, charDelay: Duration.zero);
  final sent = <CoachSendRequest>[];
  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) {
    sent.add(request);
    return super.send(request, photoBytes: photoBytes);
  }
}

class _InlineCoach extends _SpyCoach {
  _InlineCoach(super.store);
  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async => CoachThreadPage(
    messages: [
      CoachMessage(
        id: 'prompt',
        role: 'assistant',
        type: 'quick_replies',
        payload: const {
          'prompt': 'از کجا شروع کنیم؟',
          'options': [
            {
              'label': 'ثبت آب',
              'action': 'log_water',
              'args': {'glasses': 1},
            },
          ],
        },
        fallbackText: '',
        createdAt: DateTime(2026, 11, 9),
      ),
      CoachMessage(
        id: 'footer',
        role: 'assistant',
        type: 'text',
        payload: const {'text': 'کنارت هستم.'},
        fallbackText: '',
        createdAt: DateTime(2026, 11, 9),
      ),
    ],
    suggestions: const ['ثبت آب'],
  );
}

DemoStore ready() {
  final store = DemoStore(clock: () => DateTime(2026, 11, 9, 12, 30))
    ..loginDemoUser();
  store.approveActiveUserRequest();
  return store;
}

Widget host(
  DemoStore store,
  MockCoachRepository repo, {
  double scale = 1,
  double inset = 0,
}) => DemoScope(
  store: store,
  child: MaterialApp(
    theme: appTheme(),
    builder: (context, child) => MediaQuery(
      data: MediaQuery.of(context).copyWith(
        disableAnimations: true,
        textScaler: TextScaler.linear(scale),
        viewInsets: EdgeInsets.only(bottom: inset),
      ),
      child: Directionality(textDirection: TextDirection.rtl, child: child!),
    ),
    home: CoachPage(repository: repo),
  ),
);

void phone(WidgetTester tester, {double width = 390, double height = 844}) {
  tester.view.physicalSize = Size(width, height);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  testWidgets('summary expands into actual plan and can collapse again', (
    tester,
  ) async {
    phone(tester);
    final store = ready();
    await tester.pumpWidget(host(store, _SpyCoach(store)));
    await tester.pumpAndSettle();
    final summary = find.byType(CoachTodaySummary);
    final breakfast = store.mealsOn(store.today).first.title;
    expect(
      find.descendant(of: summary, matching: find.textContaining(breakfast)),
      findsNothing,
    );
    await tester.tap(find.byKey(const ValueKey('coach-summary-toggle')));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: summary, matching: find.textContaining(breakfast)),
      findsOneWidget,
    );
    await tester.tap(find.byKey(const ValueKey('coach-summary-toggle')));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: summary, matching: find.textContaining(breakfast)),
      findsNothing,
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets(
    'quick water uses the existing action rather than a text request',
    (tester) async {
      phone(tester);
      final store = ready();
      final repo = _SpyCoach(store);
      await tester.pumpWidget(host(store, repo));
      await tester.pumpAndSettle();
      await tester.tap(find.byKey(const ValueKey('coach-quick-water')));
      await tester.pumpAndSettle();
      expect(repo.sent.single.action, 'log_water');
      expect(repo.sent.single.data['glasses'], 1);
      expect(repo.sent.single.kind, 'card_action');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'matching plan card opens real detail and keeps the typed draft',
    (tester) async {
      phone(tester);
      final store = ready();
      await tester.pumpWidget(host(store, _SpyCoach(store)));
      await tester.pumpAndSettle();
      await tester.enterText(
        find.byKey(const ValueKey('coach-input')),
        'دربارهٔ ناهار سوال دارم',
      );
      await tester.ensureVisible(find.text('مشاهدهٔ وعده'));
      await tester.tap(find.text('مشاهدهٔ وعده'));
      await tester.pumpAndSettle();
      final detail = tester.widget<MealDetailPage>(find.byType(MealDetailPage));
      expect(detail.index, 1);
      Navigator.of(tester.element(find.byType(MealDetailPage))).pop();
      await tester.pumpAndSettle();
      expect(
        tester
            .widget<TextField>(find.byKey(const ValueKey('coach-input')))
            .controller!
            .text,
        'دربارهٔ ناهار سوال دارم',
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets(
    'inline quick reply remains actionable without duplicate composer chips',
    (tester) async {
      phone(tester);
      final store = ready();
      final repo = _InlineCoach(store);
      await tester.pumpWidget(host(store, repo));
      await tester.pumpAndSettle();
      expect(find.text('ثبت آب'), findsOneWidget);
      expect(find.byKey(const ValueKey('coach-quick-water')), findsNothing);
      await tester.tap(find.text('ثبت آب'));
      await tester.pumpAndSettle();
      expect(repo.sent.single.action, 'log_water');
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  testWidgets('narrow layout and expanded summary survive the keyboard', (
    tester,
  ) async {
    phone(tester, width: 320, height: 740);
    final store = ready();
    final repo = _SpyCoach(store);
    await tester.pumpWidget(host(store, repo, scale: 1.35));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('coach-summary-toggle')));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(host(store, repo, scale: 1.35, inset: 300));
    await tester.pumpAndSettle();
    expect(tester.takeException(), isNull);
    expect(find.byKey(const ValueKey('coach-input')), findsOneWidget);
    final summary = find.byType(CoachTodaySummary);
    final breakfast = store.mealsOn(store.today).first.title;
    expect(
      find.descendant(of: summary, matching: find.textContaining(breakfast)),
      findsNothing,
    );
    await tester.pumpWidget(host(store, repo, scale: 1.35));
    await tester.pumpAndSettle();
    expect(
      find.descendant(of: summary, matching: find.textContaining(breakfast)),
      findsOneWidget,
    );
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}
