import 'package:flutter/material.dart';

import '../../../core/format/digits.dart';
import '../../../core/icons/diet_icon.dart';
import '../../../core/theme/tokens.dart';
import '../../../data/day.dart';
import '../domain/coach_conversation.dart';
import '../domain/coach_events.dart';
import 'coach_controller.dart';

class CoachConversationHistory extends StatefulWidget {
  const CoachConversationHistory({
    super.key,
    required this.controller,
    this.today,
  });
  final CoachController controller;
  final DateTime? today;

  @override
  State<CoachConversationHistory> createState() =>
      _CoachConversationHistoryState();
}

class _CoachConversationHistoryState extends State<CoachConversationHistory> {
  bool _working = false;
  String? _error;

  Future<void> _run(Future<void> Function() action) async {
    if (_working) return;
    setState(() {
      _working = true;
      _error = null;
    });
    try {
      await action();
    } catch (failure) {
      if (mounted) {
        setState(
          () => _error = failure is CoachTransportException
              ? failure.message
              : 'تغییر ذخیره نشد. دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => _working = false);
    }
  }

  Future<void> _rename(CoachConversation thread) async {
    var proposed = thread.title;
    final title = await showDialog<String>(
      context: context,
      builder: (context) {
        String? error;
        return StatefulBuilder(
          builder: (context, update) => AlertDialog(
            title: const Text('تغییر نام گفتگو'),
            content: TextFormField(
              key: const ValueKey('coach-conversation-title'),
              initialValue: thread.title,
              onChanged: (value) => proposed = value,
              autofocus: true,
              maxLength: 80,
              decoration: InputDecoration(
                labelText: 'نام گفتگو',
                errorText: error,
              ),
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (value) {
                if (value.trim().isNotEmpty) {
                  Navigator.pop(context, value.trim());
                }
              },
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context),
                child: const Text('انصراف'),
              ),
              FilledButton(
                onPressed: () {
                  if (proposed.trim().isEmpty) {
                    update(() => error = 'نام گفتگو را بنویس.');
                  } else {
                    Navigator.pop(context, proposed.trim());
                  }
                },
                child: const Text('ذخیره'),
              ),
            ],
          ),
        );
      },
    );
    if (title == null || !mounted) return;
    await _run(() => widget.controller.renameConversation(thread.id, title));
  }

