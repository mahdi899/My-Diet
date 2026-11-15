import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/coach_parse.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_repository.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../widget_test.dart' show mobile;

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('parser keeps unknown types and reads the sport envelope', () {
    final message = parseCoachMessage({
      'id': 7,
      'role': 'assistant',
      'type': 'mystery_card',
      'payload': {'text': 'نادیده'},
      'fallback_text': 'متن پشتیبان',
      'client_message_id': 'abc',
      'created_at': '2026-11-09T08:00:00Z',
    });
    expect(message.id, '7');
    expect(message.type, 'mystery_card');
    expect(message.fallbackText, 'متن پشتیبان');
    expect(isKnownCoachType(message.type), isFalse);

    final page = parseThreadPage({
      'messages': [message.toJson()],
      'meta': {'next_cursor': 'c1', 'has_more': true},
      'suggestions': ['وزن امروز'],
    });
    expect(page.messages, hasLength(1));
    expect(page.cursor, 'c1');
    expect(page.hasMore, isTrue);
    expect(page.suggestions, ['وزن امروز']);
  });

  test('SSE frames become delta, message, done and error', () async {
    final raw = [
      'event: delta',
      'data: {"stream_id":"s1","text":"سل"}',
      '',
      'event: message',
      'data: {"message":{"id":"9","role":"assistant","type":"text","payload":{"text":"سلام"},"fallback_text":"سلام","created_at":"2026-11-09T08:00:00Z"}}',
      '',
      'event: ping',
      'data: {"ok":true}',
      '',
      'event: done',
      'data: {"suggestions":["حلقهٔ کالری"]}',
      '',
      'event: error',
      'data: {"code":"budget","message":"سقف پر شد","retryable":false}',
      '',
    ].join('\n');
    final events = await parseSseStream(
      Stream<List<int>>.value(utf8.encode(raw)),
    ).toList();
    expect(events[0], isA<CoachDelta>());
    expect((events[0] as CoachDelta).text, 'سل');
    expect(events[1], isA<CoachMessageEvent>());
    expect((events[1] as CoachMessageEvent).message.text, 'سلام');
    expect(events[2], isA<CoachDone>());
    expect((events[2] as CoachDone).suggestions, ['حلقهٔ کالری']);
    expect(events[3], isA<CoachErrorEvent>());
  });

  testWidgets('coach route opens and X returns to home', (tester) async {
    mobile(tester);
    final store = DemoStore()..loginDemoUser();
    await tester.pumpWidget(
      SabzineApp(store: store, splashDuration: Duration.zero),
    );
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('shell-page-1')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('tab-plan')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('shell-page-2')), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await tester.pumpAndSettle();
    expect(find.text('مربی رژیم من'), findsOneWidget);
    expect(find.byKey(const ValueKey('coach-close')), findsOneWidget);
    expect(find.byKey(const ValueKey('shell-tab-bar')), findsNothing);

    await tester.tap(find.byKey(const ValueKey('coach-close')));
    await tester.pumpAndSettle();
    expect(find.byKey(const ValueKey('shell-tab-bar')), findsOneWidget);
    expect(find.byKey(const ValueKey('shell-page-1')), findsOneWidget);
    expect(find.byKey(const ValueKey('shell-page-2')), findsNothing);

    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('mock reply renders a meal card', (tester) async {
    mobile(tester);
    final store = DemoStore()..loginDemoUser();
    await tester.pumpWidget(
      SabzineApp(store: store, splashDuration: Duration.zero),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('tab-coach')));
    await tester.pumpAndSettle();
    final input = find.byKey(const ValueKey('coach-input'));
    await tester.ensureVisible(input);
    await tester.enterText(input, 'یه غذا پیشنهاد بده');
    await tester.pump();
    expect(
      tester.widget<TextField>(input).controller!.text,
      'یه غذا پیشنهاد بده',
    );
    await tester.ensureVisible(find.byKey(const ValueKey('coach-send')));
    await tester.tap(find.byKey(const ValueKey('coach-send')));
    await tester.pump();
    expect(find.text('بررسی و ثبت'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });

  testWidgets('scripted cards render meal, ring and fallback text', (
    tester,
  ) async {
    final store = DemoStore()..loginDemoUser();
    await tester.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          locale: const Locale('fa'),
          home: CoachPage(repository: _ScriptRepo()),
        ),
      ),
    );
    await tester.pumpAndSettle();
    await tester.scrollUntilVisible(
      find.text('بررسی و ثبت'),
      400,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('بررسی و ثبت'), findsOneWidget);
    expect(find.text('کالری امروز'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('ثبت وزن'),
      -200,
      scrollable: find.byType(Scrollable).first,
    );
    expect(find.text('ثبت وزن'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    store.dispose();
  });
}

class _ScriptRepo implements CoachRepository {
  CoachMessage _m({
    required String id,
    required String type,
    required Map<String, dynamic> payload,
    required String fallback,
  }) => CoachMessage(
    id: id,
    role: 'assistant',
    type: type,
    payload: payload,
    fallbackText: fallback,
    createdAt: DateTime(2026, 11, 9),
  );

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async => CoachThreadPage(
    messages: [
      _m(
        id: 'meal',
        type: 'meal_card',
        fallback: 'خورش قیمه',
        payload: {
          'title': 'خورش قیمه',
          'meal_type_fa': 'ناهار',
          'photo_title': 'خورش قیمه',
          'calories': 640,
          'protein_g': 28,
          'carbs_g': 70,
          'fat_g': 18,
          'confidence': 0.9,
          'items': [
            {
              'name': 'خورش قیمه',
              'quantity': 200,
              'unit': 'g',
              'calories': 640,
              'protein_g': 28,
              'carbs_g': 70,
              'fat_g': 18,
            },
          ],
        },
      ),
      _m(
        id: 'ring',
        type: 'calorie_ring',
        fallback: 'کالری امروز',
        payload: {'title': 'کالری امروز', 'eaten': 420, 'goal': 1800},
      ),
      _m(
        id: 'weigh',
        type: 'weigh_in',
        fallback: 'وزن امروز',
        payload: {'title': 'وزن امروز', 'value': 72, 'step': 0.1},
      ),
      _m(
        id: 'brief',
        type: 'day_brief',
        fallback: 'خلاصهٔ امروز',
        payload: {
          'title': 'خلاصهٔ امروز',
          'note': 'یک قدم کافی است.',
          'meals': [
            {'name': 'ناهار', 'title': 'قیمه', 'calories': 640},
          ],
        },
      ),
      _m(
        id: 'unknown',
        type: 'mystery_card',
        fallback: 'متن پشتیبان',
        payload: const {},
      ),
    ],
  );

  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) =>
      const Stream.empty();

  @override
  Future<void> persist(List<CoachMessage> messages) async {}

  @override
  Future<Map<String, dynamic>> uploadFoodPhoto(
    List<int> bytes, {
    String filename = 'meal.jpg',
  }) async => {};

  @override
  Future<CoachMessage?> patchMeal(String id, Map<String, dynamic> body) async =>
      null;

  @override
  Future<Map<String, dynamic>> today() async => {};

  @override
  Future<CoachMessage?> postAction(
    String action,
    Map<String, dynamic> data,
  ) async => null;

  @override
  Future<Uint8List?> fetchMedia(String id) async => null;

  @override
  Future<CoachDayBrief?> ensureDayBrief() async => null;

  @override
  Future<Map<String, dynamic>?> quota() async => null;

  @override
  void close() {}
}
