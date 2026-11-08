import 'package:flutter/material.dart';
import 'dart:math' as math;
import '../data/demo_store.dart';
import '../data/day.dart';
import '../data/streak_campaign.dart';
import '../data/wallet_catalog.dart';
import '../screens/user.dart' show ProgramReviewSubmitScreen;
import '../theme.dart';
import '../screens/shared.dart';
import '../screens/wallet_flow.dart';
import 'ui.dart';

class RevisionConversationCard extends StatelessWidget {
  const RevisionConversationCard({super.key, required this.request});
  final DietRequest request;
  @override
  Widget build(BuildContext context) {
    final r = request;
    return Surface(
      key: const ValueKey('revision-conversation-status'),
      color: sage,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Heading('وضعیت برنامه'),
          const SizedBox(height: 8),
          Text(
            r.revisionAwaitingUser
                ? 'در انتظار پاسخ کاربر'
                : r.revisionReply.isNotEmpty
                ? 'پاسخت برای متخصص ارسال شد'
                : 'درخواست اصلاح در حال بررسی است',
            style: const TextStyle(
              color: pine,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          if (r.revisionMessage.isNotEmpty) ...[
            const SizedBox(height: 10),
            const Text(
              'پیام متخصص',
              style: TextStyle(color: muted, fontSize: 11),
            ),
            Text(r.revisionMessage),
          ],
          if (r.revisionReply.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              'پاسخ تو: ${r.revisionReply}',
              style: const TextStyle(color: muted, fontSize: 12),
            ),
          ],
          const SizedBox(height: 12),
          FilledButton.icon(
            key: const ValueKey('reply-to-revision'),
            onPressed: () =>
                pushPage(context, const ChatScreen(threadId: 'user-main')),
            icon: const Icon(Icons.chat_bubble_outline, size: 18),
            label: Text(r.revisionAwaitingUser ? 'پاسخ' : 'مشاهدهٔ گفتگو'),
          ),
        ],
      ),
    );
  }
}

class RequestInformationCard extends StatelessWidget {
  const RequestInformationCard({super.key, required this.request});
  final DietRequest request;
  @override
  Widget build(BuildContext context) {
    final r = request;
    return Surface(
      color: sage,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Heading(
            r.infoAnswer.isEmpty
                ? 'متخصص منتظر پاسخ توست'
                : r.infoAnswerReviewed
                ? 'پاسخت بررسی شد'
                : 'پاسخت برای متخصص ارسال شد',
          ),
          Text(r.question),
          if (r.infoAnswer.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text('پاسخ تو: ${r.infoAnswer}'),
          ],
          const SizedBox(height: 8),
          Text(
            r.infoAnswer.isEmpty
                ? 'تا پاسخ ندهی، تأیید برنامه متوقف می‌ماند.'
                : r.status == PlanStatus.ready
                ? 'برنامه تأیید شده است.'
                : 'درخواستت در صف متخصص است؛ بعد از بررسی پاسخ، برنامه تأیید می‌شود.',
            style: const TextStyle(color: muted, fontSize: 12),
          ),
          TextButton.icon(
            onPressed: () =>
                pushPage(context, const ChatScreen(threadId: 'user-main')),
            icon: const Icon(Icons.chat_bubble_outline),
            label: Text(
              r.infoAnswer.isEmpty ? 'پاسخ به سؤال متخصص' : 'مشاهدهٔ گفتگو',
            ),
          ),
        ],
      ),
    );
  }
}

class WeeklyStreakCard extends StatelessWidget {
  const WeeklyStreakCard({super.key});
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    if (!s.hasUserRequest || !s.userRequest.isPublished) {
      return const SizedBox.shrink();
    }
    final week = s.userRequest.programWeek ?? startOfWeek(s.today);
    final dates = List.generate(
      7,
      (i) => DateTime(week.year, week.month, week.day + i),
    );
    final progress = s.streakProgress;
    final claimed = s.rewardedWeeks.contains(dateKey(week));
    final byDate = {
      for (final status in progress.days) dateKey(status.date): status,
    };
    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: dates
                .map(
                  (date) => Expanded(
                    child: Column(
                      children: [
                        DayMealProgress(
                          key: ValueKey('day-progress-${dateKey(date)}'),
                          label: persianWeekDays[weekDayIndex(date)],
                          completed: s.eatenCount(date),
                          total:
                              s.scheduledWeekDates.any(
                                (d) => dateKey(d) == dateKey(date),
                              )
                              ? s.mealsOn(date).length
                              : 0,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          persianWeekDays[weekDayIndex(date)],
                          style: const TextStyle(fontSize: 9),
                        ),
                        Text(
                          byDate[dateKey(date)]?.state.label ??
                              StreakDayState.pending.label,
                          key: ValueKey('streak-state-${dateKey(date)}'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(fontSize: 8, color: pine),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 10),
          Text(
            progress.resetRule,
            key: const ValueKey('streak-reset'),
            style: const TextStyle(color: muted, fontSize: 10, height: 1.6),
          ),
          if (s.canReviewCurrentProgram)
            TextButton.icon(
              onPressed: () =>
                  pushPage(context, const ProgramReviewSubmitScreen()),
              icon: const Icon(Icons.rate_review_outlined),
              label: const Text('بازخورد برنامهٔ این هفته'),
            ),
          if (claimed)
            TextButton(
              onPressed: () {
                s.selectedPlanServiceId = 'new-plan';
                openPlanServices(context);
              },
              child: const Text('دریافت برنامه جدید'),
            ),
        ],
      ),
    );
  }
}

/// The liquid's area follows the share of meals completed, not elapsed time.
class DayMealProgress extends StatelessWidget {
  const DayMealProgress({
    super.key,
    required this.label,
    required this.completed,
    required this.total,
  });
  final String label;
  final int completed, total;
  double get progress => total == 0 ? 0 : (completed / total).clamp(0.0, 1.0);
  @override
  Widget build(BuildContext context) => Semantics(
    label: label,
    value: total == 0
        ? 'بدون برنامه'
        : '${fa(completed)} از ${fa(total)} وعده؛ ${fa((progress * 100).round())} درصد',
    child: Tooltip(
      message: total == 0
          ? '$label · بدون برنامه'
          : '$label · ${fa(completed)} از ${fa(total)} وعده',
      child: TweenAnimationBuilder<double>(
        tween: Tween<double>(begin: 0, end: progress),
        duration: MediaQuery.disableAnimationsOf(context)
            ? Duration.zero
            : const Duration(milliseconds: 350),
        builder: (_, value, child) => SizedBox.square(
          dimension: 32,
          child: CustomPaint(
            painter: _DayFillPainter(value),
            child: Center(
              child: progress == 1
                  ? const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 18,
                    )
                  : total == 0
                  ? const Icon(Icons.remove, color: muted, size: 15)
                  : null,
            ),
          ),
        ),
      ),
    ),
  );
}

