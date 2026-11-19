import 'dart:async';

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../data/day.dart';
import '../../../presentation/session/live_session.dart';
import '../presentation/coach_controller.dart';
import '../domain/coach_repository.dart';
import 'coach_header.dart';
import 'coach_companion.dart';
import 'coach_welcome.dart';
import 'conversation_history.dart';
import 'today_summary.dart';
import 'composer.dart';
import 'message_list.dart';
import 'profile_sheet.dart';
import 'quota_indicator.dart';
import 'today_ring_sheet.dart';
import 'workspace_pages.dart';

class CoachPage extends StatefulWidget {
  const CoachPage({
    super.key,
    required this.repository,
    this.prefill,
    this.autoSend,
    this.onClose,
  });

  final CoachRepository repository;
  final String? prefill;
  final String? autoSend;
  final VoidCallback? onClose;

  @override
  State<CoachPage> createState() => _CoachPageState();
}

class _CoachPageState extends State<CoachPage> {
  late final CoachController _controller = CoachController(
    repository: widget.repository,
  );
  bool _endingSession = false;
  bool _summaryExpanded = false;
  int _companionCue = 0;
  CompanionMood _companionMood = CompanionMood.calm;
  bool _greeted = false;
  Map<String, dynamic>? _quota;
  bool _wasBusy = false;
  int _quotaOperation = 0;
  int _shownConversationVersion = 0;
  Timer? _companionReset;

  @override
  void initState() {
    super.initState();
    unawaited(_loadQuota());
    _controller.onQuotaChanged = () {
      if (mounted) unawaited(_loadQuota());
    };
    _controller.onToday = (today, {required bool reloadPlan}) {
      if (!mounted) return;
      final store = DemoScope.of(context);
      if (!store.applyCoachToday(today)) return;
      final glasses = store.waterGlassesOn(store.today);
      if (glasses != null) {
        unawaited(store.waterLog.write(store.today, glasses));
      }
      if (reloadPlan && store.serverAuthEnabled) unawaited(refreshLive(store));
    };
    _controller.onTurnCompleted = ({required bool saved}) =>
        _react(saved ? CompanionMood.celebrate : CompanionMood.reply);
    _controller.addListener(_rebuild);
    Future<void>.microtask(() => _controller.start(autoSend: widget.autoSend));
  }

  void _rebuild() {
    if (!mounted) return;
    if (_shownConversationVersion != _controller.conversationVersion) {
      _shownConversationVersion = _controller.conversationVersion;
      _summaryExpanded = false;
      _companionReset?.cancel();
      _companionMood = CompanionMood.calm;
    }
    if (_controller.busy && !_wasBusy) {
      _companionReset?.cancel();
      _companionMood = CompanionMood.calm;
      _companionCue++;
    }
    _wasBusy = _controller.busy;
    if (!_greeted && !_controller.loading && !_controller.historyFailed) {
      _greeted = true;
      if (!_controller.busy) _react(CompanionMood.greeting);
    }
    if (_controller.sessionExpired && !_endingSession) {
      _endingSession = true;
      final store = DemoScope.of(context);
      if (store.serverAuthEnabled && store.customerAuth?.session != null) {
        unawaited(() async {
          try {
            await store.signOutCustomer();
          } catch (_) {
            store.logout();
          }
        }());
      }
    }
    setState(() {});
  }

  void _react(CompanionMood mood) {
    if (!mounted) return;
    _companionReset?.cancel();
    setState(() {
      _companionMood = mood;
      _companionCue++;
    });
    _companionReset = Timer(const Duration(milliseconds: 2800), () {
      if (mounted) setState(() => _companionMood = CompanionMood.calm);
    });
  }

  @override
  void dispose() {
    _companionReset?.cancel();
    _controller.removeListener(_rebuild);
    _controller.dispose();
    super.dispose();
  }

  Future<void> _loadQuota() async {
    final operation = ++_quotaOperation;
    try {
      final quota = await widget.repository.quota();
      if (!mounted || quota == null || operation != _quotaOperation) return;
      setState(() => _quota = quota);
    } catch (_) {}
  }

  void _toggleSummary() {
    if (MediaQuery.viewInsetsOf(context).bottom > 0) {
      FocusScope.of(context).unfocus();
      setState(() => _summaryExpanded = true);
    } else {
      setState(() => _summaryExpanded = !_summaryExpanded);
    }
  }

