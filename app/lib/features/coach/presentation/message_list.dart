import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../domain/common/day.dart';
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
  final _messageKeys = <String, GlobalKey>{};
  String? _focused;

  Future<void> _showTarget(String id) async {
    _away = true;
    for (
      var step = 0;
      step < 120 && mounted && widget.controller.highlightedMessageId == id;
      step++
    ) {
      final target = _messageKeys[id]?.currentContext;
      if (target != null && target.mounted) {
        await Scrollable.ensureVisible(target, alignment: .35);
        return;
      }
      if (!_scroll.hasClients) return;
      final next = (_scroll.offset + _scroll.position.viewportDimension * .7)
          .clamp(0.0, _scroll.position.maxScrollExtent);
      if (next == _scroll.offset) return;
      _scroll.jumpTo(next);
      await WidgetsBinding.instance.endOfFrame;
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    widget.controller.setReplyAnimation(
      !MediaQuery.disableAnimationsOf(context),
    );
  }

  @override
  void initState() {
    super.initState();
    _scroll.addListener(() {
      final away = _scroll.hasClients && _scroll.offset > 240;
      if (away != _away) setState(() => _away = away);
    });
    widget.controller.addListener(_stick);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _stick();
    });
  }

  void _stick() {
    final target = widget.controller.highlightedMessageId;
    if (target == null) _focused = null;
    if (target != null && target != _focused) {
      _focused = target;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _showTarget(target);
      });
      return;
    }
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
      if (message.id == widget.pinnedBriefId ||
          message.id == controller.revealingMessageId) {
        continue;
      }
      final stamp = DateTime(
        message.createdAt.year,
        message.createdAt.month,
        message.createdAt.day,
      );
      if (day != stamp) {
        day = stamp;
        final label = _olderDateLabel(context, stamp);
        if (label != null) rows.add(_DayHeader(label));
      }
      rows.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          key: _messageKeys.putIfAbsent(message.id, () => GlobalKey()),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: controller.highlightedMessageId == message.id
                  ? AppColors.mint
                  : null,
              borderRadius: BorderRadius.circular(18),
            ),
            child: Reveal(child: _messageTools(context, controller, message)),
          ),
        ),
      );
    }
    if (controller.draftText != null && controller.draftText!.isNotEmpty) {
      rows.add(
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: CoachTextBubble(
            text: controller.draftText!,
            layoutText: controller.typingLayout,
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
    if (controller.canRetry && !controller.messages.any((m) => m.failed)) {
      rows.add(
        Align(
          alignment: Alignment.centerRight,
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
        time: _clock(message.createdAt.toLocal()),
      );
    }
    return switch (message.type) {
      'user_photo' => CoachPhotoBubble(bytes: controller.photoFor(message)),
      'system_note' => CoachSystemNote(
        text: asString(message.payload['text'], message.fallbackText),
      ),
      'quick_replies' => QuickRepliesView(
        message: message,
        enabled:
            !controller.busy &&
            !controller.answered.contains(message.id) &&
            (message.payload['planDecision'] == null ||
                message.payload['planDecision'] == 'pending'),
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
      'swap_options' => SwapOptionsView(
        message: message,
        controller: controller,
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
      'fact_card' => FactCardView(
        message: message,
        onOpenMeal: (item) => _openFactMeal(context, message, item),
      ),
      'day_brief' => DayBriefView(
        message: message,
        onPick: controller.sendText,
      ),
      'weekly_review' => WeeklyReviewView(message: message),
      'milestone' => MilestoneView(message: message),
      _ => CoachTextBubble(
        text: message.text,
        isUser: message.isUser,
        pending: message.pending,
        failed: message.failed,
        time: _clock(message.createdAt.toLocal()),
      ),
    };
  }

  void _openFactMeal(
    BuildContext context,
    CoachMessage message,
    Map<String, dynamic> item,
  ) {
    final store = DemoScope.of(context);
    final raw = asString(message.payload['date']);
    final parsed = DateTime.tryParse(raw);
    if (parsed == null) return;
    final day = DateTime(parsed.year, parsed.month, parsed.day);
    final meals = store.mealsOn(day);
    final title = asString(item['title']);
    final hits = <int>[
      for (var i = 0; i < meals.length; i++)
        if (meals[i].title == title) i,
    ];
    if (hits.length != 1) return;
    Navigator.of(context, rootNavigator: true).push(
      foodDetailRoute<void>(
        MealDetailPage(date: day, index: hits.single, heroes: false),
        reduced: Motion.reduced(context),
      ),
    );
  }

  Future<void> _menu(
    BuildContext context,
    CoachController controller,
    CoachMessage message,
    Offset globalPosition,
  ) async {
    Widget option(IconData icon, String label) => Row(
      children: [
        Icon(icon, size: 20),
        const SizedBox(width: 12),
        Flexible(child: Text(label)),
      ],
    );

    final items = <PopupMenuEntry<String>>[
      if (message.text.isNotEmpty)
        PopupMenuItem(
          value: 'copy',
          child: option(Icons.copy_rounded, 'کپی متن'),
        ),
      if (!message.pending && !message.failed)
        PopupMenuItem(
          value: 'reply',
          child: option(Icons.reply_rounded, 'پاسخ به همین پیام'),
        ),
      if (message.text.isNotEmpty && !message.pending && !message.failed)
        PopupMenuItem(
          value: 'save',
          child: option(Icons.bookmark_add_outlined, 'ذخیره در نشان‌شده‌ها'),
        ),
    ];
    if (items.isEmpty) return;

    final overlay =
        Navigator.of(context).overlay!.context.findRenderObject() as RenderBox;
    final position = overlay.globalToLocal(globalPosition);
    final action = await showMenu<String>(
      context: context,
      position: RelativeRect.fromRect(
        position & const Size(1, 1),
        Offset.zero & overlay.size,
      ),
      semanticLabel: 'گزینه‌های پیام',
      requestFocus: true,
      color: AppColors.surface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      items: items,
    );
    if (!context.mounted) return;
    if (action == 'copy') {
      await Clipboard.setData(ClipboardData(text: message.text));
    } else if (action == 'reply') {
      controller.setReply(message);
    } else if (action == 'save') {
      try {
        final title =
            controller.conversations
                .where((t) => t.id == controller.conversationId)
                .firstOrNull
                ?.title ??
            'گفتگو';
        await controller.notebook.bookmark(
          message,
          controller.conversationId,
          title,
        );
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('در نشان‌شده‌های این دستگاه ذخیره شد.'),
            ),
          );
        }
      } catch (_) {
        if (context.mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('ذخیره پیام انجام نشد. دوباره تلاش کن.'),
            ),
          );
        }
      }
    }
  }

  Widget _messageTools(
    BuildContext context,
    CoachController controller,
    CoachMessage message,
  ) {
    final quote = asMap(message.payload['replyTo']);
    return GestureDetector(
      onLongPressStart: (details) =>
          _menu(context, controller, message, details.globalPosition),
      onSecondaryTapUp: (details) =>
          _menu(context, controller, message, details.globalPosition),
      child: Column(
        textDirection: TextDirection.ltr,
        crossAxisAlignment: message.isUser
            ? CrossAxisAlignment.end
            : CrossAxisAlignment.start,
        children: [
          if (quote.isNotEmpty)
            Container(
              margin: const EdgeInsets.only(bottom: 4),
              padding: const EdgeInsets.all(10),
              constraints: const BoxConstraints(maxWidth: 280),
              decoration: BoxDecoration(
                color: AppColors.mint,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                'در پاسخ به: ${asString(quote['text'])}',
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 11, height: 1.8),
              ),
            ),
          _tile(context, controller, message),
          if (message.failed)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (message.isUser)
                  Text(
                    'ارسال نشد',
                    style: const TextStyle(
                      fontSize: 10,
                      color: AppColors.danger,
                    ),
                  ),
                if (message.failed && message.clientMessageId != null)
                  TextButton(
                    onPressed: controller.busy
                        ? null
                        : () => controller.retrySend(message.clientMessageId),
                    child: const Text('تلاش دوباره'),
                  ),
              ],
            ),
        ],
      ),
    );
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
      Navigator.of(context, rootNavigator: true).push(
        foodDetailRoute<void>(
          MealDetailPage(date: now, index: matches.single, heroes: false),
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

String? _olderDateLabel(BuildContext context, DateTime day) {
  final now = DemoScope.of(context).today;
  final today = DateTime(now.year, now.month, now.day);
  final yesterday = today.subtract(const Duration(days: 1));
  if (day == today || day == yesterday) return null;
  return persianDate(day, year: day.year != today.year);
}

String _clock(DateTime time) {
  final hour = time.hour.toString().padLeft(2, '0');
  final minute = time.minute.toString().padLeft(2, '0');
  return fa('$hour:$minute');
}

class _DayHeader extends StatelessWidget {
  const _DayHeader(this.label);
  final String label;

  @override
  Widget build(BuildContext context) {
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
