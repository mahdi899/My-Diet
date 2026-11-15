import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/data/coach_parse.dart';
import 'package:sabzine_flutter/features/coach/data/coach_wire.dart';
import 'package:sabzine_flutter/features/coach/data/http_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('contract cards adapt for the existing views, unknown stays text', () {
    final meal = parseCoachMessage({
      'id': 'meal',
      'role': 'assistant',
      'type': 'meal_card',
      'fallbackText': 'کباب کوبیده',
      'payload': {
        'entryId': '11111111-1111-4111-8111-111111111111',
        'title': 'کباب کوبیده',
        'mealType': 'lunch',
        'source': 'photo',
        'status': 'suggested',
        'items': [
          {
            'name': 'کباب کوبیده',
            'slug': 'kobideh',
            'servings': 1,
            'servingLabel': 'یک پرس',
            'kcal': 500,
            'proteinG': 35,
            'carbsG': 10,
            'fatG': 28,
            'estimated': false,
          },
        ],
        'totals': {'kcal': 500, 'proteinG': 35, 'carbsG': 10, 'fatG': 28},
        'confidence': 0.82,
        'photoUrl': '/v1/me/coach/media/media-1',
        'mediaId': 'media-1',
        'photoHint': ['کباب کوبیده'],
        'actions': ['confirm', 'edit'],
      },
    });
    expect(meal.payload['calories'], 500);
    expect(meal.payload['meal_type_fa'], 'ناهار');
    expect(meal.payload['protein_g'], 35);
    expect(meal.payload['photo_title'], 'کباب کوبیده');
    expect(meal.payload['entryId'], '11111111-1111-4111-8111-111111111111');
    final item = (meal.payload['items'] as List).first as Map;
    expect(item['quantity'], 1);
    expect(item['calories'], 500);
    expect(item['slug'], 'kobideh');

    final plan = parseCoachMessage({
      'id': 'plan',
      'role': 'assistant',
      'type': 'plan_meal',
      'fallbackText': 'خورش قیمه',
      'payload': {
        'mealType': 'lunch',
        'title': 'خورش قیمه',
        'suggestedTime': '13:00',
        'plannedKcal': 550,
        'actions': ['log_as_planned', 'swap'],
      },
    });
    expect(plan.payload['meal_type_fa'], 'ناهار');
    expect(plan.payload['time'], '13:00');
    expect(plan.payload['calories'], 550);

    final ring = parseCoachMessage({
      'id': 'ring',
      'role': 'assistant',
      'type': 'calorie_ring',
      'fallbackText': 'کالری',
      'payload': {'targetKcal': 1600, 'consumedKcal': 420, 'remainingKcal': 1180},
    });
    expect(ring.payload['eaten'], 420);
    expect(ring.payload['goal'], 1600);

    final weigh = parseCoachMessage({
      'id': 'weigh',
      'role': 'assistant',
      'type': 'weigh_in',
      'fallbackText': 'وزن',
      'payload': {'kilograms': 76.4, 'deltaKg': -0.6, 'trend': 'down'},
    });
    expect(weigh.payload['value'], 76.4);

    final water = parseCoachMessage({
      'id': 'water',
      'role': 'assistant',
      'type': 'water',
      'fallbackText': 'آب',
      'payload': {'ml': 500, 'addedMl': 250, 'targetMl': 2000},
    });
    expect(water.payload['glasses'], 2);
    expect(water.payload['goal'], 8);

    final brief = parseCoachMessage({
      'id': 'brief',
      'role': 'assistant',
      'type': 'day_brief',
      'fallbackText': 'صبح',
      'payload': {
        'greeting': 'صبح بخیر نگار',
        'tip': 'وعدهٔ بعدی: نان و پنیر.',
        'meals': [
          {
            'mealType': 'breakfast',
            'title': 'نان و پنیر',
            'suggestedTime': '08:00',
            'plannedKcal': 400,
          },
        ],
      },
    });
    expect(brief.payload['title'], 'صبح بخیر نگار');
    expect(brief.payload['note'], 'وعدهٔ بعدی: نان و پنیر.');
    expect((brief.payload['meals'] as List).first['name'], 'صبحانه');
    expect((brief.payload['meals'] as List).first['calories'], 400);

    final week = parseCoachMessage({
      'id': 'week',
      'role': 'assistant',
      'type': 'weekly_review',
      'fallbackText': 'هفته',
      'payload': {
        'adherencePercent': 80,
        'weightChangeKg': -0.4,
        'focus': 'پروتئین ناهار را ثابت نگه دار.',
      },
    });
    expect(week.payload['adherence'], 0.8);
    expect(week.payload['delta_kg'], -0.4);
    expect(week.payload['note'], 'پروتئین ناهار را ثابت نگه دار.');

    final milestone = parseCoachMessage({
      'id': 'mile',
      'role': 'assistant',
      'type': 'milestone',
      'fallbackText': 'پیوستگی',
      'payload': {'kind': 'streak', 'title': '۷ روز پیوستگی', 'body': 'ادامه بده', 'value': 7},
    });
    expect(milestone.payload['subtitle'], 'ادامه بده');

    final replies = parseCoachMessage({
      'id': 'qr',
      'role': 'assistant',
      'type': 'quick_replies',
      'fallbackText': 'انتخاب',
      'payload': {
        'replies': [
          {'id': 'ring', 'label': 'حلقهٔ امروز', 'action': 'show_ring', 'args': {}},
          {'id': 'idea', 'label': 'یه غذا پیشنهاد بده'},
        ],
      },
    });
    final options = replies.payload['options'] as List;
    expect(options.first['action'], 'show_ring');
    expect(options.last['label'], 'یه غذا پیشنهاد بده');

    final photo = parseCoachMessage({
      'id': 'pic',
      'role': 'user',
      'type': 'user_photo',
      'fallbackText': 'عکس',
      'payload': {
        'mediaId': 'media-1',
        'url': '/v1/me/coach/media/media-1',
        'mime': 'image/jpeg',
      },
    });
    expect(photo.payload['mediaId'], 'media-1');

    final note = parseCoachMessage({
      'id': 'note',
      'role': 'assistant',
      'type': 'system_note',
      'fallbackText': 'رضایت لازم است',
      'payload': {'code': 'no_consent', 'text': 'رضایت لازم است'},
    });
    expect(note.payload['text'], 'رضایت لازم است');

    final unknown = parseCoachMessage({
      'id': 'mystery',
      'role': 'assistant',
      'type': 'future_card',
      'fallbackText': 'متن پشتیبان',
      'payload': {'text': 'جزئیات'},
    });
    expect(isKnownCoachType(unknown.type), isFalse);
    expect(unknown.fallbackText, 'متن پشتیبان');
    expect(unknown.text, 'جزئیات');

    final page = parseThreadPage({
      'thread': {'id': 'thread-1', 'dayBriefDate': '2026-06-01'},
      'messages': [meal.toJson(), unknown.toJson()],
      'nextCursor': '12',
    });
    expect(page.messages, hasLength(2));
    expect(page.cursor, '12');
    expect(page.hasMore, isTrue);
    expect(page.threadId, 'thread-1');
    expect(parseThreadPage({'messages': [], 'nextCursor': null}).hasMore, isFalse);
  });

  test('SSE concatenates deltas, keeps the card, and ignores pings', () async {
    final raw = [
      'event: user_message',
      'data: {"message":{"id":"u1","role":"user","type":"text","payload":{"text":"سلام"},"fallbackText":"سلام","clientMessageId":"11111111-1111-4111-8111-111111111111","createdAt":"2026-06-01T08:00:00.000Z"}}',
      '',
      'event: delta',
      'data: {"segment":1,"text":"سل"}',
      '',
      'event: delta',
      'data: {"segment":1,"text":"ام"}',
      '',
      ': ping',
      '',
      'event: tool',
      'data: {"name":"search_food","status":"running"}',
      '',
      'event: message',
      'data: {"message":{"id":"m1","role":"assistant","type":"meal_card","payload":{"title":"قیمه","mealType":"lunch","status":"suggested","totals":{"kcal":420,"proteinG":20,"carbsG":40,"fatG":12}},"fallbackText":"قیمه","createdAt":"2026-06-01T08:00:01.000Z"}}',
      '',
      'event: done',
      'data: {"replayed":false,"userMessageId":"u1","messageIds":["m1"],"suggestions":["حلقهٔ امروز"]}',
      '',
      'event: error',
      'data: {"code":"ai_unavailable","messageFa":"مربی الان در دسترس نیست.","retryable":true}',
      '',
    ].join('\n');

    final events = await parseSseStream(
      Stream<List<int>>.value(utf8.encode(raw)),
    ).toList();

    expect(events.whereType<CoachUserMessage>(), hasLength(1));
    final deltas = events.whereType<CoachDelta>().toList();
    expect(deltas.map((event) => event.text).join(), 'سلام');
    expect(deltas.every((event) => event.segment == 1), isTrue);
    expect(events.whereType<CoachToolEvent>().single.name, 'search_food');
    final card = events.whereType<CoachMessageEvent>().single.message;
    expect(card.type, 'meal_card');
    expect(card.payload['calories'], 420);
    expect(card.payload['meal_type_fa'], 'ناهار');
    final done = events.whereType<CoachDone>().single;
    expect(done.suggestions, ['حلقهٔ امروز']);
    expect(done.replayed, isFalse);
    expect(done.messageIds, ['m1']);
    final error = events.whereType<CoachErrorEvent>().single;
    expect(error.code, 'ai_unavailable');
    expect(error.message, 'مربی الان در دسترس نیست.');
    expect(error.retryable, isTrue);
    expect(events, hasLength(7));

    final budget = coachEventFrom('error', {
      'code': 'ai_budget_exceeded',
      'messageFa': 'سقف استفاده از هوش مصنوعی پر شده است.',
      'retryable': false,
    });
    expect(budget, isA<CoachErrorEvent>());
    expect((budget as CoachErrorEvent).problem, CoachProblem.budget);
    expect(budget.message, 'سهم امروز مربی تمام شد');
    expect(budget.retryable, isFalse);
  });

  test('water action is millilitres and the client id is a uuid', () {
    final request = CoachSendRequest.action('log_water', const {
      'glasses': 1,
    }, label: 'یک لیوان');
    final body = coachActionBody(request);
    expect(isCoachUuid(body['clientMessageId']), isTrue);
    expect(body['action'], 'log_water');
    expect(body['args'], {'ml': 250});
    expect(body.containsKey('data'), isFalse);
    expect(coachMessageBody(CoachSendRequest.text('ناهار قیمه'))['kind'], 'text');
  });

  test('http client follows the contract without a live server', () async {
    final png = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    );
    final calls = <String>[];
    late CustomerAuth auth;
    final client = MockClient((request) async {
      calls.add('${request.method} ${request.url.path}');
      expect(request.headers['authorization'], 'Bearer token');
      if (request.url.path.endsWith('/thread')) {
        expect(request.url.queryParameters['before'], '9');
        return http.Response(
          jsonEncode({
            'thread': {'id': 't', 'dayBriefDate': null},
            'messages': <Object>[],
            'nextCursor': null,
          }),
          200,
        );
      }
      if (request.url.path.endsWith('/messages')) {
        final body = jsonDecode(request.body) as Map;
        expect(body['kind'], 'text');
        expect(isCoachUuid(body['clientMessageId']), isTrue);
        expect(body.containsKey('client_message_id'), isFalse);
        return http.Response(
          [
            'event: delta',
            'data: {"segment":1,"text":"ثبت شد."}',
            '',
            'event: done',
            'data: {"replayed":false,"userMessageId":"u","messageIds":[]}',
            '',
          ].join('\n'),
          200,
          headers: {'content-type': 'text/event-stream; charset=utf-8'},
        );
      }
      if (request.url.path.endsWith('/food-photos')) {
        final body = jsonDecode(request.body) as Map;
        expect(body['mime'], 'image/png');
        expect(body['image'], startsWith('data:image/png;base64,'));
        return http.Response.bytes(
          utf8.encode(jsonEncode({
            'userMessage': {
              'id': 'u',
              'role': 'user',
              'type': 'user_photo',
              'payload': {'mediaId': 'm', 'mime': 'image/png'},
              'fallbackText': 'عکس',
              'clientMessageId': body['clientMessageId'],
              'createdAt': '2026-06-01T08:00:00.000Z',
            },
            'messages': [
              {
                'id': 'card',
                'role': 'assistant',
                'type': 'meal_card',
                'payload': {
                  'title': 'قیمه',
                  'mealType': 'lunch',
                  'status': 'suggested',
                  'totals': {'kcal': 420, 'proteinG': 1, 'carbsG': 1, 'fatG': 1},
                },
                'fallbackText': 'قیمه',
                'createdAt': '2026-06-01T08:00:01.000Z',
              },
            ],
          })),
          200,
        );
      }
      return http.Response('{"messageFa":"ناشناخته"}', 404);
    });
    auth = CustomerAuth(
      baseUrl: 'https://example.test',
      storage: _Memory(),
      client: client,
    );
    auth.session = CustomerSession.fromJson({
      'accessToken': 'token',
      'refreshToken': 'refresh',
      'role': 'user',
      'sessionExpiresAt': DateTime.now()
          .add(const Duration(hours: 2))
          .toUtc()
          .toIso8601String(),
    });
    final repo = HttpCoachRepository(auth: auth, client: client);
    addTearDown(() {
      repo.close();
      auth.dispose();
    });

    final page = await repo.loadThread(cursor: '9');
    expect(page.hasMore, isFalse);

    final streamed = await repo.send(CoachSendRequest.text('سلام')).toList();
    expect(streamed.first, isA<CoachDelta>());
    expect((streamed.first as CoachDelta).text, 'ثبت شد.');
    expect(streamed.last, isA<CoachDone>());

    final photo = await repo
        .send(CoachSendRequest.photo('meal.png'), photoBytes: png)
        .toList();
    expect(photo.first, isA<CoachMessageEvent>());
    expect(
      (photo.first as CoachMessageEvent).message.payload['analyzing'],
      isTrue,
    );
    expect(photo[1], isA<CoachUserMessage>());
    expect((photo[2] as CoachMessageEvent).message.payload['calories'], 420);
    expect(calls, contains('POST /v1/me/coach/food-photos'));
  });

  test('402 is the calm budget state and 422 stays a coach message', () async {
    Future<HttpCoachRepository> repo(int status, String body) async {
      final client = MockClient(
        (_) async => http.Response(body, status, headers: {
          'content-type': 'application/json',
        }),
      );
      final auth = CustomerAuth(
        baseUrl: 'https://example.test',
        storage: _Memory(),
        client: client,
      );
      auth.session = CustomerSession.fromJson({
        'accessToken': 'token',
        'refreshToken': 'refresh',
        'role': 'user',
        'sessionExpiresAt': DateTime.now()
            .add(const Duration(hours: 2))
            .toUtc()
            .toIso8601String(),
      });
      return HttpCoachRepository(auth: auth, client: client);
    }

    final budget = await repo(
      402,
      jsonEncode({
        'status': 402,
        'code': 'ai_budget_exceeded',
        'messageFa': 'سقف پر شده',
        'retryable': false,
      }),
    );
    await expectLater(
      budget.send(CoachSendRequest.text('سلام')).toList(),
      throwsA(
        isA<CoachTransportException>()
            .having((error) => error.problem, 'problem', CoachProblem.budget)
            .having((error) => error.message, 'message', 'سهم امروز مربی تمام شد')
            .having((error) => error.retryable, 'retryable', isFalse),
      ),
    );
    budget.close();

    final safety = await repo(
      422,
      jsonEncode({
        'status': 422,
        'code': 'safety_block',
        'messageFa': 'این روش برای بدنت خطرناکه.',
        'retryable': false,
      }),
    );
    await expectLater(
      safety.send(CoachSendRequest.text('رژیم سخت')).toList(),
      throwsA(
        isA<CoachTransportException>()
            .having((error) => error.problem, 'problem', CoachProblem.safety)
            .having(
              (error) => error.message,
              'message',
              'این روش برای بدنت خطرناکه.',
            )
            .having((error) => error.retryable, 'retryable', isFalse),
      ),
    );
    safety.close();
  });

  test('controller reconciles, budgets, blocks, and keeps a partial draft', () async {
    final controller = CoachController(repository: _Scripted((request) async* {
      yield CoachUserMessage(
        CoachMessage(
          id: 'srv',
          role: 'user',
          type: 'text',
          payload: {'text': request.text},
          fallbackText: request.text ?? '',
          clientMessageId: request.clientMessageId,
          createdAt: DateTime.utc(2026, 6, 1),
        ),
      );
      yield const CoachDone(suggestions: ['بعدی']);
    }));
    await controller.sendText('سلام');
    expect(controller.messages, hasLength(1));
    expect(controller.messages.single.id, 'srv');
    expect(controller.messages.single.pending, isFalse);
    expect(controller.suggestions, ['بعدی']);
    controller.dispose();

    final limited = CoachController(repository: _Scripted((_) async* {
      yield const CoachErrorEvent(
        code: 'coach_daily_limit',
        message: 'سهم امروز مربی تمام شد',
        problem: CoachProblem.budget,
      );
    }));
    await limited.sendText('ادامه');
    expect(limited.budgetNote, 'سهم امروز مربی تمام شد');
    expect(limited.canRetry, isFalse);
    expect(limited.messages.single.failed, isFalse);
    limited.dispose();

    final blocked = CoachController(repository: _Scripted((_) async* {
      yield const CoachErrorEvent(
        code: 'safety_block',
        message: 'این روش برای بدنت خطرناکه.',
        problem: CoachProblem.safety,
      );
    }));
    await blocked.sendText('کالری خیلی کم');
    expect(
      blocked.messages.any((message) => message.text.contains('خطرناکه')),
      isTrue,
    );
    expect(blocked.canRetry, isFalse);
    expect(blocked.messages.first.failed, isFalse);
    blocked.dispose();

    final dropped = CoachController(repository: _Scripted((_) async* {
      yield const CoachDelta(streamId: 's', text: 'سل', segment: 1);
      yield const CoachDelta(streamId: 's', text: 'ام', segment: 1);
      yield const CoachDelta(streamId: 's', text: 'بعد', segment: 2);
    }));
    await dropped.sendText('نصف');
    expect(dropped.draftText, 'بعد');
    expect(dropped.canRetry, isTrue);
    expect(dropped.messages.single.failed, isTrue);
    dropped.dispose();
  });
}

class _Memory implements AuthTokenStorage {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String token) async => value = token;
  @override
  Future<void> clear() async => value = null;
}

class _Scripted implements CoachRepository {
  _Scripted(this._send);
  final Stream<CoachEvent> Function(CoachSendRequest request) _send;

  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) =>
      _send(request);

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async =>
      const CoachThreadPage();

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
