import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/application/coach_session.dart';
import 'package:sabzine_flutter/features/coach/data/coach_notebook.dart';
import 'package:sabzine_flutter/features/coach/data/coach_wire.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';
import 'package:sabzine_flutter/features/coach/presentation/quota_indicator.dart';
import 'package:sabzine_flutter/features/coach/presentation/composer.dart';
import 'package:sabzine_flutter/features/coach/presentation/message_list.dart';
import 'package:sabzine_flutter/features/coach/presentation/photo_preview.dart';
import 'package:sabzine_flutter/features/coach/presentation/workspace_pages.dart';

CoachMessage note(String text, {String? id, String role = 'user'}) =>
    CoachMessage(
      id: id ?? text,
      role: role,
      type: 'text',
      payload: {'text': text},
      fallbackText: text,
      createdAt: DateTime(2026, 11, 19, 12),
    );

class HeldCoach extends MockCoachRepository {
  final stream = StreamController<CoachEvent>.broadcast();
  final requests = <CoachSendRequest>[];
  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) {
    requests.add(request);
    return stream.stream;
  }
}

class QuotaCoach extends MockCoachRepository {
  QuotaCoach({required super.store}) : super(charDelay: Duration.zero);
  int reads = 0;
  @override
  Future<Map<String, dynamic>> quota() async => {
    'hasQuota': true,
    'dailyRemaining': 20 - ++reads,
    'dailyLimit': 20,
    'periodRemaining': 90,
  };
}

class DelayedSelectionCoach extends MockCoachRepository {
  DelayedSelectionCoach({required super.store})
    : super(charDelay: Duration.zero);
  @override
  Future<void> selectConversation(String? id) async {
    await Future<void>.delayed(const Duration(milliseconds: 100));
    await super.selectConversation(id);
  }
}

