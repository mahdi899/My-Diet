import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/data/wallet_state_storage.dart';
import 'package:sabzine_flutter/screens/expert.dart';
import 'package:sabzine_flutter/screens/wallet_flow.dart';
import 'package:sabzine_flutter/theme.dart';
import 'package:sabzine_flutter/widgets/ui.dart';
import 'widget_test.dart' show mobile;

class WalletMemory implements WalletStateStorage {
  String? value;
  @override
  Future<String?> read() async => value;
  @override
  Future<void> write(String next) async {
    value = next;
  }
}

Future<void> completeDay(DemoStore s, DateTime date) async {
  for (var i = 0; i < s.mealsOn(date).length; i++) {
    await s.setMealEaten(date, i, true);
  }
}

void main() {
  test(
    'Information request stays queued, unrelated messages do not unlock, answer must be reviewed',
    () {
      final s = DemoStore()..loginDemoUser();
      final r = s.userRequest;
      s.needInfo(r.id, 'دارویی مصرف می‌کنی؟');
      s.beginReview(r.id);
      expect(r.status, PlanStatus.needsInfo);
      expect(() => s.approve(r.id), throwsStateError);
      s.send('پیام پشتیبانی', support: true);
      expect(r.infoAnswer, isEmpty);
      s.send('خیر');
      expect(r.infoAnswer, 'خیر');
      expect(r.status, PlanStatus.reviewing);
      expect(() => s.approve(r.id), throwsStateError);
      s.markInfoAnswerReviewed(r.id);
      s.approve(r.id);
      expect(r.status, PlanStatus.ready);
      s.needInfo(r.id, 'سؤال جدید');
      expect(r.infoAnswer, isEmpty);
      expect(r.infoAnswerReviewed, false);
      expect(r.isPublished, true);
      expect(() => s.approve(r.id), throwsStateError);
      s.dispose();
    },
  );

  test(
    'Deleting AI meal and adding custom ingredients affects draft, not approved copy',
    () {
      final s = DemoStore()..loginDemoUser();
      s.approveActiveUserRequest();
      final r = s.userRequest, original = r.mealsForDay(2).last;
      s.removeMeal(r.id, 3, day: 2);
      const custom = Meal(
        name: 'شام',
        title: 'خوراک خانگی',
        amount: 'عدس: ۱ پیمانه\nنان: ۴۰ گرم',
        time: '۲۰:۰۰',
        details: '',
        calories: 400,
      );
      s.addMeal(r.id, custom, day: 2);
      expect(r.mealsForDay(2).last, original);
      s.approve(r.id);
      expect(r.mealsForDay(2).last.title, custom.title);
      expect(r.mealsForDay(2).last.amount, custom.amount);
      r.draft.clear();
      expect(() => s.approve(r.id), throwsStateError);
      s.dispose();
    },
  );

  test(
    'Only fully eaten scheduled week earns 100 once; repeat, undo, edit, and restart cannot duplicate',
    () async {
      var date = DateTime(2026, 10, 24);
      final memory = WalletMemory();
      final s = DemoStore(clock: () => date, walletStorage: memory)
        ..loginDemoUser();
      s.approveActiveUserRequest();
      final initial = s.walletBalance;
      for (var day = 0; day < 6; day++) {
        date = DateTime(2026, 10, 24 + day);
        await completeDay(s, date);
      }
      expect(s.walletBalance, initial);
      date = DateTime(2026, 10, 30);
      for (var i = 0; i < s.mealsOn(date).length - 1; i++) {
        await s.setMealEaten(date, i, true);
      }
      expect(s.claimWeeklyReward(), false);
      await s.setMealEaten(date, s.mealsOn(date).length - 1, true);
      expect(s.walletBalance, initial + 200000);
      expect(s.weeklyStreak, 1);
      expect(s.claimWeeklyReward(), false);
      await s.setMealEaten(date, 0, false);
      await s.setMealEaten(date, 0, true);
      s.approveActiveUserRequest();
      expect(s.walletBalance, initial + 200000);
      expect(s.pendingWeeklyRewards, [dateKey(startOfWeek(date))]);
      await s.saveWalletState();
      final restored = DemoStore(walletStorage: memory, clock: () => date)
        ..loginDemoUser();
      await restored.restoreWalletState();
      expect(restored.walletBalance, initial + 200000);
      expect(restored.rewardedWeeks, s.rewardedWeeks);
      restored.acknowledgeWeeklyReward(s.pendingWeeklyRewards.first);
      await restored.saveWalletState();
      final again = DemoStore(walletStorage: memory);
      await again.restoreWalletState();
      expect(again.pendingWeeklyRewards, isEmpty);
      expect(
        again.walletTransactions
            .where((t) => t.operationId.startsWith('weekly-reward'))
            .length,
        1,
      );
      s.dispose();
      restored.dispose();
      again.dispose();
    },
  );

  test(
    'Program issued midweek counts prescribed dates only; new request never inherits meal ticks',
    () async {
      var date = DateTime(2026, 10, 28);
      final s = DemoStore(clock: () => date)..loginDemoUser();
      s.approveActiveUserRequest();
      expect(s.scheduledWeekDates.length, 3);
      for (var day = 28; day <= 30; day++) {
        date = DateTime(2026, 10, day);
        await completeDay(s, date);
      }
      expect(s.rewardedWeeks.length, 1);
      expect(s.mealsOn(DateTime(2026, 10, 31)), isEmpty);
      s.submitQuestionnaire();
      s.approveActiveUserRequest();
      expect(s.eatenCount(date), 0);
      expect(s.consumedCalories(date), 0);
      await completeDay(s, date);
      expect(s.rewardedWeeks.length, 1);
      expect(s.walletBalance, 200000);
      s.dispose();
    },
  );

  testWidgets(
    'Expert sees blocked confirmation, reads answer then confirmation unlocks',
    (t) async {
      mobile(t);
      final s = DemoStore()..loginDemoUser();
      s.needInfo(s.userRequestId!, 'ساعت شام؟');
      s.login(AppRole.expert);
      await t.pumpWidget(
        DemoScope(
          store: s,
          child: MaterialApp(
            theme: appTheme(),
            home: ReviewScreen(requestId: s.userRequestId!),
          ),
        ),
      );
      await t.pumpAndSettle();
      expect(
        t
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'تأیید و ارسال برنامه'),
            )
            .onPressed,
        isNull,
      );
      s.login(AppRole.user);
      s.send('ساعت هشت');
      s.login(AppRole.expert);
      await t.pumpAndSettle();
      final read = find.byKey(const ValueKey('review-information-answer'));
      await t.ensureVisible(read);
      await t.tap(read);
      await t.pumpAndSettle();
      expect(
        t
            .widget<FilledButton>(
              find.widgetWithText(FilledButton, 'تأیید و ارسال برنامه'),
            )
            .onPressed,
        isNotNull,
      );
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );

  testWidgets(
    'Custom meal editor adds slot, food items and quantities without any catalogue',
    (t) async {
      mobile(t);
      final s = DemoStore();
      await t.pumpWidget(
        DemoScope(
          store: s,
          child: MaterialApp(
            theme: appTheme(),
            home: const ReviewScreen(requestId: '1042'),
          ),
        ),
      );
      await t.pumpAndSettle();
      final add = find.text('افزودن وعده به برنامه');
      await t.ensureVisible(add);
      await t.pumpAndSettle();
      await t.tap(add);
      await t.pumpAndSettle();
      Future<void> enter(String label, String value) async {
        final field = find.byWidgetPredicate(
          (w) => w is TextField && w.decoration?.labelText == label,
        );
        await t.ensureVisible(field);
        await t.enterText(field, value);
        await t.pumpAndSettle();
      }

      await enter('نام غذا', 'شام تازه');
      await enter('آیتم‌ها و مقدار دقیق هر کدام', 'مرغ: ۱۰۰ گرم\nنان: ۵۰ گرم');
      await enter('انرژی وعده / کیلوکالری', '۴۰۰');
      await enter('ساعت وعده', '۲۰:۰۰');
      final save = find.widgetWithText(PrimaryButton, 'افزودن به برنامه');
      await t.ensureVisible(save);
      await t.tap(save);
      await t.pumpAndSettle();
      expect(s.request('1042').draft.last.title, 'شام تازه');
      expect(s.request('1042').draft.last.name, 'شام');
      expect(s.request('1042').draft.last.amount, contains('۱۰۰ گرم'));
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );

  testWidgets(
    'Weekly congratulations credits once and renew button opens selected new-plan purchase',
    (t) async {
      mobile(t);
      var date = DateTime(2026, 10, 24);
      final s = DemoStore(clock: () => date)..loginDemoUser();
      s.approveActiveUserRequest();
      for (var day = 24; day <= 30; day++) {
        date = DateTime(2026, 10, day);
        await completeDay(s, date);
      }
      s.questionnaireComplete = true;
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      expect(find.text('تبریک! هفته‌ات را کامل کردی 🎉'), findsOneWidget);
      await t.tap(find.widgetWithText(FilledButton, 'دریافت برنامه جدید'));
      await t.pumpAndSettle();
      expect(find.byType(PlanServicesScreen), findsOneWidget);
      expect(s.selectedPlanServiceId, 'new-plan');
      expect(s.walletBalance, 200000);
      expect(s.pendingWeeklyRewards, isEmpty);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
}
