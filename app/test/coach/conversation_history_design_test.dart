import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sabzine_flutter/core/theme/theme.dart';
import 'package:sabzine_flutter/features/coach/data/mock_coach_repository.dart';
import 'package:sabzine_flutter/features/coach/domain/coach_conversation.dart';
import 'package:sabzine_flutter/features/coach/presentation/coach_controller.dart';
import 'package:sabzine_flutter/features/coach/presentation/conversation_history.dart';

class _SelectedHistory extends MockCoachRepository {
  @override
  String? get conversationId => 'today';
}

final _today = DateTime(2026, 11, 19, 12);

Widget _host(CoachController controller, {double scale = 1}) => MaterialApp(
  theme: appTheme(),
  builder: (context, child) => MediaQuery(
    data: MediaQuery.of(context).copyWith(textScaler: TextScaler.linear(scale)),
    child: Directionality(textDirection: TextDirection.rtl, child: child!),
  ),
  home: Scaffold(
    body: CoachConversationHistory(controller: controller, today: _today),
  ),
);

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  testWidgets('groups real activity by date and omits a duplicate preview', (
    t,
  ) async {
    t.view.physicalSize = const Size(390, 900);
    t.view.devicePixelRatio = 1;
    addTearDown(t.view.reset);
    final controller = CoachController(repository: _SelectedHistory());
    addTearDown(controller.dispose);
    controller.conversations = [
      CoachConversation(
        id: 'older',
        title: 'قدیمی',
        createdAt: DateTime(2026, 11, 12),
      ),
      CoachConversation(
        id: 'yesterday',
        title: 'پرسش دیروز',
        createdAt: DateTime(2026, 11, 18, 9),
      ),
      CoachConversation(
        id: 'today',
        title: 'پرسش امروز',
        preview: 'پرسش امروز',
        createdAt: DateTime(2026, 11, 12),
        lastMessageAt: DateTime(2026, 11, 19, 10, 24),
      ),
    ];
    await t.pumpWidget(_host(controller));
    expect(find.text('امروز'), findsOneWidget);
    expect(find.text('قدیمی‌تر'), findsOneWidget);
    expect(find.text('دیروز'), findsNWidgets(2));
    expect(find.text('پرسش امروز'), findsOneWidget);
    expect(find.text('۱۰:۲۴'), findsOneWidget);
    final recent = t
        .getTopLeft(find.byKey(const ValueKey('coach-history-today')))
        .dy;
    final yesterday = t
        .getTopLeft(find.byKey(const ValueKey('coach-history-yesterday')))
        .dy;
    final older = t
        .getTopLeft(find.byKey(const ValueKey('coach-history-older')))
        .dy;
    expect(recent, lessThan(yesterday));
    expect(yesterday, lessThan(older));
    expect(t.takeException(), isNull);
  });

  testWidgets(
    'all fifty conversations stay reachable with large Persian text',
    (t) async {
      t.view.physicalSize = const Size(320, 568);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.reset);
      final controller = CoachController(repository: _SelectedHistory());
      addTearDown(controller.dispose);
      controller.conversations = [
        for (var i = 0; i < 50; i++)
          CoachConversation(
            id: '$i',
            title: 'گفتگویی دربارهٔ برنامهٔ غذایی و وعده‌های روزانه $i',
            preview: 'برای انتخاب وعده‌های مناسب امروز با هم صحبت کردیم.',
            createdAt: _today.subtract(Duration(minutes: i)),
          ),
      ];
      await t.pumpWidget(_host(controller, scale: 1.8));
      expect(find.text('۵۰ از ۵۰ گفتگو'), findsOneWidget);
      expect(
        find.text(
          'با ارسال اولین پیام در گفتگوی جدید، قدیمی‌ترین گفتگو حذف می‌شود.',
        ),
        findsOneWidget,
      );
      expect(t.takeException(), isNull);
      await t.scrollUntilVisible(
        find.byKey(const ValueKey('coach-history-49')),
        500,
        maxScrolls: 100,
      );
      expect(find.byKey(const ValueKey('coach-history-49')), findsOneWidget);
      final menu = find.descendant(
        of: find.byKey(const ValueKey('coach-history-49')),
        matching: find.byTooltip('گزینه‌های گفتگو'),
      );
      await t.ensureVisible(menu);
      await t.pumpAndSettle();
      await t.tap(menu);
      await t.pumpAndSettle();
      expect(find.text('تغییر نام'), findsOneWidget);
      expect(find.text('حذف گفتگو'), findsOneWidget);
      expect(t.takeException(), isNull);
    },
  );
}
