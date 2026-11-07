import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:sabzine_flutter/app.dart';
import 'package:sabzine_flutter/data/demo_store.dart';
import 'package:sabzine_flutter/data/day.dart';
import 'package:sabzine_flutter/screens/weekly_feedback.dart';

class FailingFeedbackRepository extends MemoryWeeklyFeedbackRepository {
  bool fail = false;
  @override
  Future<void> save(WeeklyFeedback feedback) async {
    if (fail) throw StateError('storage failed');
    await super.save(feedback);
  }
}

void main() {
  final friday = DateTime(2026, 10, 30, 12);
  DemoStore ready({WeeklyFeedbackRepository? repository, DateTime? clock}) {
    final s = DemoStore(
      feedbackRepository: repository,
      clock: () => clock ?? friday,
    )..loginDemoUser();
    s.approveActiveUserRequest();
    addTearDown(s.dispose);
    return s;
  }

  WeeklyFeedback feedback(DemoStore s, {bool public = false, String? owner}) {
    final r = s.feedbackProgram!;
    return WeeklyFeedback(
      owner: owner ?? s.feedbackOwner,
      requestId: r.id,
      planVersion: r.version,
      week: dateKey(r.programWeek!),
      at: s.today,
      meals: s.feedbackMeals(r),
      favorite: [s.feedbackMeals(r).first.id],
      disliked: [s.feedbackMeals(r).last.id],
      difficult: [s.feedbackMeals(r).last.id],
      availability: 'hard',
      budget: 'expensive',
      portion: 'suitable',
      service: 'good',
      rating: 4,
      comment: 'یادداشت خصوصی درباره شرایط شخصی',
      publicConsent: public,
      publicText: public ? 'این فقط نظر عمومی است' : '',
    );
  }

  test(
    'End of week accepts incomplete adherence without a reward; early week does not',
    () async {
      final early = ready(clock: DateTime(2026, 10, 26));
      expect(early.canReviewCurrentProgram, false);
      final s = ready();
      expect(
        s.walletBalance,
        0,
      ); // Default demo wallet is independent of feedback eligibility.
      expect(s.canReviewCurrentProgram, true);
      expect(s.eatenCount(friday), 0);
      await s.saveWeeklyFeedback(feedback(s));
      expect(s.weeklyFeedback.single.week, dateKey(startOfWeek(friday)));
      expect(
        s.programReviews.where((r) => r.id.startsWith('weekly:')),
        isEmpty,
      );
    },
  );
  test(
    'Public consent projects only the separate public text and still requires moderation',
    () async {
      final s = ready();
      final before = s.approvedReviewsForDashboard().length;
      await s.saveWeeklyFeedback(feedback(s, public: true));
      final review = s.programReviews.first;
      expect(review.text, 'این فقط نظر عمومی است');
      expect(review.approved, false);
      expect(review.text, isNot(contains('خصوصی')));
      expect(s.approvedReviewsForDashboard().length, before);
      s.approveProgramReview(review.id);
      expect(s.approvedReviewsForDashboard().length, before + 1);
      final other = ready();
      final unrated = WeeklyFeedback.fromJson({
        ...feedback(other, public: true).toJson(),
        'service': 'not_used',
        'rating': 0,
      });
      final mean = other.clinicianRating;
      await other.saveWeeklyFeedback(unrated);
      expect(other.clinicianRating, mean);
    },
  );
  test(
    'Identity is stable across rename and isolated across accounts; payload and duplicate guards hold',
    () async {
      final repo = MemoryWeeklyFeedbackRepository(),
          s = ready(repository: repo);
      final record = feedback(s);
      await s.saveWeeklyFeedback(record);
      s.questionnaire.name = 'نام تازه';
      await expectLater(s.saveWeeklyFeedback(record), throwsStateError);
      final restored = ready(repository: repo);
      await restored.restoreWeeklyFeedback();
      expect(restored.weeklyFeedback.length, 1);
      restored.logout();
      restored.login(AppRole.user, phone: '09121111111');
      restored.attachDemoUserRequest();
      await restored.restoreWeeklyFeedback();
      expect(restored.weeklyFeedback, isEmpty);
      await expectLater(restored.saveWeeklyFeedback(record), throwsStateError);
    },
  );
  test(
    'Save failure is retryable; approved preferences can be edited or rejected without questionnaire mutation',
    () async {
      final repo = FailingFeedbackRepository(), s = ready(repository: repo);
      repo.fail = true;
      await expectLater(s.saveWeeklyFeedback(feedback(s)), throwsStateError);
      expect(s.weeklyFeedback, isEmpty);
      expect(s.savingFeedback, false);
      repo.fail = false;
      await s.saveWeeklyFeedback(feedback(s));
      expect(s.suggestedFoodPreferences.budget, isNotEmpty);
      final before = s.questionnaire.toJson();
      await s.confirmFoodPreferences(
        const FoodPreferences(favorites: 'غذای اصلاح‌شده', accepted: true),
      );
      expect(s.foodPreferences!.favorites, 'غذای اصلاح‌شده');
      expect(s.questionnaire.toJson(), before);
      s.submitQuestionnaire();
      expect(s.userRequest.preferenceSnapshot!.favorites, 'غذای اصلاح‌شده');
      expect(s.userRequest.questionnaireSnapshot, before);
      await s.confirmFoodPreferences(const FoodPreferences());
      expect(s.foodPreferences!.accepted, false);
      final restored = ready(repository: repo);
      await restored.restoreWeeklyFeedback();
      expect(restored.foodPreferences!.accepted, false);
    },
  );
  testWidgets(
    'Private feedback form saves choices; next-plan preferences require confirmation and permit rejection',
    (t) async {
      t.view.physicalSize = const Size(390, 844);
      t.view.devicePixelRatio = 1;
      addTearDown(t.view.resetPhysicalSize);
      addTearDown(t.view.resetDevicePixelRatio);
      await (FontLoader(
        'Vazirmatn',
      )..addFont(rootBundle.load('assets/fonts/Vazirmatn-Regular.ttf'))).load();
      await (FontLoader(
        'MaterialIcons',
      )..addFont(rootBundle.load('fonts/MaterialIcons-Regular.otf'))).load();
      final s = ready();
      await t.pumpWidget(SabzineApp(store: s, splashDuration: Duration.zero));
      await t.pumpAndSettle();
      final context = t.element(find.byType(Scaffold).first);
      Navigator.of(context).push(
        MaterialPageRoute<void>(builder: (_) => const WeeklyFeedbackScreen()),
      );
      await t.pumpAndSettle();
      expect(
        t.widget<SwitchListTile>(find.byType(SwitchListTile)).value,
        false,
      );
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../../references/screenshots/phase5/feedback-form-demo.png'),
      );
      for (final label in ['راحت', 'گران', 'زیاد', 'خوب']) {
        final choice = find.widgetWithText(ChoiceChip, label);
        await t.ensureVisible(choice);
        await t.pumpAndSettle();
        await t.tap(choice);
        await t.pumpAndSettle();
      }
      await t.ensureVisible(find.text('ذخیرهٔ بازخورد هفته'));
      await t.pumpAndSettle();
      await t.tap(find.text('ذخیرهٔ بازخورد هفته'));
      await t.pumpAndSettle();
      expect(find.text('بازخورد این هفته ذخیره شد'), findsOneWidget);
      expect(s.weeklyFeedback.length, 1);
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      await t.pumpAndSettle();
      Navigator.of(context).push(
        MaterialPageRoute<bool>(builder: (_) => const NextPlanReviewScreen()),
      );
      await t.pumpAndSettle();
      final button = find.widgetWithText(FilledButton, 'تأیید و ادامه');
      expect(t.widget<FilledButton>(button).onPressed, isNull);
      await t.ensureVisible(find.byType(SwitchListTile));
      await t.pumpAndSettle();
      await t.tap(find.byType(SwitchListTile));
      await t.pumpAndSettle();
      await t.ensureVisible(find.byType(CheckboxListTile));
      await t.pumpAndSettle();
      await t.tap(find.byType(CheckboxListTile));
      await t.pumpAndSettle();
      await t.ensureVisible(button);
      await t.pumpAndSettle();
      await t.tap(button);
      await t.pumpAndSettle();
      expect(s.foodPreferences!.accepted, false);
      expect(t.takeException(), isNull);
      await expectLater(
        find.byType(MaterialApp),
        matchesGoldenFile('../../references/screenshots/phase5/feedback-saved-demo.png'),
      );
    },
  );
}
