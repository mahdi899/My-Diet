import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/customer_auth.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/application/coach_session.dart';
import 'package:sabzine_flutter/features/coach/data/http_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_conversation.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';

CoachMessage message(String text) => CoachMessage(
  id: text,
  role: 'user',
  type: 'text',
  payload: {'text': text},
  fallbackText: text,
  createdAt: DateTime.utc(2026, 11, 19),
);

class SwitchingRepository extends MockCoachRepository {
  String? selected = 'a';
  final loads = <String?, Completer<CoachThreadPage>>{};
  final turn = StreamController<CoachEvent>.broadcast();
  @override
  String? get conversationId => selected;
  @override
  Future<void> selectConversation(String? id) async {
    selected = id;
  }

  @override
  Future<List<CoachConversation>> listConversations() async => [
    for (final id in ['a', 'b'])
      CoachConversation(id: id, title: id, createdAt: DateTime.utc(2026)),
  ];
  @override
  Future<CoachThreadPage> loadThread({String? cursor}) =>
      (loads[selected] = Completer<CoachThreadPage>()).future;
  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) =>
      turn.stream;
  @override
  Future<void> persist(List<CoachMessage> messages) async {}
}

class MemoryAuthStorage implements AuthTokenStorage {
  @override
  Future<String?> read() async => null;
  @override
  Future<void> write(String value) async {}
  @override
  Future<void> clear() async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'conversations remain separate, survive reopening, rename and delete',
    () async {
      final session = CoachSession(
        repository: MockCoachRepository(charDelay: Duration.zero),
      );
      addTearDown(session.close);
      await session.start();
      expect(await session.newConversation(), isTrue);
      expect(session.conversations, isEmpty);
      await session.sendText('پرسش اول');
      final first = session.conversationId!;
      final original = session.messages.map((m) => m.toJson()).toList();
      expect(await session.newConversation(), isTrue);
      expect(session.messages, isEmpty);
      await session.sendText('پرسش دوم');
      final second = session.conversationId!;
      expect(second, isNot(first));
      await session.renameConversation(first, 'وعده‌های من');
      await session.selectConversation(first);
      expect(session.messages.map((m) => m.toJson()).toList(), original);
      final reopened = CoachSession(
        repository: MockCoachRepository(charDelay: Duration.zero),
      );
      addTearDown(reopened.close);
      await reopened.start();
      expect(reopened.conversationId, first);
      expect(reopened.messages.map((m) => m.toJson()).toList(), original);
      await reopened.refreshConversations();
      expect(
        reopened.conversations.singleWhere((t) => t.id == first).title,
        'وعده‌های من',
      );
      await reopened.deleteConversation(first);
      expect(reopened.conversationId, second);
      expect(reopened.messages.any((m) => m.text == 'پرسش دوم'), isTrue);
      expect(reopened.messages.any((m) => m.text == 'پرسش اول'), isFalse);
    },
  );

  test(
    'the fifty-first conversation replaces the oldest only on first send',
    () async {
      final session = CoachSession(
        repository: MockCoachRepository(charDelay: Duration.zero),
      );
      addTearDown(session.close);
      await session.start();
      final ids = <String>[];
      for (var i = 0; i < 50; i++) {
        expect(await session.newConversation(), isTrue);
        await session.sendText('پرسش $i');
        ids.add(session.conversationId!);
      }
      await session.refreshConversations();
      expect(session.conversations.length, 50);
      await session.selectConversation(ids.first);
      await session.sendText('ادامه گفتگوی قدیمی');
      expect(await session.newConversation(), isTrue);
      expect(await session.newConversation(), isTrue);
      await session.refreshConversations();
      expect(session.conversations.map((t) => t.id).toSet(), ids.toSet());
      expect(session.conversationsError, isNull);
      await session.sendText('پرسش پنجاه و یکم');
      final newest = session.conversationId!;
      await session.refreshConversations();
      expect(session.conversations.length, 50);
      expect(session.conversations.map((t) => t.id).toSet(), {
        ...ids.where((id) => id != ids[1]),
        newest,
      });
      final reopened = MockCoachRepository();
      expect((await reopened.listConversations()).length, 50);
      expect(reopened.conversationId, newest);
      await expectLater(
        reopened.selectConversation(ids[1]),
        throwsA(isA<CoachTransportException>()),
      );
      await reopened.selectConversation(ids.first);
      expect(
        (await reopened.loadThread()).messages.any(
          (m) => m.text == 'ادامه گفتگوی قدیمی',
        ),
        isTrue,
      );
      await session.sendText('ادامه');
      await session.refreshConversations();
      expect(session.conversations.length, 50);
      expect(session.conversations.any((t) => t.id == ids[2]), isTrue);
    },
  );

  test(
    'late history and streaming responses cannot cross conversations',
    () async {
      final repo = SwitchingRepository();
      final session = CoachSession(repository: repo);
      addTearDown(session.close);
      final initial = session.start();
      final switching = session.selectConversation('b');
      await Future<void>.delayed(Duration.zero);
      repo.loads['b']!.complete(CoachThreadPage(messages: [message('B')]));
      await switching;
      repo.loads['a']!.complete(CoachThreadPage(messages: [message('late A')]));
      await initial;
      expect(session.messages.map((m) => m.text), ['B']);
      final sending = session.sendText('pending B');
      repo.turn.add(const CoachDelta(streamId: 'b', text: 'partial B'));
      await Future<void>.delayed(Duration.zero);
      expect(session.draftText, 'partial B');
      final toA = session.selectConversation('a');
      await Future<void>.delayed(Duration.zero);
      repo.loads['a']!.complete(CoachThreadPage(messages: [message('A')]));
      await toA;
      await sending;
      repo.turn.add(CoachMessageEvent(message('late reply B')));
      await repo.turn.close();
      expect(session.messages.map((m) => m.text), ['A']);
      expect(session.draftText, isNull);
      expect(session.busy, isFalse);
      expect(session.canRetry, isFalse);
    },
  );

  test(
    'local migration keeps all messages and scopes new history to its owner',
    () async {
      final prefs = await SharedPreferences.getInstance();
      final old = [for (var i = 0; i < 90; i++) message('old $i').toJson()];
      await prefs.setString('rejime_man.coach.messages.v1', jsonEncode(old));
      final repo = MockCoachRepository();
      expect((await repo.loadThread()).messages.length, 90);
      expect((await repo.listConversations()).length, 1);
      expect(prefs.containsKey('rejime_man.coach.messages.v1'), isFalse);
      final another = DemoStore()..sessionPhone = 'another-account';
      addTearDown(another.dispose);
      expect(
        await MockCoachRepository(store: another).listConversations(),
        isEmpty,
      );
    },
  );

  test(
    'live transport restores selected history and creates only on first send',
    () async {
      var creates = 0;
      final bodies = <Map>[];
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/threads') && request.method == 'GET') {
          return http.Response(
            jsonEncode({
              'threads': [
                for (final id in ['a', 'b'])
                  {'id': id, 'title': id, 'createdAt': '2026-11-19T08:00:00Z'},
              ],
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/threads') && request.method == 'POST') {
          creates++;
          return http.Response('{"thread":{"id":"new"}}', 200);
        }
        if (request.url.path.endsWith('/thread')) {
          final id = request.url.queryParameters['threadId'];
          return http.Response(
            jsonEncode({
              'thread': {'id': id},
              'messages': [message(id!).toJson()],
            }),
            200,
          );
        }
        if (request.url.path.endsWith('/messages')) {
          bodies.add(jsonDecode(request.body) as Map);
          return http.Response(
            'event: done\ndata: {}\n\n',
            200,
            headers: {'content-type': 'text/event-stream'},
          );
        }
        return http.Response('{}', 200);
      });
      final auth =
          CustomerAuth(
              baseUrl: 'https://example.test',
              storage: MemoryAuthStorage(),
              client: client,
            )
            ..session = CustomerSession.fromJson({
              'accessToken': 'token',
              'role': 'user',
              'sessionExpiresAt': '2099-01-01T00:00:00Z',
            });
      addTearDown(auth.dispose);
      final repo = HttpCoachRepository(auth: auth, client: client);
      await repo.selectConversation('b');
      expect((await repo.loadThread()).messages.single.text, 'b');
      final reopened = HttpCoachRepository(auth: auth, client: client);
      expect((await reopened.loadThread()).messages.single.text, 'b');
      await reopened.selectConversation(null);
      expect((await reopened.loadThread()).messages, isEmpty);
      expect(creates, 0);
      await reopened.send(CoachSendRequest.text('one')).toList();
      await reopened.send(CoachSendRequest.text('two')).toList();
      expect(creates, 1);
      expect(bodies.map((b) => b['threadId']), ['new', 'new']);
    },
  );

  test(
    'switching while restoring history cannot send text into the new selection',
    () async {
      final listing = Completer<http.Response>();
      var sent = 0;
      final client = MockClient((request) async {
        if (request.url.path.endsWith('/threads')) return listing.future;
        sent++;
        return http.Response('event: done\ndata: {}\n\n', 200);
      });
      final auth =
          CustomerAuth(
              baseUrl: 'https://example.test',
              storage: MemoryAuthStorage(),
              client: client,
            )
            ..session = CustomerSession.fromJson({
              'accessToken': 'token',
              'role': 'user',
              'sessionExpiresAt': '2099-01-01T00:00:00Z',
            });
      addTearDown(auth.dispose);
      final repo = HttpCoachRepository(auth: auth, client: client);
      final sending = repo
          .send(CoachSendRequest.text('belongs to the old selection'))
          .toList();
      await Future<void>.delayed(Duration.zero);
      await repo.selectConversation('b');
      listing.complete(http.Response('{"threads":[]}', 200));
      await expectLater(sending, throwsA(isA<CoachTransportException>()));
      expect(sent, 0);
      expect(repo.conversationId, 'b');
    },
  );

  testWidgets(
    'history opens in RTL and supports rename, select, new and delete',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = DemoStore()..loginDemoUser();
      addTearDown(store.dispose);
      final seed = MockCoachRepository(store: store);
      await seed.persist([message('پرسش قبلی')]);
      final id = seed.conversationId!;
      await t.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            debugShowCheckedModeBanner: false,
            theme: appTheme(),
            builder: (_, child) =>
                Directionality(textDirection: TextDirection.rtl, child: child!),
            home: CoachPage(
              repository: MockCoachRepository(
                store: store,
                charDelay: Duration.zero,
              ),
            ),
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.tap(find.byKey(const ValueKey('coach-history')));
      await t.pumpAndSettle();
      expect(find.text('گفتگوهای من'), findsOneWidget);
      await t.tap(find.byTooltip('گزینه‌های گفتگو'));
      await t.pumpAndSettle();
      await t.tap(find.text('تغییر نام'));
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const ValueKey('coach-conversation-title')),
        'شام من',
      );
      await t.tap(find.text('ذخیره'));
      await t.pumpAndSettle();
      expect(find.text('شام من'), findsWidgets);
      await t.tap(find.byKey(ValueKey('coach-history-$id')));
      await t.pumpAndSettle();
      expect(find.text('گفتگوهای من'), findsNothing);
      await t.tap(find.byKey(const ValueKey('coach-new-conversation')));
      await t.pumpAndSettle();
      expect(find.byKey(const ValueKey('coach-welcome')), findsOneWidget);
      await t.tap(find.byKey(const ValueKey('coach-history')));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('گزینه‌های گفتگو'));
      await t.pumpAndSettle();
      await t.tap(find.text('حذف گفتگو'));
      await t.pumpAndSettle();
      expect(find.text('حذف گفتگو؟'), findsOneWidget);
      await t.tap(find.widgetWithText(TextButton, 'حذف گفتگو'));
      await t.pumpAndSettle();
      expect(find.byKey(ValueKey('coach-history-$id')), findsNothing);
      expect(t.takeException(), isNull);
    },
  );
}
