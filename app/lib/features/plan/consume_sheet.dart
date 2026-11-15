import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/pill_button.dart';
import 'goal_math.dart';
import 'meal_log_feedback.dart';

Future<bool> showConsumeSheet(
  BuildContext context,
  DateTime date,
  int index,
) async {
  final store = DemoScope.of(context);
  final before = store.checkpointMeal(date, index);
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    builder: (context) => ConsumeSheet(date: date, index: index),
  );
  if (saved == true && context.mounted) {
    mealLogFeedback(
      context,
      store,
      before: before,
      after: store.checkpointMeal(date, index),
    );
  }
  return saved == true;
}

class ConsumeSheet extends StatefulWidget {
  const ConsumeSheet({super.key, required this.date, required this.index});

  final DateTime date;
  final int index;

  @override
  State<ConsumeSheet> createState() => _ConsumeSheetState();
}

class _ConsumeSheetState extends State<ConsumeSheet> {
  final _food = TextEditingController();
  final _amount = TextEditingController();
  final _unit = TextEditingController(text: 'گرم');
  String _mode = 'according';
  String? _error;
  bool _busy = false;
  bool _ready = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_ready) return;
    _ready = true;
    final previous = DemoScope.of(
      context,
    ).mealRecordOn(widget.date, widget.index);
    final mode = previous?['mode'];
    if (mode is String && consumeLabels.containsKey(mode)) _mode = mode;
    final title = previous?['title'];
    if (title is String) _food.text = title;
    final quantity = previous?['quantity'];
    if (quantity != null) _amount.text = quantity.toString();
    final unit = previous?['unit'];
    if (unit is String && unit.isNotEmpty) _unit.text = unit;
  }

  @override
  void dispose() {
    _food.dispose();
    _amount.dispose();
    _unit.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_busy) return;
    final store = DemoScope.of(context);
    final needsAmount = _mode == 'adjusted' || _mode == 'different';
    final quantity = double.tryParse(
      latinDigits(_amount.text).replaceAll('٫', '.'),
    );
    if (needsAmount &&
        (quantity == null || quantity <= 0 || _unit.text.trim().isEmpty)) {
      setState(() => _error = 'مقدار و واحد را بنویس');
      return;
    }
    if (_mode == 'different' && _food.text.trim().isEmpty) {
      setState(() => _error = 'نام غذا را بنویس');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await store.recordMeal(
        widget.date,
        widget.index,
        _mode,
        foodName: _food.text,
        quantity: quantity,
        unit: _unit.text,
      );
      if (!mounted) return;
      Haptics.success();
      Navigator.pop(context, true);
    } catch (_) {
      if (mounted) setState(() => _error = 'ثبت نشد. دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _remove() async {
    final store = DemoScope.of(context);
    if (_busy || !canLogMeal(store, widget.date)) return;
    final before = store.checkpointMeal(widget.date, widget.index);
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await store.clearMealRecord(widget.date, widget.index);
      if (!mounted) return;
      mealLogFeedback(
        context,
        store,
        before: before,
        after: store.checkpointMeal(widget.date, widget.index),
        removed: true,
      );
      Navigator.pop(context, false);
    } catch (_) {
      if (mounted) {
        setState(() => _error = 'ثبت برگردانده نشد. دوباره تلاش کن.');
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final meals = store.mealsOn(widget.date);
    final title = widget.index < meals.length ? meals[widget.index].title : '';
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final needsAmount = _mode == 'adjusted' || _mode == 'different';
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, bottom + 16),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(title, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                for (final entry in consumeLabels.entries)
                  ChoiceChip(
                    label: Text(entry.value),
                    selected: _mode == entry.key,
                    selectedColor: AppColors.mint,
                    onSelected: _busy
                        ? null
                        : (_) => setState(() {
                            _mode = entry.key;
                            _error = null;
                          }),
                  ),
              ],
            ),
            if (_mode == 'different') ...[
              const SizedBox(height: 12),
              TextField(
                controller: _food,
                decoration: const InputDecoration(labelText: 'نام غذا'),
              ),
            ],
            if (needsAmount) ...[
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _amount,
                      keyboardType: const TextInputType.numberWithOptions(
                        decimal: true,
                      ),
                      decoration: const InputDecoration(labelText: 'مقدار'),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextField(
                      controller: _unit,
                      decoration: const InputDecoration(labelText: 'واحد'),
                    ),
                  ),
                ],
              ),
            ],
            if (_error != null) ...[
              const SizedBox(height: 8),
              Text(
                _error!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12),
              ),
            ],
            const SizedBox(height: 16),
            PillButton(
              label: 'انجام شد',
              loading: _busy,
              onPressed: _busy ? null : _save,
            ),
            if (store.mealRecordOn(widget.date, widget.index) != null ||
                store.mealEaten(widget.date, widget.index))
              TextButton.icon(
                key: const ValueKey('meal-undo-registration'),
                onPressed: _busy ? null : _remove,
                icon: const Icon(Icons.undo_rounded, size: 18),
                label: const Text('برگرداندن ثبت این وعده'),
              ),
          ],
        ),
      ),
    );
  }
}
