import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/data/coach_wire.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/presentation/bubbles.dart';
import 'package:sabzine_flutter/features/coach/presentation/message_list.dart';

import '../operation_states_test.dart' show statusHost;
import '../widget_test.dart' show mobile;

CoachMessage line(
  String id,
  String role,
  String text, {
  String type = 'text',
  Map<String, dynamic> payload = const {},
}) => CoachMessage(
  id: id,
  role: role,
  type: type,
  payload: {'text': text, ...payload},
  fallbackText: text,
  createdAt: DateTime(2026, 11, 20),
);

class PhotoPlanRepository extends MockCoachRepository {
  PhotoPlanRepository(this.history);
  final List<CoachMessage> history;
  final sent = <CoachSendRequest>[];

  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async =>
      CoachThreadPage(messages: history);

  @override
  Future<void> persist(List<CoachMessage> messages) async {}

  @override
  Stream<CoachEvent> send(
    CoachSendRequest request, {
    List<int>? photoBytes,
  }) async* {
    sent.add(request);
    yield CoachMessageEvent(
      line(
        'result',
        'assistant',
        'به برنامه اضافه شد',
        payload: {'planChanged': true, 'photoEntryId': 'entry-1'},
      ),
    );
    yield const CoachDone();
  }
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('RTL keeps user text, photo, quote and delivery on the right', (
    tester,
  ) async {
    mobile(tester);
    final store = DemoStore()..loginDemoUser();
    final repo = PhotoPlanRepository([
      line('coach', 'assistant', 'پاسخ مربی'),
      line(
        'user',
        'user',
        'پیام من',
        payload: {
          'replyTo': {'id': 'coach', 'text': 'متن قبلی'},
        },
      ),
      line('photo', 'user', '', type: 'user_photo'),
    ]);
    final controller = CoachController(repository: repo, animateReplies: false);
    addTearDown(controller.dispose);
    addTearDown(store.dispose);
    await controller.start();
    await tester.pumpWidget(
      statusHost(store, CoachMessageList(controller: controller)),
    );
    await tester.pumpAndSettle();
    expect(tester.getCenter(find.text('پیام من')).dx, greaterThan(195));
    expect(tester.getCenter(find.text('پاسخ مربی')).dx, lessThan(195));
    expect(
      tester.getCenter(find.byType(CoachPhotoBubble)).dx,
      greaterThan(195),
    );
    expect(
      tester.getCenter(find.text('در پاسخ به: متن قبلی')).dx,
      greaterThan(195),
    );
    for (final element in find.text('ارسال شد').evaluate()) {
      expect(
        tester.getCenter(find.byWidget(element.widget)).dx,
        greaterThan(195),
      );
    }
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
  });

  testWidgets(
    'photo explanation asks yes or no and submits only the chosen action',
    (tester) async {
      mobile(tester);
      final store = DemoStore()..loginDemoUser();
      final source = line(
        'proposal',
        'assistant',
        'این عدسی است. به برنامه اضافه کنم؟',
        type: 'quick_replies',
        payload: {
          'entryId': 'entry-1',
          'planDecision': 'pending',
          'prompt': 'این عدسی است. به برنامه اضافه کنم؟',
          'options': [
            {
              'label': 'بله، به برنامه اضافه کن',
              'action': 'confirm_photo_plan',
              'args': {'entryId': 'entry-1'},
            },
            {
              'label': 'نه، اضافه نکن',
              'action': 'dismiss_photo_plan',
              'args': {'entryId': 'entry-1'},
            },
          ],
        },
      );
      final repo = PhotoPlanRepository([source]);
      final controller = CoachController(
        repository: repo,
        animateReplies: false,
      );
      addTearDown(controller.dispose);
      addTearDown(store.dispose);
      bool reloaded = false;
      controller.onToday = (_, {required reloadPlan}) => reloaded = reloadPlan;
      await controller.start();
      await tester.pumpWidget(
        statusHost(
          store,
          AnimatedBuilder(
            animation: controller,
            builder: (_, _) => CoachMessageList(controller: controller),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('این عدسی است. به برنامه اضافه کنم؟'), findsOneWidget);
      expect(repo.sent, isEmpty);
      await tester.tap(find.text('بله، به برنامه اضافه کن'));
      await tester.pumpAndSettle();
      expect(repo.sent, hasLength(1));
      expect(repo.sent.single.action, 'confirm_photo_plan');
      expect(
        coachMessageBody(repo.sent.single)['action'],
        'confirm_photo_plan',
      );
      expect(coachMessageBody(repo.sent.single)['args']['entryId'], 'entry-1');
      expect(reloaded, isTrue);
      expect(
        tester
            .widget<ActionChip>(
              find.widgetWithText(ActionChip, 'نه، اضافه نکن'),
            )
            .onPressed,
        isNull,
      );
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );

  test(
    'typed consent response also refreshes the plan and settles the source',
    () async {
      final repo = PhotoPlanRepository([
        line(
          'proposal',
          'assistant',
          'اضافه کنم؟',
          type: 'quick_replies',
          payload: {'entryId': 'entry-1'},
        ),
      ]);
      final controller = CoachController(
        repository: repo,
        animateReplies: false,
      );
      addTearDown(controller.dispose);
      await controller.start();
      bool reloaded = false;
      controller.onToday = (_, {required reloadPlan}) => reloaded = reloadPlan;
      await controller.sendText('بله');
      await Future<void>.delayed(Duration.zero);
      expect(reloaded, isTrue);
      expect(controller.answered, contains('proposal'));
    },
  );
}
