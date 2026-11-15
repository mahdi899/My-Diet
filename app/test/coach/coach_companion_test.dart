import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_events.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_message.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_companion.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_header.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_page.dart';

class ControlledCoach extends MockCoachRepository {
  ControlledCoach(DemoStore store)
    : super(store: store, charDelay: Duration.zero);
  final turns = <StreamController<CoachEvent>>[];
  @override
  Future<CoachThreadPage> loadThread({String? cursor}) async =>
      const CoachThreadPage();
  @override
  Future<void> persist(List<CoachMessage> messages) async {}
  @override
  Stream<CoachEvent> send(CoachSendRequest request, {List<int>? photoBytes}) {
    final stream = StreamController<CoachEvent>();
    turns.add(stream);
    return stream.stream;
  }

  void add(CoachEvent event) => turns.last.add(event);
  Future<void> finish() => turns.last.close();
}

DemoStore ready() {
  final store = DemoStore(clock: () => DateTime(2026, 11, 9, 12, 30))
    ..loginDemoUser();
  store.approveActiveUserRequest();
  return store;
}

Widget companionHost({
  CompanionMood mood = CompanionMood.greeting,
  int cue = 0,
  bool reduced = false,
  bool enabled = true,
}) => MaterialApp(
  home: MediaQuery(
    data: MediaQueryData(disableAnimations: reduced),
    child: TickerMode(
      enabled: enabled,
      child: CoachCompanion(mood: mood, cue: cue),
    ),
  ),
);

Widget pageHost(
  DemoStore store,
  ControlledCoach repo, {
  double inset = 0,
  double scale = 1,
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

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));
  setUpAll(() async {
    await (FontLoader('Vazirmatn')
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))
          ..addFont(rootBundle.load('assets/fonts/Vazirmatn-Bold.ttf')))
        .load();
  });

  testWidgets(
    'every reaction ends; a fresh cue replays once; reduce motion and hidden routes stop it',
    (t) async {
      await t.pumpWidget(companionHost());
      expect(t.binding.transientCallbackCount, greaterThan(0));
      await t.pumpAndSettle();
      expect(t.binding.transientCallbackCount, 0);
      await t.pumpWidget(companionHost(cue: 1));
      expect(t.binding.transientCallbackCount, greaterThan(0));
      await t.pump(const Duration(milliseconds: 200));
      await t.pumpWidget(companionHost(cue: 1, reduced: true));
      expect(t.binding.transientCallbackCount, 0);
      await t.pumpWidget(companionHost(cue: 2, enabled: false));
      expect(t.binding.transientCallbackCount, 0);
      await t.pumpWidget(companionHost(cue: 3));
      expect(t.binding.transientCallbackCount, greaterThan(0));
      await t.pumpAndSettle();
      expect(t.takeException(), isNull);
    },
  );

  testWidgets('each visual mood has a meaningful accessible description', (
    t,
  ) async {
    final semantics = t.ensureSemantics();
    for (final mood in CompanionMood.values) {
      await t.pumpWidget(companionHost(mood: mood, reduced: true));
      expect(find.bySemanticsLabel(RegExp('جوانه')), findsOneWidget);
      expect(t.binding.transientCallbackCount, 0);
    }
    semantics.dispose();
  });

  testWidgets(
    'only confirmed writes celebrate; pending sends think, errors support and greeting stays local',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = ready();
      final repo = ControlledCoach(store);
      await t.pumpWidget(pageHost(store, repo));
      await t.pumpAndSettle();
      CompanionMood mood() =>
          t.widget<CoachHeader>(find.byType(CoachHeader)).mood;
      expect(mood(), CompanionMood.greeting);
      expect(repo.turns, isEmpty);
      await t.pump(const Duration(seconds: 3));
      expect(mood(), CompanionMood.calm);
      await t.tap(find.byKey(const ValueKey('coach-companion-greet')));
      await t.pumpAndSettle();
      expect(mood(), CompanionMood.greeting);
      expect(repo.turns, isEmpty);
      await t.tap(find.byKey(const ValueKey('coach-quick-water')));
      await t.pumpAndSettle();
      expect(mood(), CompanionMood.thinking);
      expect(find.text('یک قدم دیگر برای خودت'), findsNothing);
      repo.add(const CoachDone());
      await repo.finish();
      await t.pumpAndSettle();
      expect(mood(), CompanionMood.celebrate);
      expect(find.text('یک قدم دیگر برای خودت'), findsOneWidget);
      await t.pump(const Duration(seconds: 3));
      expect(mood(), CompanionMood.calm);
      await t.enterText(
        find.byKey(const ValueKey('coach-input')),
        'برای شام چی بخورم؟',
      );
      await t.pump();
      await t.tap(find.byKey(const ValueKey('coach-send')));
      await t.pumpAndSettle();
      repo.add(
        const CoachErrorEvent(
          code: 'offline',
          message: 'ارتباط قطع شد',
          problem: CoachProblem.offline,
          retryable: true,
        ),
      );
      await repo.finish();
      await t.pumpAndSettle();
      expect(mood(), CompanionMood.support);
      expect(find.text('یک قدم دیگر برای خودت'), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );

  test(
    'read-only totals and replayed writes never produce a save celebration',
    () async {
      final store = ready();
      final repo = ControlledCoach(store);
      final controller = CoachController(repository: repo);
      final feedback = <bool>[];
      controller.onTurnCompleted = ({required bool saved}) =>
          feedback.add(saved);
      await controller.start();
      expect(feedback, isEmpty);
      var pending = controller.sendAction('show_ring', const {});
      repo.add(const CoachDone());
      await repo.finish();
      await pending;
      expect(feedback, [false]);
      pending = controller.sendAction('log_water', const {'glasses': 1});
      repo.add(const CoachDone(replayed: true));
      await repo.finish();
      await pending;
      expect(feedback, [false]);
      pending = controller.sendAction('log_weight', const {'kilograms': 70});
      repo.add(const CoachDone());
      await repo.finish();
      await pending;
      expect(feedback, [false, true]);
      controller.dispose();
      store.dispose();
    },
  );

  testWidgets(
    'greeting on a narrow screen with large text gives space back to the keyboard',
    (t) async {
      t.view.physicalSize = const Size(320, 740);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final store = ready();
      final repo = ControlledCoach(store);
      await t.pumpWidget(pageHost(store, repo, scale: 1.5));
      await t.pumpAndSettle();
      expect(find.byType(CoachCompanionNote), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(pageHost(store, repo, scale: 1.5, inset: 290));
      await t.pumpAndSettle();
      expect(find.byType(CoachCompanionNote), findsNothing);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      store.dispose();
    },
  );
}