  Future<void> _delete(CoachConversation thread) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('حذف گفتگو؟'),
        content: Text(
          'گفتگوی «${thread.title}» و پیام‌هایش حذف می‌شوند. ثبت‌های غذا، آب و وزن باقی می‌مانند.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('انصراف'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: AppColors.danger),
            child: const Text('حذف گفتگو'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    await _run(() => widget.controller.deleteConversation(thread.id));
  }

  @override
  Widget build(BuildContext context) => Drawer(
    width: MediaQuery.sizeOf(context).width.clamp(0, 420).toDouble() * .92,
    backgroundColor: _historySurface,
    surfaceTintColor: Colors.transparent,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadiusDirectional.only(
        topEnd: Radius.circular(30),
        bottomEnd: Radius.circular(30),
      ),
    ),
    child: SafeArea(
      child: AnimatedBuilder(
        animation: widget.controller,
        builder: (context, _) {
          final controller = widget.controller;
          final error = _error ?? controller.conversationsError;
          final today = widget.today ?? DateTime.now();
          final groups = _groupConversations(controller.conversations, today);
          return CustomScrollView(
            slivers: [
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(18, 24, 18, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppColors.mint,
                              borderRadius: BorderRadius.circular(16),
                            ),
                            child: const Center(
                              child: DietIcon(
                                DietIconKind.coach,
                                size: 30,
                                monochrome: true,
                              ),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Semantics(
                                  header: true,
                                  child: const Text(
                                    'گفتگوهای من',
                                    style: TextStyle(
                                      fontSize: 21,
                                      height: 1.6,
                                      fontWeight: FontWeight.w800,
                                      color: _historyInk,
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 10,
                                    vertical: 3,
                                  ),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: _historyBorder),
                                    borderRadius: BorderRadius.circular(30),
                                  ),
                                  child: Text(
                                    '${faNumber(controller.conversations.length)} از ${faNumber(10)} گفتگو',
                                    style: const TextStyle(
                                      fontSize: 11,
                                      color: AppColors.inkSoft,
                                      height: 1.6,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 6),
                          IconButton(
                            tooltip: 'بستن تاریخچه',
                            onPressed: () => Navigator.pop(context),
                            style: IconButton.styleFrom(
                              backgroundColor: AppColors.mint,
                              foregroundColor: _historyInk,
                              minimumSize: const Size(44, 44),
                            ),
                            icon: const Icon(Icons.close_rounded, size: 25),
                          ),
                        ],
                      ),
                      const SizedBox(height: 24),
                      FilledButton.icon(
                        key: const ValueKey('coach-history-new'),
                        onPressed: _working
                            ? null
                            : () => _run(() async {
                                final opened = await controller
                                    .newConversation();
                                if (opened && context.mounted) {
                                  Navigator.pop(context);
                                }
                              }),
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.emeraldDeep,
                          foregroundColor: Colors.white,
                          minimumSize: const Size.fromHeight(54),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 12,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(18),
                          ),
                          textStyle: const TextStyle(
                            fontFamily: 'Vazirmatn',
                            fontSize: 17,
                            height: 1.6,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        icon: const Icon(Icons.add_comment_outlined, size: 24),
                        label: const Text('گفتگوی جدید'),
                      ),
                      if (error != null)
                        Padding(
                          padding: const EdgeInsets.only(top: 16),
                          child: Semantics(
                            liveRegion: true,
                            child: Text(
                              error,
                              style: const TextStyle(
                                color: AppColors.danger,
                                height: 1.7,
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
              if (controller.conversationsLoading || _working)
                const SliverToBoxAdapter(
                  child: LinearProgressIndicator(
                    minHeight: 2,
                    backgroundColor: AppColors.mint,
                  ),
                ),
              if (controller.conversations.isEmpty)
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 28,
                      vertical: 36,
                    ),
                    child: controller.conversationsError != null
                        ? Center(
                            child: TextButton(
                              onPressed: controller.refreshConversations,
                              child: const Text('تلاش دوباره'),
                            ),
                          )
                        : const Text(
                            'با اولین پیام، گفتگویت اینجا ذخیره می‌شود.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              color: AppColors.muted,
                              height: 1.8,
                            ),
                          ),
                  ),
                ),
              for (final group in groups) ...[
                SliverToBoxAdapter(child: _HistorySection(title: group.$1)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(14, 0, 14, 10),
                  sliver: SliverList.separated(
                    itemCount: group.$2.length,
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      final thread = group.$2[index];
                      return _HistoryCard(
                        key: ValueKey('coach-history-${thread.id}'),
                        thread: thread,
                        selected: controller.conversationId == thread.id,
                        today: today,
                        enabled: !_working,
                        onSelect: () => _run(() async {
                          await controller.selectConversation(thread.id);
                          if (context.mounted) Navigator.pop(context);
                        }),
                        onMenu: (action) => action == 'rename'
                            ? _rename(thread)
                            : _delete(thread),
                      );
                    },
                  ),
                ),
              ],
              const SliverFillRemaining(
                hasScrollBody: false,
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: EdgeInsets.fromLTRB(56, 32, 56, 28),
                    child: ExcludeSemantics(
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Expanded(child: Divider(color: _historyBotanical)),
                          Padding(
                            padding: EdgeInsets.symmetric(horizontal: 16),
                            child: DietIcon(
                              DietIconKind.leaf,
                              size: 32,
                              color: _historyBotanical,
                              monochrome: true,
                            ),
                          ),
                          Expanded(child: Divider(color: _historyBotanical)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    ),
  );
}

const _historySurface = Color(0xFFFAFAF6);
const _historyInk = Color(0xFF123E30);
const _historyBorder = Color(0xFFD8DBD1);
const _historyBotanical = Color(0xFFB6CAB0);

List<(String, List<CoachConversation>)> _groupConversations(
  List<CoachConversation> conversations,
  DateTime today,
) {
  final sorted = [...conversations]
    ..sort(
      (a, b) => (b.lastMessageAt ?? b.createdAt).compareTo(
        a.lastMessageAt ?? a.createdAt,
      ),
    );
  final yesterday = DateTime(today.year, today.month, today.day - 1);
  final groups = <String, List<CoachConversation>>{};
  for (final thread in sorted) {
    final date = (thread.lastMessageAt ?? thread.createdAt).toLocal();
    final label = DateUtils.isSameDay(date, today)
        ? 'امروز'
        : DateUtils.isSameDay(date, yesterday)
        ? 'دیروز'
        : 'قدیمی‌تر';
    (groups[label] ??= []).add(thread);
  }
  return [
    for (final label in ['امروز', 'دیروز', 'قدیمی‌تر'])
      if (groups.containsKey(label)) (label, groups[label]!),
  ];
}

class _HistorySection extends StatelessWidget {
  const _HistorySection({required this.title});
  final String title;
  @override
  Widget build(BuildContext context) => Padding(
    padding: const EdgeInsets.fromLTRB(20, 6, 20, 16),
    child: Row(
      children: [
        Semantics(
          header: true,
          child: Text(
            title,
            style: const TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w800,
              color: _historyInk,
              height: 1.7,
            ),
          ),
        ),
        const SizedBox(width: 16),
        const Expanded(child: Divider(color: _historyBorder)),
      ],
    ),
  );
}

class _HistoryCard extends StatelessWidget {
  const _HistoryCard({
    super.key,
    required this.thread,
    required this.selected,
    required this.today,
    required this.enabled,
    required this.onSelect,
    required this.onMenu,
  });
  final CoachConversation thread;
  final bool selected, enabled;
  final DateTime today;
  final VoidCallback onSelect;
  final ValueChanged<String> onMenu;

  DietIconKind get _topic {
    final text = '${thread.title} ${thread.preview}';
    if (text.contains('ورزش') || text.contains('تمرین')) {
      return DietIconKind.leaf;
    }
    if (text.contains('کار') || text.contains('میان')) {
      return DietIconKind.snack;
    }
    if (text.contains('غذا') ||
        text.contains('شام') ||
        text.contains('صبحانه') ||
        text.contains('ناهار')) {
      return DietIconKind.meal;
    }
    return DietIconKind.coach;
  }

  @override
  Widget build(BuildContext context) {
    final date = (thread.lastMessageAt ?? thread.createdAt).toLocal();
    final time =
        '${faNumber(date.hour).padLeft(2, '۰')}:${faNumber(date.minute).padLeft(2, '۰')}';
    final stamp = DateUtils.isSameDay(date, today)
        ? time
        : DateUtils.isSameDay(
            date,
            DateTime(today.year, today.month, today.day - 1),
          )
        ? 'دیروز'
        : persianDate(date, year: date.year != today.year);
    final preview = thread.preview.trim();
    final hasPreview = preview.isNotEmpty && preview != thread.title.trim();
    return Semantics(
      selected: selected,
      child: Material(
        color: selected ? AppColors.mint : _historySurface,
        elevation: selected ? 1 : 0,
        shadowColor: const Color(0x15123E30),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(22),
          side: BorderSide(
            color: selected ? AppColors.emeraldDeep : _historyBorder,
            width: selected ? 1.2 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: enabled ? onSelect : null,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(2, 18, 14, 18),
            child: Row(
              children: [
                ExcludeSemantics(
                  child: Stack(
                    clipBehavior: Clip.none,
                    children: [
                      Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: selected
                              ? const Color(0xFFD1EBD9)
                              : AppColors.mint,
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Center(
                          child: DietIcon(_topic, size: 30, monochrome: true),
                        ),
                      ),
                      if (selected)
                        PositionedDirectional(
                          top: -10,
                          end: -3,
                          child: Container(
                            width: 18,
                            height: 18,
                            decoration: BoxDecoration(
                              color: AppColors.emeraldDeep,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: AppColors.mint,
                                width: 2,
                              ),
                            ),
                            child: const Icon(
                              Icons.check_rounded,
                              color: Colors.white,
                              size: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        thread.title,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 15,
                          height: 1.7,
                          fontWeight: selected
                              ? FontWeight.w800
                              : FontWeight.w700,
                          color: _historyInk,
                        ),
                      ),
                      if (hasPreview)
                        Padding(
                          padding: const EdgeInsets.only(top: 5),
                          child: Text(
                            preview,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontSize: 12,
                              color: AppColors.muted,
                              height: 1.7,
                            ),
                          ),
                        ),
                      const SizedBox(height: 8),
                      Text(
                        stamp,
                        style: const TextStyle(
                          fontSize: 10,
                          height: 1.6,
                          color: AppColors.muted,
                        ),
                      ),
                    ],
                  ),
                ),
                PopupMenuButton<String>(
                  tooltip: 'گزینه‌های گفتگو',
                  enabled: enabled,
                  icon: const Icon(Icons.more_vert_rounded, size: 22),
                  color: AppColors.surface,
                  iconColor: selected
                      ? AppColors.emeraldDark
                      : AppColors.inkSoft,
                  onSelected: onMenu,
                  itemBuilder: (_) => const [
                    PopupMenuItem(value: 'rename', child: Text('تغییر نام')),
                    PopupMenuItem(value: 'delete', child: Text('حذف گفتگو')),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
