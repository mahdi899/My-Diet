import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/features/coach/application/coach_session.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/presentation/message_list.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';

CoachMessage message(
  String id, {
  String? clientId,
  String role = 'assistant',
}) => CoachMessage(
  id: id,
  role: role,
  type: 'text',
  payload: {'text': id},
  fallbackText: id,
  clientMessageId: clientId,
  createdAt: DateTime(2026, 11, 16),
);

class HistoryRepository extends MockCoachRepository {
  final loads = <Completer<CoachThreadPage>>[];
  final turns = <StreamController<CoachEvent>>[];
  final requests = <CoachSendRequest>[];

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) {
    final pending = Completer<CoachThreadPage>();
    loads.add(pending);
    return pending.future;
  }

  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) {
    requests.add(request);
    final turn = StreamController<CoachEvent>();
    turns.add(turn);
    return turn.stream;
  }

  @override
  Future<void> persist(List<CoachMessage> messages) async {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('reopening the local coach never overwrites previous turns', () async {
    final first = CoachSession(
      repository: MockCoachRepository(charDelay: Duration.zero),
    );
    await first.start();
    await first.sendText('سلام');
    final original = [...first.messages];
    await first.repository.persist(first.messages);
    first.close();

    final second = CoachSession(
      repository: MockCoachRepository(charDelay: Duration.zero),
    );
    await second.start();
    await second.sendText('برای شام چی بخورم؟');
    for (final old in original) {
      expect(
        second.messages.where((m) => m.id == old.id).single.toJson(),
        old.toJson(),
      );
    }
    expect(
      second.messages.map((m) => m.id).toSet(),
      hasLength(second.messages.length),
    );
    await second.repository.persist(second.messages);
    final expected = second.messages.map((m) => m.toJson()).toList();
    second.close();

    final third = CoachSession(repository: MockCoachRepository());
    await third.start();
    expect(third.messages.map((m) => m.toJson()).toList(), expected);
    third.close();
  });

  test('late initial history preserves an in-flight user message', () async {
    final repo = HistoryRepository();
    final session = CoachSession(repository: repo);
    final start = session.start();
    final sending = session.sendText('پیام تازه');
    final clientId = repo.requests.single.clientMessageId;
    repo.loads.single.complete(CoachThreadPage(messages: [message('old')]));
    await start;
    expect(session.messages.map((m) => m.text), ['old', 'پیام تازه']);
    expect(session.messages.last.pending, isTrue);
    repo.turns.single.add(
      CoachUserMessage(message('saved-user', clientId: clientId, role: 'user')),
    );
    repo.turns.single.add(const CoachDone());
    await repo.turns.single.close();
    await sending;
    expect(session.messages.map((m) => m.id), ['old', 'saved-user']);
    session.close();
  });

  test(
    'stale refresh preserves completed turns and older loaded history',
    () async {
      final repo = HistoryRepository();
      final session = CoachSession(repository: repo);
      final start = session.start();
      repo.loads.single.complete(CoachThreadPage(messages: [message('old')]));
      await start;
      final refresh = session.retry();
      final sending = session.sendText('پیام تازه');
      repo.turns.single.add(
        CoachUserMessage(
          message(
            'saved-user',
            clientId: repo.requests.single.clientMessageId,
            role: 'user',
          ),
        ),
      );
      repo.turns.single.add(CoachMessageEvent(message('answer')));
      repo.turns.single.add(const CoachDone());
      await repo.turns.single.close();
      await sending;
      repo.loads.last.complete(const CoachThreadPage());
      await refresh;
      expect(session.messages.map((m) => m.id), [
        'old',
        'saved-user',
        'answer',
      ]);
      session.close();
    },
  );

  test(
    'history reconciles server acknowledgements with optimistic messages',
    () async {
      final repo = HistoryRepository();
      final session = CoachSession(repository: repo);
      final sending = session.sendText('پیام تازه');
      final clientId = repo.requests.single.clientMessageId;
      final loading = session.retry();
      repo.loads.single.complete(
        CoachThreadPage(
          messages: [message('saved-user', clientId: clientId, role: 'user')],
        ),
      );
      await loading;
      expect(session.messages, hasLength(1));
      expect(session.messages.single.id, 'saved-user');
      repo.turns.single.add(
        CoachUserMessage(
          message('saved-user', clientId: clientId, role: 'user'),
        ),
      );
      repo.turns.single.add(const CoachDone());
      await repo.turns.single.close();
      await sending;
      expect(session.messages, hasLength(1));
      session.close();
    },
  );

  test(
    'only the latest overlapping history response changes the thread',
    () async {
      final repo = HistoryRepository();
      final session = CoachSession(repository: repo);
      final first = session.retry();
      final second = session.retry();
      repo.loads.last.complete(CoachThreadPage(messages: [message('latest')]));
      await second;
      repo.loads.first.complete(CoachThreadPage(messages: [message('stale')]));
      await first;
      expect(session.messages.map((m) => m.id), ['latest']);
      session.close();
    },
  );

  test('a failed refresh retains history and the send retry state', () async {
    final repo = HistoryRepository();
    final session = CoachSession(repository: repo);
    final sending = session.sendText('پیام تازه');
    repo.turns.single.addError(
      const CoachTransportException(
        'آفلاین',
        problem: CoachProblem.offline,
        retryable: true,
      ),
    );
    await sending;
    final failed = session.messages.single;
    expect(failed.failed, isTrue);
    final refresh = session.retry();
    repo.loads.single.completeError(
      const CoachTransportException(
        'آفلاین',
        problem: CoachProblem.offline,
        retryable: true,
      ),
    );
    await refresh;
    expect(session.messages.single, same(failed));
    expect(session.canRetry, isTrue);
    expect(session.historyFailed, isFalse);
    await repo.turns.single.close();
    session.close();
  });

  test(
    'pagination is single flight and survives a latest-page refresh',
    () async {
      final repo = HistoryRepository();
      final session = CoachSession(repository: repo);
      final start = session.start();
      repo.loads.single.complete(
        CoachThreadPage(
          messages: [message('recent')],
          hasMore: true,
          cursor: 'older',
        ),
      );
      await start;
      final older = session.loadMore();
      await session.loadMore();
      expect(repo.loads, hasLength(2));
      expect(session.loadingMore, isTrue);
      repo.loads.last.complete(CoachThreadPage(messages: [message('old')]));
      await older;
      expect(session.loadingMore, isFalse);
      expect(session.messages.map((m) => m.id), ['old', 'recent']);
      final refresh = session.retry();
      repo.loads.last.complete(CoachThreadPage(messages: [message('recent')]));
      await refresh;
      expect(session.messages.map((m) => m.id), ['old', 'recent']);
      session.close();
    },
  );

  test('stale history cannot overwrite a card updated by the stream', () async {
    final repo = HistoryRepository();
    final session = CoachSession(repository: repo);
    final start = session.start();
    repo.loads.single.complete(CoachThreadPage(messages: [message('card')]));
    await start;
    final refresh = session.retry();
    final sending = session.sendText('ثبت کن');
    final updated = message('card').copyWith(payload: {'text': 'ثبت شد'});
    repo.turns.single.add(CoachMessageEvent(updated));
    repo.turns.single.add(const CoachDone());
    await repo.turns.single.close();
    await sending;
    repo.loads.last.complete(CoachThreadPage(messages: [message('card')]));
    await refresh;
    expect(session.messages.first.text, 'ثبت شد');
    session.close();
  });

  test(
    'interrupted stream retains partial reply and retries without duplicates',
    () async {
      final repo = HistoryRepository();
      final session = CoachSession(repository: repo);
      final sending = session.sendText('سلام');
      await session.sendText('ارسال هم‌زمان');
      expect(repo.requests, hasLength(1));
      repo.turns.single.add(const CoachDelta(streamId: 's', text: 'پاسخ نیمه'));
      await repo.turns.single.close();
      await sending;
      expect(session.draftText, 'پاسخ نیمه');
      expect(session.messages.single.failed, isTrue);
      final retrying = session.retrySend(null);
      expect(
        repo.requests.last.clientMessageId,
        repo.requests.first.clientMessageId,
      );
      repo.turns.last.add(
        CoachUserMessage(
          message(
            'user',
            clientId: repo.requests.last.clientMessageId,
            role: 'user',
          ),
        ),
      );
      repo.turns.last.add(CoachMessageEvent(message('answer')));
      repo.turns.last.add(const CoachDone());
      await repo.turns.last.close();
      await retrying;
      expect(session.messages.map((m) => m.id), ['user', 'answer']);
      expect(session.draftText, isNull);
      expect(session.busy, isFalse);
      expect(session.canRetry, isFalse);
      session.close();
    },
  );

  test(
    'a history response after closing cannot mutate or notify the page',
    () async {
      final repo = HistoryRepository();
      var changes = 0;
      final session = CoachSession(
        repository: repo,
        onChanged: () => changes++,
      );
      final loading = session.retry();
      session.close();
      final before = changes;
      repo.loads.single.complete(CoachThreadPage(messages: [message('late')]));
      await loading;
      expect(session.messages, isEmpty);
      expect(changes, before);
    },
  );

  testWidgets('older history is reachable from the conversation', (t) async {
    final store = DemoStore()..loginDemoUser();
    final repo = HistoryRepository();
    final controller = CoachController(repository: repo);
    final loading = controller.start();
    repo.loads.single.complete(
      CoachThreadPage(
        messages: [message('recent')],
        hasMore: true,
        cursor: 'older',
      ),
    );
    await loading;
    await t.pumpWidget(
      DemoScope(
        store: store,
        child: MaterialApp(
          theme: appTheme(),
          home: Scaffold(
            body: AnimatedBuilder(
              animation: controller,
              builder: (_, _) => CoachMessageList(controller: controller),
            ),
          ),
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.byKey(const ValueKey('coach-load-older')));
    await t.pump();
    expect(find.text('در حال دریافت پیام‌ها…'), findsOneWidget);
    repo.loads.last.complete(CoachThreadPage(messages: [message('old')]));
    await t.pumpAndSettle();
    expect(find.text('old'), findsOneWidget);
    expect(find.text('recent'), findsOneWidget);
    expect(find.byKey(const ValueKey('coach-load-older')), findsNothing);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    controller.dispose();
    store.dispose();
  });

  testWidgets(
    'sending during initial loading immediately shows the user bubble',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = DemoStore()..loginDemoUser();
      final repo = HistoryRepository();
      await t.pumpWidget(
        DemoScope(
          store: store,
          child: MaterialApp(
            theme: appTheme(),
            home: CoachPage(repository: repo),
          ),
        ),
      );
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const ValueKey('coach-input')),
        'پیام حین بارگذاری',
      );
      await t.pump();
      await t.tap(find.byKey(const ValueKey('coach-send')));
      await t.pump(const Duration(milliseconds: 400));
      expect(find.text('پیام حین بارگذاری'), findsOneWidget);
      repo.loads.single.complete(CoachThreadPage(messages: [message('old')]));
      repo.turns.single.add(const CoachDone());
      await repo.turns.single.close();
      await t.pumpAndSettle();
      expect(find.text('پیام حین بارگذاری'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
