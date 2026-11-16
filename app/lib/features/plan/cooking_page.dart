import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../domain/common/digits.dart';
import '../../domain/plan/meal.dart';
import '../../presentation/widgets/kit/kit.dart';
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

  @override
  Widget build(BuildContext context) {
    final steps = _steps;
    final total = steps.length;
    final text = total == 0 ? '' : steps[_step];
    // Only explicitly named ingredients are associated with a step. Quantities
    // remain the approved whole-meal amounts, never inferred step quantities.
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
    return PopScope<void>(
      canPop: _leaving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _exit();
      },
      child: Scaffold(
        backgroundColor: AppColors.bg,
        appBar: AppBar(
          leading: IconButton(
            tooltip: 'خروج از حالت آشپزی',
            onPressed: _exit,
            icon: const Icon(Icons.close_rounded),
          ),
          title: const Text('حالت آشپزی'),
        ),
        body: ListView(
          controller: _scroll,
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              widget.meal.title,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 16),
            if (total == 0)
              const Text('دستور تهیهٔ این غذا هنوز درج نشده است.')
            else ...[
              Text(
                'مرحلهٔ ${fa(_step + 1)} از ${fa(total)}',
                key: const ValueKey('cooking-step-count'),
                style: const TextStyle(
                  color: AppColors.emeraldDeep,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const SizedBox(height: 10),
              LinearProgressIndicator(
                value: (_step + 1) / total,
                minHeight: 5,
                borderRadius: BorderRadius.circular(8),
                backgroundColor: AppColors.line,
                color: AppColors.emeraldDeep,
              ),
              const SizedBox(height: 20),
              AppCard(
                padding: const EdgeInsets.all(24),
                child: AnimatedSwitcher(
                  duration: Motion.of(context, Motion.quick),
                  child: Semantics(
                    key: ValueKey('cooking-step-$_step'),
                    liveRegion: true,
                    child: Text(
                      text,
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        height: 1.9,
                      ),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              if (mentioned.isNotEmpty)
                AppCard.tinted(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'مواد نام‌برده در این مرحله',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 8),
                      for (final item in mentioned)
                        Text(
                          ingredientLine(item),
                          style: const TextStyle(fontSize: 16, height: 1.8),
                        ),
                      const SizedBox(height: 6),
                      const Text(
                        'مقدارها برای کل وعده‌اند؛ طبق دستور استفاده کن.',
                        style: TextStyle(
                          fontSize: 12,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    ],
                  ),
                )
              else
                const Text(
                  'مواد این مرحله جداگانه مشخص نشده؛ فهرست کامل مواد را ببین.',
                  style: TextStyle(color: AppColors.inkSoft, height: 1.7),
                ),
              ExpansionTile(
                key: const ValueKey('cooking-all-ingredients'),
                tilePadding: EdgeInsets.zero,
                title: const Text('همهٔ مواد و مقدارها'),
                children: [
                  if (widget.meal.ingredients.isEmpty)
                    Text(
                      widget.meal.amount.isEmpty
                          ? 'مقدار مواد هنوز ثبت نشده است.'
                          : widget.meal.amount,
                    ),
                  for (final item in widget.meal.ingredients)
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          ingredientLine(item),
                          style: const TextStyle(fontSize: 16),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              if (_timerStep == null)
                OutlinedButton.icon(
                  key: const ValueKey('cooking-add-timer'),
                  onPressed: _chooseTimer,
                  icon: const Icon(Icons.timer_outlined),
                  label: const Text('تایمر اختیاری'),
                )
              else
                AppCard(
                  key: const ValueKey('cooking-timer'),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Text(
                        'تایمر مرحلهٔ ${fa(_timerStep! + 1)}',
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      Semantics(
                        liveRegion: _finished,
                        label: _finished ? 'زمان تایمر تمام شد' : null,
                        child: Text(
                          _finished ? 'زمان تمام شد' : time,
                          key: const ValueKey('cooking-countdown'),
                          textAlign: TextAlign.center,
                          style: const TextStyle(
                            fontSize: 36,
                            fontWeight: FontWeight.w800,
                            fontFeatures: [FontFeature.tabularFigures()],
                          ),
                        ),
                      ),
                      if (_finished)
                        const Text(
                          'غذا را بررسی کن؛ پایان تایمر به معنی آماده‌بودن غذا نیست.',
                          style: TextStyle(
                            color: AppColors.inkSoft,
                            height: 1.7,
                          ),
                        ),
                      Wrap(
                        alignment: WrapAlignment.center,
                        spacing: 8,
                        children: [
                          if (!_finished)
                            TextButton.icon(
                              key: const ValueKey('cooking-pause'),
                              onPressed: _pauseResume,
                              icon: Icon(
                                _deadline == null
                                    ? Icons.play_arrow_rounded
                                    : Icons.pause_rounded,
                              ),
                              label: Text(
                                _deadline == null ? 'ادامهٔ تایمر' : 'مکث',
                              ),
                            ),
                          TextButton(
                            onPressed: () {
                              _ticker?.cancel();
                              setState(() {
                                _timerStep = null;
                                _deadline = null;
                                _remaining = Duration.zero;
                                _finished = false;
                              });
                            },
                            child: const Text('حذف تایمر'),
                          ),
                        ],
                      ),
                      const Text(
                        'در پس‌زمینه زمان محاسبه می‌شود؛ اعلان بیرون از برنامه ندارد.',
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.inkSoft,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ],
        ),
        bottomNavigationBar: SafeArea(
          top: false,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
            child: Row(
              children: [
                if (total > 0) ...[
                  OutlinedButton(
                    onPressed: _step == 0 ? null : () => _goStep(_step - 1),
                    child: const Text('قبلی'),
                  ),
                  const SizedBox(width: 12),
                ],
                Expanded(
                  child: FilledButton(
                    key: const ValueKey('cooking-next'),
                    onPressed: total == 0 || _step == total - 1
                        ? _exit
                        : () => _goStep(_step + 1),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                    ),
                    child: Text(
                      total == 0 || _step == total - 1
                          ? 'پایان آشپزی'
                          : 'مرحلهٔ بعد',
                    ),
                  ),
                ),
              ],
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
