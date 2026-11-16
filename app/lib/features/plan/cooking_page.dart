import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../domain/common/digits.dart';
import '../../domain/plan/meal.dart';
import 'cooking_parts.dart';
import 'goal_math.dart';

/// A recipe viewer, independent of meal logging. Timers use a deadline so
/// backgrounding the app does not silently pause the countdown.
class CookingPage extends StatefulWidget {
  const CookingPage({super.key, required this.meal, this.clock});
  final Meal meal;
  final DateTime Function()? clock;

  @override
  State<CookingPage> createState() => _CookingPageState();
}

class _CookingPageState extends State<CookingPage> with WidgetsBindingObserver {
  int _step = 0;
  int? _timerStep;
  Duration _remaining = Duration.zero;
  DateTime? _deadline;
  Timer? _ticker;
  final _scroll = ScrollController();
  bool _finished = false, _leaving = false;
  DateTime get _now => widget.clock?.call() ?? DateTime.now();
  List<String> get _steps => recipeSteps(widget.meal.instructions);

  void _goStep(int step) {
    setState(() => _step = step);
    if (_scroll.hasClients) _scroll.jumpTo(0);
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  void _watch() {
    _ticker?.cancel();
    if (_deadline != null) {
      _ticker = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
    }
  }

  void _tick() {
    final end = _deadline;
    if (!mounted || end == null) return;
    final left = end.difference(_now);
    setState(() {
      _remaining = left.isNegative ? Duration.zero : left;
      if (_remaining == Duration.zero) {
        _deadline = null;
        _finished = true;
        _ticker?.cancel();
      }
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _tick();
      _watch();
    } else {
      _ticker?.cancel();
    }
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _scroll.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  Future<void> _chooseTimer() async {
    final minutes = await showModalBottomSheet<int>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (_) => const _TimerPicker(),
    );
    if (!mounted || minutes == null) return;
    setState(() {
      _remaining = Duration(minutes: minutes);
      _deadline = _now.add(_remaining);
      _timerStep = _step;
      _finished = false;
    });
    _watch();
  }

  void _pauseResume() {
    if (_deadline != null) {
      _tick();
      if (_finished) return;
      setState(() => _deadline = null);
      _ticker?.cancel();
    } else {
      setState(() => _deadline = _now.add(_remaining));
      _watch();
    }
  }

  Future<void> _exit() async {
    if (_leaving) return;
    var exit = true;
    if (_timerStep != null && !_finished) {
      exit =
          await showDialog<bool>(
            context: context,
            builder: (dialog) => AlertDialog(
              title: const Text('از حالت آشپزی خارج می‌شوی؟'),
              content: const Text(
                'با خروج، تایمر متوقف می‌شود. برای ادامهٔ تایمر در این صفحه بمان.',
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(dialog, false),
                  child: const Text('ادامهٔ آشپزی'),
                ),
                FilledButton(
                  onPressed: () => Navigator.pop(dialog, true),
                  child: const Text('خروج و توقف تایمر'),
                ),
              ],
            ),
          ) ??
          false;
    }
    if (!mounted || !exit) return;
    setState(() => _leaving = true);
    // Let PopScope receive the updated canPop before popping.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) Navigator.pop(context);
    });
  }

  void _removeTimer() {
    _ticker?.cancel();
    setState(() {
      _timerStep = null;
      _deadline = null;
      _remaining = Duration.zero;
      _finished = false;
    });
  }

  void _showIngredients() {
    showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      showDragHandle: true,
      isScrollControlled: true,
      backgroundColor: AppColors.bg,
      builder: (_) => ConstrainedBox(
        constraints: BoxConstraints(
          maxHeight: MediaQuery.sizeOf(context).height * .75,
        ),
        child: ListView(
          shrinkWrap: true,
          padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
          children: [
            Text(
              'مواد و مقدارهای این وعده',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 8),
            const Text(
              'مقدارها برای کل وعده‌اند؛ طبق دستور استفاده کن.',
              style: TextStyle(
                fontSize: 12,
                color: AppColors.inkSoft,
                height: 1.7,
              ),
            ),
            const SizedBox(height: 16),
            if (widget.meal.ingredients.isEmpty)
              Text(
                widget.meal.amount.isEmpty
                    ? 'مقدار مواد هنوز ثبت نشده است.'
                    : widget.meal.amount,
              ),
            for (final item in widget.meal.ingredients)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Text(
                  ingredientLine(item),
                  style: const TextStyle(fontSize: 17, height: 1.8),
                ),
              ),
            if (widget.meal.quantityBasis.isNotEmpty)
              Text(
                widget.meal.quantityBasis,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.inkSoft,
                  height: 1.7,
                ),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final steps = _steps;
    final total = steps.length;
    final text = total == 0 ? '' : steps[_step];
    String normalize(String s) => s
        .replaceAll('ي', 'ی')
        .replaceAll('ك', 'ک')
        .replaceAll('\u200c', ' ')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final mentioned = widget.meal.ingredients
        .where(
          (i) =>
              i.name.trim().isNotEmpty &&
              normalize(text).contains(normalize(i.name)),
        )
        .toList();
    final seconds = (_remaining.inMilliseconds / 1000).ceil();
    final time =
        '${fa((seconds ~/ 60).toString().padLeft(2, '0'))}:${fa((seconds % 60).toString().padLeft(2, '0'))}';
    final ending = total == 0 || _step == total - 1;
    return PopScope<void>(
      canPop: _leaving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _exit();
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        body: Stack(
          children: [
            CustomScrollView(
              controller: _scroll,
              slivers: [
                SliverToBoxAdapter(child: CookingHero(meal: widget.meal)),
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
                  sliver: SliverList.list(
                    children: [
                      Text(
                        widget.meal.title,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(
                              color: AppColors.emeraldDark,
                              fontWeight: FontWeight.w800,
                              height: 1.5,
                            ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        widget.meal.name,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12,
                          color: AppColors.inkSoft,
                        ),
                      ),
                      const SizedBox(height: 16),
                      if (total == 0)
                        const Padding(
                          padding: EdgeInsets.symmetric(vertical: 24),
                          child: Text('دستور تهیهٔ این غذا هنوز درج نشده است.'),
                        )
                      else ...[
                        CookingStepTrack(step: _step, total: total),
                        const SizedBox(height: 14),
                        const Divider(color: AppColors.line, height: 1),
                        const SizedBox(height: 16),
                        const Row(
                          children: [
                            Icon(
                              Icons.eco_outlined,
                              size: 18,
                              color: AppColors.emeraldDeep,
                            ),
                            SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'قدم‌به‌قدم با دستور غذا',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: AppColors.emeraldDeep,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        AnimatedSwitcher(
                          duration: Motion.of(context, Motion.quick),
                          child: Semantics(
                            key: ValueKey('cooking-step-$_step'),
                            liveRegion: true,
                            child: Align(
                              alignment: AlignmentDirectional.centerStart,
                              child: Text(
                                text,
                                style: const TextStyle(
                                  fontSize: 23,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.emeraldDark,
                                  height: 1.8,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        const Divider(color: AppColors.line, height: 1),
                        CookingIngredients(
                          items: mentioned,
                          onShowAll: _showIngredients,
                        ),
                        const SizedBox(height: 16),
                        if (_timerStep == null)
                          OutlinedButton.icon(
                            key: const ValueKey('cooking-add-timer'),
                            onPressed: _chooseTimer,
                            style: OutlinedButton.styleFrom(
                              backgroundColor: AppColors.mint,
                              side: BorderSide.none,
                              minimumSize: const Size.fromHeight(56),
                            ),
                            icon: const Icon(Icons.timer_outlined),
                            label: const Text('تایمر اختیاری'),
                          )
                        else
                          CookingTimerPanel(
                            time: time,
                            step: _timerStep!,
                            paused: _deadline == null,
                            finished: _finished,
                            onPause: _pauseResume,
                            onDelete: _removeTimer,
                          ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
            PositionedDirectional(
              top: 12,
              end: 16,
              child: SafeArea(
                bottom: false,
                child: Material(
                  color: AppColors.surfaceWarm,
                  shape: const CircleBorder(),
                  elevation: 1,
                  shadowColor: const Color(0x180A5C42),
                  child: IconButton(
                    tooltip: 'خروج از حالت آشپزی',
                    onPressed: _exit,
                    icon: const Icon(
                      Icons.arrow_forward_rounded,
                      color: AppColors.emeraldDark,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        bottomNavigationBar: DecoratedBox(
          decoration: const BoxDecoration(
            color: AppColors.bg,
            border: Border(top: BorderSide(color: AppColors.line)),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Row(
                children: [
                  if (total > 0) ...[
                    OutlinedButton.icon(
                      onPressed: _step == 0 ? null : () => _goStep(_step - 1),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 13),
                        minimumSize: const Size(82, 52),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      icon: const Icon(Icons.chevron_right_rounded, size: 20),
                      label: const Text('قبلی', style: TextStyle(fontSize: 13)),
                    ),
                    const SizedBox(width: 10),
                  ],
                  Expanded(
                    child: FilledButton(
                      key: const ValueKey('cooking-next'),
                      onPressed: ending ? _exit : () => _goStep(_step + 1),
                      style: FilledButton.styleFrom(
                        backgroundColor: AppColors.emeraldDeep,
                        minimumSize: const Size.fromHeight(52),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 13,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              ending ? 'پایان آشپزی' : 'مرحلهٔ بعد',
                              textAlign: TextAlign.center,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Icon(
                            ending
                                ? Icons.check_rounded
                                : Icons.arrow_back_rounded,
                            textDirection: TextDirection.ltr,
                            size: 21,
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _TimerPicker extends StatefulWidget {
  const _TimerPicker();
  @override
  State<_TimerPicker> createState() => _TimerPickerState();
}

class _TimerPickerState extends State<_TimerPicker> {
  final _minutes = TextEditingController(text: '۵');
  String? _error;
  @override
  void dispose() {
    _minutes.dispose();
    super.dispose();
  }

  void _start() {
    final minutes = int.tryParse(latinDigits(_minutes.text.trim()));
    if (minutes == null || minutes < 1 || minutes > 180) {
      setState(() => _error = 'زمانی بین ۱ تا ۱۸۰ دقیقه وارد کن.');
      return;
    }
    Navigator.pop(context, minutes);
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      24,
      8,
      24,
      24 + MediaQuery.viewInsetsOf(context).bottom,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('تایمر این مرحله', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        const Text('زمان را طبق دستور غذا انتخاب کن.'),
        const SizedBox(height: 12),
        TextField(
          key: const ValueKey('cooking-timer-minutes'),
          controller: _minutes,
          keyboardType: TextInputType.number,
          decoration: InputDecoration(labelText: 'دقیقه', errorText: _error),
          onSubmitted: (_) => _start(),
        ),
        Wrap(
          spacing: 8,
          children: [
            for (final value in [1, 5, 10, 15])
              ActionChip(
                label: Text('${fa(value)} دقیقه'),
                onPressed: () {
                  _minutes.text = fa(value);
                  setState(() => _error = null);
                },
              ),
          ],
        ),
        const SizedBox(height: 12),
        FilledButton(onPressed: _start, child: const Text('شروع تایمر')),
      ],
    ),
  );
}