class _DayFillPainter extends CustomPainter {
  _DayFillPainter(this.progress);
  final double progress;
  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2),
        radius = size.shortestSide / 2 - 1;
    final bounds = Rect.fromCircle(center: center, radius: radius);
    canvas.drawCircle(center, radius, Paint()..color = sage);
    if (progress > 0) {
      // Invert the circular segment area so 3/4 really fills 75% of the circle.
      var low = -1.0, high = 1.0;
      for (var i = 0; i < 24; i++) {
        final y = (low + high) / 2;
        final area =
            (math.acos(y) - y * math.sqrt(math.max(0, 1 - y * y))) / math.pi;
        if (area > progress) {
          low = y;
        } else {
          high = y;
        }
      }
      final level = center.dy + (low + high) / 2 * radius;
      canvas.save();
      canvas.clipPath(Path()..addOval(bounds));
      canvas.drawRect(
        Rect.fromLTRB(bounds.left, level, bounds.right, bounds.bottom),
        Paint()..color = pine,
      );
      canvas.restore();
    }
    canvas.drawCircle(
      center,
      radius,
      Paint()
        ..color = pine
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );
  }

  @override
  bool shouldRepaint(covariant _DayFillPainter old) => old.progress != progress;
}

class WeeklyRewardGate extends StatefulWidget {
  const WeeklyRewardGate({super.key, required this.child});
  final Widget child;
  @override
  State<WeeklyRewardGate> createState() => _WeeklyRewardGateState();
}

class _WeeklyRewardGateState extends State<WeeklyRewardGate> {
  bool scheduled = false, showing = false;
  Future<void> pushFeedback() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(builder: (_) => const ProgramReviewSubmitScreen()),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (!scheduled && !showing) {
      scheduled = true;
      WidgetsBinding.instance.addPostFrameCallback((_) async {
        scheduled = false;
        if (!mounted ||
            !store.userSignedIn ||
            ModalRoute.of(context)?.isCurrent != true) {
          return;
        }
        if (store.pendingWeeklyRewards.isEmpty || showing) return;
        showing = true;
        final week = store.pendingWeeklyRewards.first;
        bool answered = false;
        final getNew = await showDialog<bool>(
          context: context,
          barrierDismissible: false,
          builder: (d) => PopScope(
            canPop: false,
            child: AlertDialog(
              icon: const Icon(
                Icons.emoji_events_rounded,
                color: amber,
                size: 56,
              ),
              title: const Text('تبریک! هفته‌ات را کامل کردی 🎉'),
              content: Text(
                '${fa(store.streakProgress.requiredDays)} روز پیاپی تأیید شد و ${formatToman(store.rewardForWeek(week))} به کیف پولت نشست.',
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    if (answered) return;
                    answered = true;
                    Navigator.pop(d, null);
                  },
                  child: const Text('ثبت بازخورد این هفته'),
                ),
                TextButton(
                  onPressed: () {
                    if (answered) return;
                    answered = true;
                    Navigator.pop(d, false);
                  },
                  child: const Text('بعداً'),
                ),
                FilledButton(
                  onPressed: () {
                    if (answered) return;
                    answered = true;
                    Navigator.pop(d, true);
                  },
                  child: const Text('دریافت برنامه جدید'),
                ),
              ],
            ),
          ),
        );
        store.acknowledgeWeeklyReward(week);
        showing = false;
        if (getNew == null && mounted) {
          await pushFeedback();
        }
        if (getNew == true && mounted) {
          store.selectedPlanServiceId = 'new-plan';
          await openPlanServices(this.context);
        }
      });
    }
    return widget.child;
  }
}