  @override
  Widget build(BuildContext context) {
    final failed = _controller.historyFailed && _controller.messages.isEmpty;
    final welcome =
        !_controller.loading &&
        !_controller.historyFailed &&
        !_controller.hasMore &&
        !_controller.busy &&
        !_controller.typing &&
        _controller.messages.every((message) => message.type == 'day_brief');
    final keyboardOpen = MediaQuery.viewInsetsOf(context).bottom > 0;
    final store = DemoScope.of(context);
    final mood = _controller.busy || _controller.typing
        ? CompanionMood.thinking
        : _controller.error != null || _controller.budgetNote != null
        ? CompanionMood.support
        : _companionMood;
    final brief = _controller.messages
        .where(
          (m) =>
              m.type == 'day_brief' &&
              dateKey(m.createdAt.toLocal()) == dateKey(store.today),
        )
        .lastOrNull;
    return Scaffold(
      backgroundColor: AppColors.bg,
      drawer: _controller.conversationRepository == null
          ? null
          : CoachConversationHistory(
              controller: _controller,
              today: store.today,
            ),
      body: DecoratedBox(
        decoration: const BoxDecoration(gradient: AppGradients.warmBackground),
        child: SafeArea(
          child: Column(
            children: [
              CoachHeader(
                typing: _controller.typing,
                onClose: widget.onClose ?? () => closeCoachToHome(context),
                onAvatar: () => showCoachProfileSheet(context),
                mood: mood,
                cue: _companionCue,
                onGreet: _controller.busy
                    ? null
                    : () => _react(CompanionMood.greeting),
              ),
              if (_controller.conversationRepository != null)
                Builder(
                  builder: (context) => Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                    child: Row(
                      children: [
                        IconButton(
                          key: const ValueKey('coach-history'),
                          tooltip: 'تاریخچهٔ گفتگوها',
                          onPressed: () {
                            FocusScope.of(context).unfocus();
                            Scaffold.of(context).openDrawer();
                            unawaited(_controller.refreshConversations());
                          },
                          icon: const Icon(
                            Icons.history_rounded,
                            color: AppColors.emeraldDark,
                          ),
                        ),
                        Expanded(
                          child: Text(
                            _controller.conversations
                                    .where(
                                      (t) => t.id == _controller.conversationId,
                                    )
                                    .firstOrNull
                                    ?.title ??
                                'گفتگوی جدید',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.inkSoft,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        IconButton(
                          key: const ValueKey('coach-new-conversation'),
                          tooltip: 'گفتگوی جدید',
                          onPressed: _controller.loading
                              ? null
                              : () async {
                                  FocusScope.of(context).unfocus();
                                  final opened = await _controller
                                      .newConversation();
                                  if (!context.mounted) return;
                                  if (opened) {
                                    setState(() => _summaryExpanded = false);
                                  } else {
                                    Scaffold.of(context).openDrawer();
                                  }
                                },
                          icon: const Icon(
                            Icons.add_comment_outlined,
                            color: AppColors.emeraldDark,
                          ),
                        ),
                        if (_controller.workspace != null)
                          PopupMenuButton<String>(
                            tooltip: 'ابزارهای گفتگو',
                            icon: const Icon(
                              Icons.more_vert_rounded,
                              color: AppColors.emeraldDark,
                            ),
                            onSelected: (action) {
                              FocusScope.of(context).unfocus();
                              if (action == 'memory') {
                                Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => CoachMemoryPage(
                                      controller: _controller,
                                    ),
                                  ),
                                );
                              } else {
                                openCoachLibrary(
                                  context,
                                  _controller,
                                  saved: action == 'saved',
                                );
                              }
                            },
                            itemBuilder: (_) => const [
                              PopupMenuItem(
                                value: 'search',
                                child: Text('جست‌وجو در گفتگوها'),
                              ),
                              PopupMenuItem(
                                value: 'saved',
                                child: Text('نشان‌شده‌ها'),
                              ),
                              PopupMenuItem(
                                value: 'memory',
                                child: Text('حافظه مربی'),
                              ),
                            ],
                          ),
                      ],
                    ),
                  ),
                ),
              if (_quota?['hasQuota'] == true &&
                  _quota?['dailyRemaining'] is num &&
                  _quota?['dailyLimit'] is num)
                QuotaIndicator(
                  dailyRemaining: (_quota!['dailyRemaining'] as num).toInt(),
                  dailyLimit: (_quota!['dailyLimit'] as num).toInt(),
                  periodRemaining:
                      (_quota!['periodRemaining'] as num?)?.toInt() ?? 0,
                ),
              if (!keyboardOpen && mood == CompanionMood.celebrate)
                CoachCompanionNote(
                  typing: false,
                  celebrated: mood == CompanionMood.celebrate,
                  mood: mood,
                  cue: _companionCue,
                ),
              if (!welcome || _summaryExpanded)
                CoachTodaySummary(
                  expanded: _summaryExpanded,
                  keyboardOpen: keyboardOpen,
                  brief: brief,
                  onToggle: _toggleSummary,
                  onRing: () async {
                    await _controller.refreshToday();
                    if (!context.mounted) return;
                    showTodayRingSheet(context);
                  },
                ),
              if (_controller.budgetNote != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    _controller.budgetNote!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.emeraldDeep,
                      height: 1.6,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                )
              else if (_controller.error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    _controller.error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      color: AppColors.danger,
                      height: 1.6,
                    ),
                  ),
                ),
              Expanded(
                child: _controller.loading && _controller.messages.isEmpty
                    ? const Center(child: Text('دارم گفتگو رو می‌آرم…'))
                    : failed
                    ? Center(
                        child: TextButton(
                          onPressed: _controller.retry,
                          child: const Text('تلاش دوباره'),
                        ),
                      )
                    : welcome
                    ? CoachWelcome(
                        key: const ValueKey('coach-welcome'),
                        mood: mood,
                        cue: _companionCue,
                      )
                    : CoachMessageList(
                        controller: _controller,
                        pinnedBriefId: brief?.id,
                      ),
              ),
              CoachComposer(
                key: ValueKey('composer-${_controller.conversationVersion}'),
                controller: _controller,
                onTodayPlan: _toggleSummary,
                prefill: widget.autoSend == null ? widget.prefill : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
