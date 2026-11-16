import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../plan/meal_detail_page.dart';
import '../../../presentation/widgets/kit/kit.dart';
import '../presentation/coach_controller.dart';
import '../data/coach_parse.dart';
import '../domain/coach_message.dart';
import 'bubbles.dart';
import 'coach_companion.dart';
import 'cards/coach_cards.dart';
import 'nutrition_mode_page.dart';

class CoachMessageList extends StatefulWidget {
  const CoachMessageList({
    super.key,
    required this.controller,
    this.pinnedBriefId,
  });
  final CoachController controller;
  final String? pinnedBriefId;

  @override
  State<CoachMessageList> createState() => _CoachMessageListState();
}

class _CoachMessageListState extends State<CoachMessageList> {
  final _scroll = ScrollController();
  bool _away = false;

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final away = _scroll.hasClients && _scroll.offset > 240;
      if (away != _away) setState(() => _away = away);
    });
    widget.controller.addListener(_stick);
  }

  void _stick() {
    if (!_scroll.hasClients || _away) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scroll.hasClients) _scroll.jumpTo(0);
    });
  }

  @override
  void dispose() {
    widget.controller.removeListener(_stick);
    _scroll.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final rows = <Widget>[];
    if (controller.hasMore) {
      rows.add(
        Center(
          child: TextButton(
            key: const ValueKey('coach-load-older'),
            onPressed: controller.loadingMore || controller.busy
                ? null
                : controller.loadMore,
            child: Text(
              controller.loadingMore
                  ? 'در حال دریافت پیام‌ها…'
                  : 'پیام‌های قبلی',
            ),
          ),
        ),
      );
    }
    DateTime? day;
    for (final message in controller.messages) {
      if (message.id == widget.pinnedBriefId) continue;
      final stamp = DateTime(
        message.createdAt.year,
        message.createdAt.month,
        message.createdAt.day,
      );
      if (day != stamp) {
        day = stamp;
        rows.add(_DayHeader(stamp));
      }
      rows.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 7),
          child: Reveal(child: _tile(context, controller, message)),
        ),
      );
    }
    if (controller.draftText != null && controller.draftText!.isNotEmpty) {
      rows.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: CoachTextBubble(
            text: controller.draftText!,
            isUser: false,
            mood: CompanionMood.thinking,
          ),
        ),
      );
    } else if (controller.typing) {
      rows.add(
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 5),
          child: TypingDots(),
        ),
      );
    }
    if (controller.canRetry) {
      rows.add(
        Align(
          alignment: AlignmentDirectional.centerEnd,
          child: ActionChip(
            label: const Text('تلاش دوباره'),
            onPressed: controller.busy
                ? null
                : () => controller.retrySend(controller.retryClientId),
          ),
        ),
      );
    }

    return Stack(
      children: [
        ListView.builder(
          controller: _scroll,
          reverse: true,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
          itemCount: rows.length,
          itemBuilder: (context, index) => rows[rows.length - 1 - index],
        ),
        if (_away)
          PositionedDirectional(
            bottom: 8,
            start: 0,
            end: 0,
            child: Center(
              child: IconButton.filled(
                tooltip: 'تازه‌ترین پیام',
                onPressed: () => _scroll.animateTo(
                  0,
                  duration: Motion.base,
                  curve: Motion.curve,
                ),
                icon: const Icon(Icons.keyboard_arrow_down_rounded),
              ),
            ),
          ),
      ],
    );
  }

  Widget _tile(
    BuildContext context,
    CoachController controller,
    CoachMessage message,
  ) {
    if (message.payload['analyzing'] == true) {
      return const SkeletonCard(height: 180);
    }
    if (!isKnownCoachType(message.type)) {
      final text = message.fallbackText.isNotEmpty
          ? message.fallbackText
          : message.text;
      return CoachTextBubble(
        text: text.isEmpty ? '…' : text,
        isUser: message.isUser,
      );
    }
    return switch (message.type) {
      'user_photo' => CoachPhotoBubble(bytes: controller.photoFor(message)),
      'system_note' => CoachSystemNote(
        text: asString(message.payload['text'], message.fallbackText),
      ),
      'quick_replies' => QuickRepliesView(
        message: message,
        onPick: controller.answered.contains(message.id)
            ? (_) {}
            : (option) {
                controller.answered.add(message.id);
                final action = option['action'];
                final label = asString(
                  option['label'],
                  asString(option['value']),
                );
                if (action is String && action.trim().isNotEmpty) {
                  controller.sendAction(
                    action,
                    asMap(option['args']),
                    label: label,
                    sourceId: message.id,
                  );
                } else if (label.isNotEmpty) {
                  controller.sendText(label);
                }
              },
      ),
      'meal_card' => MealCardView(
        message: message,
        photo: controller.photoFor(message),
        onReview: () => openNutritionMode(
          context,
          controller: controller,
          message: message,
        ),
        onSwap: () => controller.sendText('یه پیشنهاد دیگه بده'),
      ),
      'plan_meal' => PlanMealView(
        message: message,
        onOpen: () => _openPlanMeal(context, message),
        onSwap: () => controller.sendText(
          'می‌خوام برای «${asString(message.payload['title'])}» یک جایگزین داشته باشم.',
        ),
      ),
      'calorie_ring' => CalorieRingView(message: message),
      'weigh_in' => WeighInView(message: message, controller: controller),
      'water' => WaterView(message: message, controller: controller),
      'day_brief' => DayBriefView(message: message),
      'weekly_review' => WeeklyReviewView(message: message),
      'milestone' => MilestoneView(message: message),
      _ => CoachTextBubble(
        text: message.text,
        isUser: message.isUser,
        pending: message.pending,
        failed: message.failed,
      ),
    };
  }

  void _openPlanMeal(BuildContext context, CoachMessage message) {
    final store = DemoScope.of(context);
    final now = store.today;
    final stamp = message.createdAt.toLocal();
    final sameDay =
        now.year == stamp.year &&
        now.month == stamp.month &&
        now.day == stamp.day;
    final matches = <int>[];
    final meals = store.mealsOn(now);
    for (var i = 0; i < meals.length; i++) {
      if (meals[i].title == asString(message.payload['title']) &&
          meals[i].name == asString(message.payload['meal_type_fa']) &&
          meals[i].time == asString(message.payload['time'])) {
        matches.add(i);
      }
    }
    if (sameDay && matches.length == 1) {
      Navigator.of(context).push(
        foodDetailRoute<void>(
          MealDetailPage(date: now, index: matches.single),
          reduced: Motion.reduced(context),
        ),
      );
    } else {
      openNutritionMode(
        context,
        controller: widget.controller,
        message: message,
      );
    }
  }
}

class _DayHeader extends StatelessWidget {
  const _DayHeader(this.day);
  final DateTime day;

  @override
  Widget build(BuildContext context) {
    final now = DemoScope.of(context).today;
    final today = DateTime(now.year, now.month, now.day);
    final label = day == today
        ? 'امروز'
        : day == today.subtract(const Duration(days: 1))
        ? 'دیروز'
        : fa('${day.year}/${day.month}/${day.day}');
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 10),
      child: Row(
        children: [
          const Expanded(child: Divider(color: AppColors.line, endIndent: 14)),
          Text(
            label,
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
          const Expanded(child: Divider(color: AppColors.line, indent: 14)),
        ],
      ),
    );
  }
}
