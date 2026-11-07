import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/streak_campaign.dart';

Future<void> completeDay(DemoStore store, DateTime date) async {
  for (var index = 0; index < store.mealsOn(date).length; index++) {
    await store.setMealEaten(date, index, true);
  }
}

void main() {
  test('Login does not qualify a day or credit the wallet', () async {
    var date = DateTime(2026, 10, 24);
    final store = DemoStore(clock: () => date)..loginDemoUser();
    store.approveActiveUserRequest();
    final before = store.streakProgress.consecutiveQualified;
    store.login(AppRole.user);
    expect(store.streakProgress.consecutiveQualified, before);
    expect(
      store.streakProgress.days.every(
        (day) => day.state != StreakDayState.qualified,
      ),
      isTrue,
    );
    expect(store.walletBalance, 0);
    expect(store.walletTransactions, isEmpty);
    store.dispose();
  });

  test('A partial day waits for verification and does not pay', () async {
    final store = DemoStore(clock: () => DateTime(2026, 10, 24))
      ..loginDemoUser();
    store.approveActiveUserRequest();
    final date = DateTime(2026, 10, 24);
    await store.setMealEaten(date, 0, true);
    final status = store.streakProgress.days.firstWhere(
      (day) => dateKey(day.date) == dateKey(date),
    );
    expect(status.state, StreakDayState.pendingVerification);
    expect(store.claimWeeklyReward(), isFalse);
    expect(store.walletBalance, 0);
    store.dispose();
  });

  test('A missed day resets the consecutive count', () async {
    var date = DateTime(2026, 10, 24);
    final store = DemoStore(clock: () => date)..loginDemoUser();
    store.approveActiveUserRequest();
    await completeDay(store, date);
    date = DateTime(2026, 10, 30);
    for (var day = 26; day <= 30; day++) {
      date = DateTime(2026, 10, day);
      await completeDay(store, date);
    }
    expect(store.streakProgress.consecutiveQualified, 5);
    expect(store.walletBalance, 0);
    final missed = store.streakProgress.days.firstWhere(
      (day) => dateKey(day.date) == '2026-10-25',
    );
    expect(missed.state, StreakDayState.missed);
    store.dispose();
  });

  test('Day 7 pays once and a later campaign amount does not rewrite it', () async {
    var date = DateTime(2026, 10, 24);
    final store = DemoStore(clock: () => date)..loginDemoUser();
    store.approveActiveUserRequest();
    await completeDay(store, date);
    store.publishStreakCampaign(
      consecutiveDays: 7,
      milestones: const [StreakMilestone(day: 7, amountToman: 50000)],
      effectiveOn: DateTime(2026, 1, 1),
    );
    for (var day = 25; day <= 30; day++) {
      date = DateTime(2026, 10, day);
      await completeDay(store, date);
    }
    expect(store.walletBalance, 200000);
    expect(store.streakProgress.version, 1);
    expect(store.claimWeeklyReward(), isFalse);
    expect(store.streakProgress.claimState, 'duplicate');
    expect(
      store.walletTransactions
          .where((item) => item.operationId.startsWith('weekly-reward'))
          .length,
      1,
    );
    await store.savePricing(plan: 500000, ai: 150000, expert: 250000, reward: 10000);
    expect(store.rewardForWeek(dateKey(DateTime(2026, 10, 24))), 200000);
    expect(store.walletBalance, 200000);
    store.dispose();
  });
}
