import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/coach_parse.dart';
import 'package:sabzine_flutter/features/coach/data/http_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/presentation/message_list.dart';

Map<String, dynamic> wireMessage(String id, String role, String text) => {
  'id': id,
  'seq': 1,
  'role': role,
  'type': 'text',
  'text': text,
  'createdAt': '2026-11-17T08:00:00Z',
};

String frame(String event, Map<String, dynamic> data) =>
    'event: $event\ndata: ${jsonEncode(data)}\n\n';

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'thread text survives parsing and local serialization for both roles',
    () {
      final page = parseThreadPage({
        'messages': [
          wireMessage('u', 'user', 'غذا چی بخورم؟'),
          wireMessage('a', 'assistant', 'برنامه امروزت را ببین.'),
        ],
      });
      expect(page.messages.map((m) => m.text), [
        'غذا چی بخورم؟',
        'برنامه امروزت را ببین.',
      ]);
      for (final message in page.messages) {
        expect(parseCoachMessage(message.toJson()).text, message.text);
      }
    },
  );

  test('nonempty text sources retain their precedence across wire formats', () {
    final base = wireMessage('a', 'assistant', 'متن سرور');
    expect(parseCoachMessage(base).text, 'متن سرور');
    expect(
      parseCoachMessage({...base, 'fallback_text': 'پشتیبان'}).text,
      'پشتیبان',
    );
    expect(
      parseCoachMessage({
        ...base,
        'fallback_text': '  ',
        'fallbackText': 'پشتیبان جدید',
      }).text,
      'پشتیبان جدید',
    );
    expect(
      parseCoachMessage({
        ...base,
        'fallback_text': 42,
        'fallbackText': '',
      }).text,
      'متن سرور',
    );
    expect(
      parseCoachMessage({
        ...base,
        'fallbackText': 'پشتیبان',
        'payload': {'text': 'متن کارت'},
      }).text,
      'متن کارت',
    );
    expect(
      parseCoachMessage({...base, 'type': 'future_card'}).fallbackText,
      'متن سرور',
    );
  });

  test('optional messages accept text without a type, including wrappers', () {
    final message = wireMessage('a', 'assistant', 'سلام')..remove('type');
    for (final raw in [
      message,
      {'message': message},
      {'data': message},
    ]) {
      expect(parseOptionalMessage(raw)?.text, 'سلام');
    }
    expect(
      parseOptionalMessage({
        'data': {'count': 1},
      }),
      isNull,
    );
  });

  test(
    'server message events distinguish the user echo from the reply',
    () async {
      final events = await parseSseStream(
        Stream.value(
          utf8.encode(
            frame('message', {'message': wireMessage('u', 'user', 'سلام')}) +
                frame('message', {
                  'message': wireMessage('a', 'assistant', 'سلام دوست من'),
                }) +
                frame('done', {'replay': true}),
          ),
        ),
      ).toList();
      expect(events.first, isA<CoachUserMessage>());
      expect((events.first as CoachUserMessage).message.text, 'سلام');
      expect(
        events.whereType<CoachMessageEvent>().single.message.text,
        'سلام دوست من',
      );
      expect(events.whereType<CoachDone>().single.replayed, isTrue);
    },
  );

  testWidgets(
    'live server text stays visible once after send, refresh and reopen',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final saved = [
        wireMessage('old-user', 'user', 'غذا چی بخورم؟'),
        wireMessage('old-answer', 'assistant', 'برنامه امروزت را ببین.'),
      ];
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/threads')) {
          return http.Response(
            jsonEncode({
              'threads': [
                {
                  'id': 't',
                  'title': 'chat',
                  'createdAt': '2026-11-19T08:00:00Z',
                  'lastMessageAt': null,
                  'preview': '',
                },
              ],
              'limit': 10,
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/thread')) {
          return http.Response.bytes(
            utf8.encode(jsonEncode({'messages': saved, 'nextCursor': null})),
            200,
          );
        }
        if (request.url.path.endsWith('/messages')) {
          final body = jsonDecode(request.body) as Map;
          final user = wireMessage(
            'saved-user',
            'user',
            body['text'] as String,
          );
          final answer = wireMessage(
            'saved-answer',
            'assistant',
            'شام سبک بخور.',
          );
          saved.addAll([user, answer]);
          return http.Response.bytes(
            utf8.encode(
              frame('message', {'message': user}) +
                  frame('message', {'message': answer}) +
                  frame('done', {'replay': false}),
            ),
            200,
            headers: {'content-type': 'text/event-stream; charset=utf-8'},
          );
        }
        return http.Response('{}', 200);
      });
      final auth =
          CustomerAuth(
              baseUrl: 'https://example.test',
              storage: _Memory(),
              client: client,
            )
            ..session = CustomerSession.fromJson({
              'accessToken': 'test-token',
              'role': 'user',
              'sessionExpiresAt': '2099-01-01T00:00:00Z',
            });
      final store = DemoStore()..loginDemoUser();
      final controllers = <CoachController>[];
      CoachController controller() {
        final result = CoachController(
          repository: HttpCoachRepository(auth: auth, client: client),
        );
        controllers.add(result);
        return result;
      }

      addTearDown(() {
        for (final controller in controllers) {
          controller.dispose();
        }
        store.dispose();
        auth.dispose();
      });
      Future<void> show(CoachController controller) async {
        await t.pumpWidget(
          DemoScope(
            store: store,
            child: MaterialApp(
              theme: appTheme(),
              home: Directionality(
                textDirection: TextDirection.rtl,
                child: Scaffold(
                  body: AnimatedBuilder(
                    animation: controller,
                    builder: (_, _) => CoachMessageList(
                      key: ValueKey(controller),
                      controller: controller,
                    ),
                  ),
                ),
              ),
            ),
          ),
        );
        await t.pumpAndSettle();
      }

      final first = controller();
      await t.runAsync(first.start);
      await show(first);
      expect(find.text('غذا چی بخورم؟'), findsOneWidget);
      expect(find.text('برنامه امروزت را ببین.'), findsOneWidget);

      await t.runAsync(() => first.sendText('برای شام چی بخورم؟'));
      await t.pumpAndSettle();
      expect(first.messages, hasLength(4));
      expect(first.messages.any((m) => m.pending), isFalse);
      expect(find.text('برای شام چی بخورم؟'), findsOneWidget);
      expect(find.text('شام سبک بخور.'), findsOneWidget);

      await t.runAsync(first.retry);
      await t.pumpAndSettle();
      expect(first.messages, hasLength(4));
      expect(find.text('برای شام چی بخورم؟'), findsOneWidget);
      expect(find.text('شام سبک بخور.'), findsOneWidget);

      final reopened = controller();
      await t.runAsync(reopened.start);
      await show(reopened);
      expect(reopened.messages.map((m) => m.text), saved.map((m) => m['text']));
      for (final message in saved) {
        expect(find.text(message['text'] as String), findsOneWidget);
      }
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
    },
  );
}

class _Memory implements AuthTokenStorage {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String token) async {}
  @override
  Future<void> clear() async {}
}
