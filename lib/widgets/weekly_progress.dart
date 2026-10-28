import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../theme.dart';
import '../screens/shared.dart';
import '../screens/wallet_flow.dart';
import 'ui.dart';

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
    final s = DemoScope.of(context), dates = s.scheduledWeekDates;
    if (dates.isEmpty) return const SizedBox.shrink();
    final claimed = s.rewardedWeeks.contains(
      dateKey(s.userRequest.programWeek ?? startOfWeek(s.today)),
    );
    return Surface(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(Icons.local_fire_department_rounded, color: amber),
              const SizedBox(width: 8),
              const Expanded(
                child: Text(
                  'استریک این هفته',
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
              Tag('${fa(s.weeklyStreak)} هفتهٔ متوالی'),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${fa(s.completedProgramDays)} از ${fa(dates.length)} روز برنامه تکمیل شده',
          ),
          const SizedBox(height: 10),
          Row(
            children: dates
                .map(
                  (date) => Expanded(
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 16,
                          backgroundColor: s.dayCompleted(date) ? pine : sage,
                          child: Icon(
                            s.dayCompleted(date)
                                ? Icons.check
                                : Icons.circle_outlined,
                            size: 18,
                            color: s.dayCompleted(date) ? Colors.white : muted,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          persianWeekDays[weekDayIndex(date)],
                          style: const TextStyle(fontSize: 9),
                        ),
                      ],
                    ),
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          LinearProgressIndicator(
            value: s.completedProgramDays / dates.length,
            minHeight: 6,
            borderRadius: BorderRadius.circular(6),
          ),
          const SizedBox(height: 10),
          Text(
            claimed
                ? '۱۰۰ توکن جایزهٔ این هفته به کیف پولت اضافه شد.'
                : 'همهٔ وعده‌های روزهای برنامه را تیک بزن؛ ۱۰۰ توکن جایزه بگیر.',
            style: const TextStyle(color: pine, fontSize: 12),
          ),
          Text(
            'از ${persianDate(dates.first)} تا ${persianDate(dates.last)}',
            style: const TextStyle(color: muted, fontSize: 10),
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

class WeeklyRewardGate extends StatefulWidget {
  const WeeklyRewardGate({super.key, required this.child});
  final Widget child;
  @override
  State<WeeklyRewardGate> createState() => _WeeklyRewardGateState();
}

class _WeeklyRewardGateState extends State<WeeklyRewardGate> {
  bool scheduled = false, showing = false;
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
        store.claimWeeklyReward();
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
              content: const Text(
                'شما برنامهٔ این هفته را تکمیل کردید و ۱۰۰ توکن جایزه گرفتید. جایزه به کیف پولت اضافه شد.',
              ),
              actions: [
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
        if (getNew == true && mounted) {
          store.selectedPlanServiceId = 'new-plan';
          await openPlanServices(this.context);
        }
      });
    }
    return widget.child;
  }
}