Widget host(Widget page) => MaterialApp(
  theme: appTheme(),
  builder: (_, child) =>
      Directionality(textDirection: TextDirection.rtl, child: child!),
  home: page,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test(
    'drafts and saved messages are isolated by owner and survive thread deletion',
    () async {
      const first = CoachNotebook('one');
      const second = CoachNotebook('two');
      final repo = MockCoachRepository();
      await repo.persist([note('عدسی')]);
      final id = repo.conversationId!;
      await first.saveDraft(id, 'متن ناتمام', note('پاسخ').toJson());
      await first.bookmark(note('توصیه مهم'), id, 'شام');
      await repo.deleteConversation(id);
      expect((await first.saved()).single['text'], 'توصیه مهم');
      expect((await first.draft(id))['text'], 'متن ناتمام');
      expect(await second.saved(), isEmpty);
      expect(await second.draft(id), isEmpty);
      await first.removeBookmark('توصیه مهم');
      expect(await first.saved(), isEmpty);
    },
  );

  test(
    'reply keeps its source on the request and stop ignores late stream events',
    () async {
      final repo = HeldCoach();
      final session = CoachSession(repository: repo);
      addTearDown(session.close);
      session.setReply(
        note(
          'غذای پیشنهادی',
          id: '11111111-1111-4111-8111-111111111111',
          role: 'assistant',
        ),
      );
      final sending = session.sendText('چقدر بخورم؟');
      await Future<void>.delayed(Duration.zero);
      expect(
        coachMessageBody(repo.requests.single)['replyToMessageId'],
        '11111111-1111-4111-8111-111111111111',
      );
      repo.stream.add(
        const CoachDelta(streamId: 'turn', text: 'پاسخ نیمه‌کاره'),
      );
      await Future<void>.delayed(Duration.zero);
      await session.stopResponse();
      await sending;
      expect(session.busy, isFalse);
      expect(session.messages.last.text, 'پاسخ نیمه‌کاره');
      expect(session.messages.first.pending, isFalse);
      expect((await repo.loadThread()).messages.last.text, 'پاسخ نیمه‌کاره');
      repo.stream.add(CoachMessageEvent(note('پاسخ دیررس', role: 'assistant')));
      await Future<void>.delayed(Duration.zero);
      expect(session.messages.any((m) => m.text == 'پاسخ دیررس'), isFalse);
      await repo.stream.close();
    },
  );

  testWidgets(
    'composer restores a separate draft after switching away and reopening',
    (t) async {
      final repo = MockCoachRepository();
      await repo.persist([note('اول')]);
      final first = repo.conversationId!;
      await repo.selectConversation(null);
      await repo.persist([note('دوم')]);
      final second = repo.conversationId!;
      final controller = CoachController(repository: repo);
      addTearDown(controller.dispose);
      await repo.selectConversation(first);
      Widget composer() => host(
        Scaffold(
          body: CoachComposer(
            key: ValueKey(repo.conversationId),
            controller: controller,
          ),
        ),
      );
      await t.pumpWidget(composer());
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const ValueKey('coach-input')),
        'پیش‌نویس اول',
      );
      await t.pumpAndSettle();
      await repo.selectConversation(second);
      await t.pumpWidget(composer());
      await t.pumpAndSettle();
      expect(
        t
            .widget<TextField>(find.byKey(const ValueKey('coach-input')))
            .controller!
            .text,
        isEmpty,
      );
      await t.enterText(
        find.byKey(const ValueKey('coach-input')),
        'پیش‌نویس دوم',
      );
      await t.pumpAndSettle();
      await repo.selectConversation(first);
      await t.pumpWidget(composer());
      await t.pumpAndSettle();
      expect(
        t
            .widget<TextField>(find.byKey(const ValueKey('coach-input')))
            .controller!
            .text,
        'پیش‌نویس اول',
      );
      expect((await controller.notebook.draft(second))['text'], 'پیش‌نویس دوم');
      expect(t.takeException(), isNull);
    },
  );

  testWidgets('message menu can quote and save a message', (t) async {
    final controller = CoachController(repository: MockCoachRepository());
    addTearDown(controller.dispose);
    controller.loading = false;
    controller.messages = [note('توصیه شام', role: 'assistant')];
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    await t.pumpWidget(
      DemoScope(
        store: store,
        child: host(Scaffold(body: CoachMessageList(controller: controller))),
      ),
    );
    await t.tap(find.byTooltip('گزینه‌های پیام'));
    await t.pumpAndSettle();
    await t.tap(find.text('ذخیره در نشان‌شده‌ها'));
    await t.pumpAndSettle();
    expect((await controller.notebook.saved()).single['text'], 'توصیه شام');
    await t.pump(const Duration(seconds: 5));
    await t.pumpAndSettle();
    await t.tap(find.byTooltip('گزینه‌های پیام'));
    await t.pumpAndSettle();
    await t.tap(find.text('پاسخ به همین پیام'));
    await t.pumpAndSettle();
    expect(controller.replyTo!.text, 'توصیه شام');
  });

  testWidgets(
    'search includes an old message and opens its actual conversation',
    (t) async {
      final repo = MockCoachRepository();
      await repo.persist([
        note('عدسی قدیمی'),
        for (var i = 0; i < 65; i++) note('ادامه $i'),
      ]);
      final id = repo.conversationId!;
      final controller = CoachController(repository: repo);
      addTearDown(controller.dispose);
      await t.pumpWidget(host(CoachLibraryPage(controller: controller)));
      await t.enterText(
        find.byKey(const ValueKey('coach-search-input')),
        'عدسی قدیمی',
      );
      await t.pumpAndSettle(const Duration(milliseconds: 400));
      expect(find.text('عدسی قدیمی'), findsWidgets);
      await t.tap(find.text('رفتن به پیام').first);
      await t.pumpAndSettle();
      expect(controller.conversationId, id);
      expect(controller.highlightedMessageId, 'عدسی قدیمی');
      expect(controller.messages.any((m) => m.id == 'عدسی قدیمی'), isTrue);
    },
  );

  testWidgets(
    'photo preview waits for confirmation and returns portion and meal',
    (t) async {
      final selection = CoachPhotoSelection(
        'meal.png',
        base64Decode(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        ),
      );
      Map<String, dynamic>? result;
      await t.pumpWidget(
        host(
          Builder(
            builder: (context) => Scaffold(
              body: TextButton(
                onPressed: () async {
                  result = await Navigator.push(
                    context,
                    MaterialPageRoute<Map<String, dynamic>>(
                      builder: (_) => CoachPhotoPreview(
                        selection: selection,
                        replace: () async => null,
                      ),
                    ),
                  );
                },
                child: const Text('عکس'),
              ),
            ),
          ),
        ),
      );
      await t.tap(find.text('عکس'));
      await t.pumpAndSettle();
      expect(result, isNull);
      await t.tap(find.text('نصف'));
      await t.pumpAndSettle();
      await t.enterText(find.byType(TextField).last, 'عدسی');
      t.testTextInput.hide();
      await t.pumpAndSettle();
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('coach-confirm-photo')),
        300,
        scrollable: find
            .descendant(
              of: find.byType(CoachPhotoPreview),
              matching: find.byType(Scrollable),
            )
            .first,
      );
      await t.tap(find.byKey(const ValueKey('coach-confirm-photo')));
      await t.pumpAndSettle();
      expect(result!['caption'], contains('نصف'));
      expect(result!['caption'], contains('عدسی'));
      expect(result!['meal'], 'lunch');
      expect(t.takeException(), isNull);
    },
  );

  testWidgets('memory edits and forgets an actual stored preference', (
    t,
  ) async {
    final repo = MockCoachRepository();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'coach.memory.${repo.workspaceOwner}',
      jsonEncode([
        {'id': 'like', 'key': 'food_like', 'value': 'عدسی', 'source': 'user'},
      ]),
    );
    final controller = CoachController(repository: repo);
    addTearDown(controller.dispose);
    await t.pumpWidget(host(CoachMemoryPage(controller: controller)));
    await t.pumpAndSettle();
    await t.tap(find.text('اصلاح'));
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextField), 'خوراک لوبیا');
    await t.tap(find.text('ذخیره'));
    await t.pumpAndSettle();
    expect(find.text('خوراک لوبیا'), findsOneWidget);
    await t.tap(find.text('فراموش کن'));
    await t.pumpAndSettle();
    await t.tap(find.widgetWithText(TextButton, 'فراموش کن').last);
    await t.pumpAndSettle();
    expect((await repo.memory())['preferences'], isEmpty);
    expect(t.takeException(), isNull);
  });

  testWidgets('remaining messages refresh after a completed turn', (t) async {
    final store = DemoStore()..loginDemoUser();
    addTearDown(store.dispose);
    final repo = QuotaCoach(store: store);
    await t.pumpWidget(
      DemoScope(
        store: store,
        child: host(CoachPage(repository: repo)),
      ),
    );
    await t.pumpAndSettle();
    expect(
      t.widget<QuotaIndicator>(find.byType(QuotaIndicator)).dailyRemaining,
      19,
    );
    final controller = t
        .widget<CoachComposer>(find.byType(CoachComposer))
        .controller;
    final sending = controller.sendText('پرسش جدید');
    await t.pumpAndSettle();
    await sending;
    await t.pumpAndSettle();
    expect(
      t.widget<QuotaIndicator>(find.byType(QuotaIndicator)).dailyRemaining,
      18,
    );
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
  });

  testWidgets(
    'memory recap expands without losing text and specialist notes stay read only',
    (t) async {
      final repo = MockCoachRepository();
      await repo.persist([
        note('شام سریع می‌خوام.\nبا مواد اولیه کم.', id: 'first'),
        note('زمان آشپزی رو در نظر می‌گیرم.', id: 'second', role: 'assistant'),
        note('متن سوم مرور گفتگو', id: 'third'),
        for (var i = 0; i < 7; i++) note('پیام اخیر $i', id: 'recent$i'),
      ]);
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        'coach.memory.${repo.workspaceOwner}',
        jsonEncode([
          {
            'id': 'specialist',
            'key': 'specialist_note',
            'value': 'یادداشت متخصص درباره برنامه',
            'source': 'specialist',
          },
        ]),
      );
      final controller = CoachController(repository: repo);
      addTearDown(controller.dispose);
      await t.pumpWidget(host(CoachMemoryPage(controller: controller)));
      await t.pumpAndSettle();
      expect(find.text('اصلاح'), findsNothing);
      expect(find.text('فراموش کن'), findsNothing);
      expect(find.text('متن سوم مرور گفتگو'), findsNothing);
      await t.ensureVisible(find.text('نمایش مرور گفتگو'));
      await t.pumpAndSettle();
      await t.tap(find.text('نمایش مرور گفتگو'));
      await t.pumpAndSettle();
      expect(find.text('شام سریع می‌خوام.\nبا مواد اولیه کم.'), findsOneWidget);
      expect(find.text('متن سوم مرور گفتگو'), findsOneWidget);
      await t.ensureVisible(find.text('بستن مرور گفتگو'));
      await t.pumpAndSettle();
      await t.tap(find.text('بستن مرور گفتگو'));
      await t.pumpAndSettle();
      expect(find.text('متن سوم مرور گفتگو'), findsNothing);
      expect(t.takeException(), isNull);
    },
  );

  testWidgets('library and memory fit a narrow screen with large text', (
    t,
  ) async {
    t.view.physicalSize = const Size(320, 568);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final repo = MockCoachRepository();
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      'coach.memory.${repo.workspaceOwner}',
      jsonEncode([
        for (final key in ['food_like', 'pattern', 'food_dislike'])
          {
            'id': key,
            'key': key,
            'value':
                'یک ترجیح غذایی طولانی برای بررسی خوانایی و شکستن خطوط متن',
            'source': 'user',
          },
      ]),
    );
    await repo.persist([
      for (var i = 0; i < 10; i++)
        note('متن بلند گفتگو برای بررسی نمایش در صفحه کوچک $i', id: 'large$i'),
    ]);
    final controller = CoachController(repository: repo);
    addTearDown(controller.dispose);
    Widget large(Widget page) => MaterialApp(
      theme: appTheme(),
      builder: (context, child) => MediaQuery(
        data: MediaQuery.of(
          context,
        ).copyWith(textScaler: TextScaler.linear(1.8)),
        child: Directionality(textDirection: TextDirection.rtl, child: child!),
      ),
      home: page,
    );
    await t.pumpWidget(large(CoachLibraryPage(controller: controller)));
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await t.pumpWidget(large(CoachMemoryPage(controller: controller)));
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await t.scrollUntilVisible(find.text('نمایش مرور گفتگو'), 250);
    await t.pumpAndSettle();
    await t.tap(find.text('نمایش مرور گفتگو'));
    await t.pumpAndSettle();
    await t.scrollUntilVisible(
      find.text('بستن مرور گفتگو'),
      250,
      scrollable: find.byType(Scrollable).first,
    );
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
  });

  testWidgets(
    'opening a new chat while selection is delayed never restores the old draft',
    (t) async {
      final store = DemoStore()..loginDemoUser();
      addTearDown(store.dispose);
      final seed = MockCoachRepository(store: store);
      await seed.persist([note('گفتگوی قبلی')]);
      final old = seed.conversationId!;
      final repo = DelayedSelectionCoach(store: store);
      await t.pumpWidget(
        DemoScope(
          store: store,
          child: host(CoachPage(repository: repo)),
        ),
      );
      await t.pumpAndSettle();
      await t.enterText(
        find.byKey(const ValueKey('coach-input')),
        'پیش‌نویس قدیمی',
      );
      await t.pumpAndSettle();
      final controller = t
          .widget<CoachComposer>(find.byType(CoachComposer))
          .controller;
      final opening = controller.newConversation();
      await t.pump();
      await t.pump(const Duration(milliseconds: 150));
      await opening;
      await t.pumpAndSettle();
      expect(
        t
            .widget<TextField>(find.byKey(const ValueKey('coach-input')))
            .controller!
            .text,
        isEmpty,
      );
      await t.enterText(find.byKey(const ValueKey('coach-input')), 'پرسش تازه');
      await t.pumpAndSettle();
      expect((await controller.notebook.draft(old))['text'], 'پیش‌نویس قدیمی');
      expect((await controller.notebook.draft(null))['text'], 'پرسش تازه');
      await t.pumpWidget(const SizedBox());
    },
  );

  testWidgets('a gallery replacement failure keeps the original photo usable', (
    t,
  ) async {
    final bytes = base64Decode(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    );
    await t.pumpWidget(
      host(
        CoachPhotoPreview(
          selection: CoachPhotoSelection('original.png', bytes),
          replace: () async => throw StateError('permission denied'),
        ),
      ),
    );
    await t.pumpAndSettle();
    await t.tap(find.text('تغییر عکس'));
    await t.pumpAndSettle();
    expect(
      find.text('عکس جدید باز نشد؛ عکس قبلی هنوز انتخاب شده.'),
      findsOneWidget,
    );
    expect(t.takeException(), isNull);
    expect(t.widget<Image>(find.byType(Image)).image, isA<MemoryImage>());
  });
}
