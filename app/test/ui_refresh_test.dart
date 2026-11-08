import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/presentation/screens/pricing_admin.dart';
import 'package:sabzine_flutter/presentation/widgets/weekly_progress.dart';
import 'package:sabzine_flutter/presentation/screens/shared.dart';
import 'widget_test.dart' show mobile;
import 'panels_test.dart' show SettingsMemory;

Future<void> completeProgram(DemoStore s) async {
  for (final date in s.scheduledWeekDates) {
    for (var i = 0; i < s.mealsOn(date).length; i++) {
      await s.setMealEaten(date, i, true);
    }
  }
}

void main() {
  test(
    'Admin monetary prices persist, reward credits once, old rewards retain original amount',
    () async {
      var now = DateTime(2026, 10, 24);
      final memory = SettingsMemory(),
          s = DemoStore(settingsStorage: memory, clock: () => now)
            ..loginDemoUser();
      expect(s.experts.length, 1);
      expect(
        s.requests.every((r) => r.specialist == s.experts.first.name),
        true,
      );
      await s.savePricing(
        plan: 620000,
        ai: 180000,
        expert: 300000,
        reward: 220000,
      );
      expect(s.serviceById('new-plan')!.priceToman, 620000);
      s.setDebugWalletBalance(620000);
      expect(s.tryPurchasePlanService('new-plan'), true);
      expect(s.walletBalance, 0);
      expect(s.userRequest.specialist, s.experts.first.name);
      s.approveActiveUserRequest();
      now = DateTime(2026, 10, 30);
      await completeProgram(s);
      expect(s.walletBalance, 220000);
      expect(s.claimWeeklyReward(), false);
      final week = dateKey(s.userRequest.programWeek!);
      await s.savePricing(
        plan: 500000,
        ai: 150000,
        expert: 250000,
        reward: 100000,
      );
      expect(s.rewardForWeek(week), 220000);
      expect(s.walletBalance, 220000);
      final restored = DemoStore(settingsStorage: memory);
      await restored.restoreWorkspaceSettings();
      expect(restored.weeklyRewardToman, 100000);
      expect(restored.newPlanPrice, 500000);
      memory.fail = true;
      await expectLater(
        s.savePricing(plan: 1, ai: 1, expert: 1, reward: 1),
        throwsStateError,
      );
      expect(s.newPlanPrice, 500000);
      s.dispose();
      restored.dispose();
    },
  );
  test(
    'Weekly feedback requires completion, sends rating to support, moderation cannot distort statistics',
    () async {
      final s = DemoStore(clock: () => DateTime(2026, 10, 30))..loginDemoUser();
      expect(() => s.submitProgramReview('زود است'), throwsStateError);
      s.approveActiveUserRequest();
      await completeProgram(s);
      final before = s.programReviews.length;
      final completedId = s.userRequestId;
      s.submitQuestionnaire();
      s.submitProgramReview(
        'تهیه غذاها زمان زیادی می‌خواست',
        rating: 2,
        publishConsent: true,
      );
      expect(s.programReviews.first.requestId, completedId);
      expect(s.programReviews.length, before + 1);
      final review = s.programReviews.first;
      expect(s.threadMessages('support-main').last.text, contains('امتیاز ۲'));
      expect(s.approvedReviewsForDashboard().contains(review), false);
      final mean = s.clinicianRating;
      s.rejectProgramReview(review.id);
      expect(s.clinicianRating, mean);
      expect(s.pendingProgramReviews().contains(review), false);
      expect(
        () => s.submitProgramReview('دوباره', rating: 5),
        throwsStateError,
      );
      s.approveProgramReview(review.id);
      expect(s.approvedReviewsForDashboard().contains(review), true);
      expect(s.clinicianRating, mean);
      s.dispose();
    },
  );
  test(
    'Weight updates are date stamped and replace measurement for same day',
    () {
      var now = DateTime(2026, 10, 28);
      final s = DemoStore(clock: () => now);
      final count = s.weightEntries.length;
      s.addWeight(71.5);
      expect(s.weightEntries.length, count);
      expect(s.weightEntryDates.last, now);
      s.addWeight(71.2);
      expect(s.weightEntries.length, count);
      now = now.add(const Duration(days: 1));
      s.addWeight(71);
      expect(s.weightEntries.length, count + 1);
      expect(s.weightEntryDates.last, now);
      s.dispose();
    },
  );
  testWidgets('Full calendar week appears even if program was issued midweek', (
    t,
  ) async {
    mobile(t);
    final s = DemoStore(clock: () => DateTime(2026, 10, 28))..loginDemoUser();
    s.approveActiveUserRequest();
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    await t.tap(find.text('برنامه'));
    await t.pumpAndSettle();
    final card = find.byType(WeeklyStreakCard);
    await t.ensureVisible(card);
    await t.pumpAndSettle();
    for (final day in persianWeekDays) {
      expect(
        find.descendant(of: card, matching: find.text(day)),
        findsOneWidget,
      );
    }
    expect(find.text('استریک این هفته'), findsNothing);
    expect(find.textContaining('هفتهٔ متوالی'), findsNothing);
    expect(find.textContaining('روز برنامه تکمیل شده'), findsNothing);
    expect(find.text('هدف روزانه'), findsNothing);
    expect(find.text('با تیک «خوردم»'), findsNothing);
    final todayProgress = find.byKey(
      ValueKey('day-progress-${dateKey(s.today)}'),
    );
    expect(t.widget<DayMealProgress>(todayProgress).progress, 0);
    await s.setMealEaten(s.today, 0, true);
    await s.setMealEaten(s.today, 1, true);
    await t.pumpAndSettle();
    expect(t.widget<DayMealProgress>(todayProgress).progress, .5);
    await s.setMealEaten(s.today, 2, true);
    await t.pumpAndSettle();
    expect(t.widget<DayMealProgress>(todayProgress).progress, .75);
    await s.setMealEaten(s.today, 3, true);
    await t.pumpAndSettle();
    expect(t.widget<DayMealProgress>(todayProgress).progress, 1);

    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    s.dispose();
  });
  testWidgets(
    'Doctor message opens direct chat; profile groups about rows and has one personal entry',
    (t) async {
      mobile(t);
      final s = DemoStore()..loginDemoUser();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      await t.tap(find.byTooltip('پیام‌ها'));
      await t.pumpAndSettle();
      expect(find.byType(MessagesScreen), findsOneWidget);
      expect(find.byType(ChatScreen), findsNothing);
      Navigator.of(t.element(find.byType(MessagesScreen))).pop();
      await t.pumpAndSettle();
      final contact = find.byTooltip('پیام به متخصص');
      await Scrollable.ensureVisible(t.element(contact), alignment: .5);
      await t.pumpAndSettle();
      await t.tap(contact);
      await t.pumpAndSettle();
      expect(find.byType(ChatScreen), findsOneWidget);
      Navigator.of(t.element(find.byType(ChatScreen))).pop();
      await t.pumpAndSettle();
      await t.tap(find.byType(NavigationDestination).at(3));
      await t.pumpAndSettle();
      expect(find.text('اطلاعات فردی'), findsOneWidget);
      expect(find.text('ویرایش پرسش‌نامه'), findsNothing);
      expect(find.text('درباره برنامه'), findsOneWidget);
      expect(t.takeException(), isNull);
      await t.pumpWidget(const SizedBox());
      s.dispose();
    },
  );
  testWidgets('Tracking charts and price editor fit a narrow mobile screen', (
    t,
  ) async {
    mobile(t);
    t.view.physicalSize = const Size(320, 760);
    final s = DemoStore()..loginDemoUser();
    s.approveActiveUserRequest();
    await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
    await t.pumpAndSettle();
    await t.tap(find.byType(NavigationDestination).at(2));
    await t.pumpAndSettle();
    expect(find.text('درصد تکمیل برنامهٔ روزانه'), findsOneWidget);
    expect(find.text('حال امروزت چطوره؟'), findsNothing);
    expect(find.text('برنامه چطور پیش رفت؟'), findsNothing);
    final weight = find.text('تغییر وزن');
    await t.ensureVisible(weight);
    await t.pumpAndSettle();
    expect(t.takeException(), isNull);
    await t.tap(weight);
    await t.pumpAndSettle();
    await t.enterText(find.byType(TextFormField), '۷۰.۵');
    await t.tap(find.widgetWithText(FilledButton, 'ثبت'));
    await t.pumpAndSettle();
    expect(s.latestWeight, 70.5);
    expect(t.takeException(), isNull);
    s.login(AppRole.admin);
    await t.pumpAndSettle();
    expect(find.text('افزودن متخصص'), findsNothing);
    Navigator.of(
      t.element(find.byType(Scaffold).first),
    ).push(MaterialPageRoute<void>(builder: (_) => const PricingAdminScreen()));
    await t.pumpAndSettle();
    await t.enterText(find.byKey(const ValueKey('pricing-0')), '۷۰۰۰۰۰');
    await t.tap(find.text('ذخیره و اعمال'));
    await t.pumpAndSettle();
    expect(s.newPlanPrice, 700000);
    expect(t.takeException(), isNull);
    await t.pumpWidget(const SizedBox());
    s.dispose();
  });
}
