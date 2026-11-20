import 'package:flutter/material.dart';
import '../../core/theme/tokens.dart';
import '../../data/day.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../../presentation/session/live_session.dart';
import 'ai_swap_sheet.dart';

/// Keeps approved alternatives and their confirmation flow out of the meal overview.
class MealSubstitutionSheet extends StatefulWidget {
  const MealSubstitutionSheet({
    super.key,
    required this.date,
    required this.index,
    required this.onCoach,
  });
  final DateTime date;
  final int index;
  final ValueChanged<Meal> onCoach;
  @override
  State<MealSubstitutionSheet> createState() => _MealSubstitutionSheetState();
}

class _MealSubstitutionSheetState extends State<MealSubstitutionSheet> {
  String? _choice;
  String? _reason;
  final _note = TextEditingController();
  String? _error;
  bool _busy = false;

  @override
  void dispose() {
    _note.dispose();
    super.dispose();
  }

  String _selected(DemoStore store) =>
      _choice ?? store.selectedOptionOn(widget.date, widget.index);

  Future<void> _substitute(DemoStore store) async {
    if (_busy || store.savingSubstitution) return;
    final choice = _selected(store);
    final current = store.selectedOptionOn(widget.date, widget.index);
    if (choice == current || !store.canSubstituteOn(widget.date)) return;
    final today = dateKey(widget.date) == dateKey(store.today);
    if (today && (_reason == null || _reason!.isEmpty)) {
      setState(() => _error = 'دلیل را انتخاب کن');
      return;
    }
    final eaten = store.mealEaten(widget.date, widget.index);
    if (eaten) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (dialog) => AlertDialog(
          title: const Text('قبلاً ثبت شده'),
          content: const Text('فقط برنامه عوض می‌شود. مصرف قبلی می‌ماند.'),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(dialog, false),
              child: const Text('انصراف'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(dialog, true),
              child: const Text('عوض کن'),
            ),
          ],
        ),
      );
      if (confirmed != true || !mounted) return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final changed = await store.substituteMeal(
        widget.date,
        widget.index,
        choice,
        _reason ?? '',
        explanation: _note.text,
        confirmConsumed: eaten,
      );
      if (!mounted) return;
      if (!changed) {
        setState(() => _error = 'این همان انتخاب فعلی است');
      } else {
        Navigator.pop(context, true);
      }
    } on StateError catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'ذخیره نشد. دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final meal = store.mealsOn(widget.date)[widget.index];
    final original = store.originalMealOn(widget.date, widget.index);
    final alternatives = store.alternativesOn(widget.date, widget.index);
    final current = store.selectedOptionOn(widget.date, widget.index);
    final choice = _selected(store);
    final options = <String, Meal>{
      'original': original,
      for (final alternative in alternatives)
        alternative.id: alternative.meal.copyWith(
          name: original.name,
          time: original.time,
        ),
    };
    return PopScope(
      canPop: !_busy,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: EdgeInsets.only(
            bottom: MediaQuery.viewInsetsOf(context).bottom,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'جایگزین این وعده',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const Text(
                  'از گزینه‌های تأییدشدهٔ برنامه‌ات انتخاب کن.',
                  style: TextStyle(color: AppColors.muted),
                ),
                const SizedBox(height: 16),
                if (store.serverAuthEnabled && store.customerAuth != null)
                  Builder(
                    builder: (context) {
                      final mealId = store
                          .serverMealUids['${dateKey(widget.date)}|${widget.index}'];
                      if (mealId == null) return const SizedBox.shrink();
                      return Align(
                        alignment: AlignmentDirectional.centerStart,
                        child: TextButton.icon(
                          onPressed: () async {
                            final changed = await openAiSwapSheet(
                              context,
                              mealId: mealId,
                              mealTitle: meal.title,
                              auth: store.customerAuth!,
                            );
                            if (changed == true) {
                              await refreshLive(store);
                              if (context.mounted) Navigator.pop(context, true);
                            }
                          },
                          icon: const Icon(Icons.auto_awesome),
                          label: const Text('جایگزین از کاتالوگ'),
                        ),
                      );
                    },
                  ),
                if (alternatives.isEmpty)
                  const Text(
                    'جایگزین تأییدشده‌ای نیست',
                    style: TextStyle(color: AppColors.muted, fontSize: 12),
                  ),
                for (final option in options.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: AppCard(
                      color: choice == option.key
                          ? AppColors.mint
                          : AppColors.surface,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 14,
                        vertical: 12,
                      ),
                      onTap: _busy || !store.canSubstituteOn(widget.date)
                          ? null
                          : () => setState(() {
                              _choice = option.key;
                              _error = null;
                            }),
                      child: Row(
                        children: [
                          Icon(
                            choice == option.key
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            color: AppColors.emerald,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  option.value.title,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                Text(
                                  option.key == 'original'
                                      ? 'اصلی${current == option.key ? ' · فعلی' : ''}'
                                      : 'جایگزین${current == option.key ? ' · فعلی' : ''}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 12,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (option.value.calories > 0)
                            Text(
                              fa(option.value.calories),
                              style: const TextStyle(
                                color: AppColors.emeraldDeep,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                if (choice != current &&
                    store.canSubstituteOn(widget.date)) ...[
                  if (dateKey(widget.date) == dateKey(store.today)) ...[
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        for (final reason in store.substitutionReasons.entries)
                          ChoiceChip(
                            label: Text(reason.value),
                            selected: _reason == reason.key,
                            selectedColor: AppColors.mint,
                            onSelected: _busy
                                ? null
                                : (_) => setState(() => _reason = reason.key),
                          ),
                      ],
                    ),
                    const SizedBox(height: 8),
                  ],
                  TextField(
                    controller: _note,
                    enabled: !_busy,
                    maxLength: 500,
                    maxLines: 2,
                    decoration: const InputDecoration(labelText: 'توضیح'),
                  ),
                  const SizedBox(height: 8),
                  PillButton(
                    label: _busy ? 'در حال ذخیره' : 'تأیید جایگزینی',
                    loading: _busy,
                    onPressed: _busy ? null : () => _substitute(store),
                  ),
                ],
                if (!store.canSubstituteOn(widget.date))
                  const Padding(
                    padding: EdgeInsets.only(top: 4),
                    child: Text(
                      'روز گذشته عوض نمی‌شود',
                      style: TextStyle(color: AppColors.muted, fontSize: 12),
                    ),
                  ),
                const SizedBox(height: 8),
                PillButton(
                  label: 'تعویض با مربی',
                  icon: Icons.swap_horiz_rounded,
                  variant: PillVariant.soft,
                  onPressed: _busy
                      ? null
                      : () {
                          Navigator.pop(context);
                          widget.onCoach(meal);
                        },
                ),
                if (_error != null) ...[
                  const SizedBox(height: 8),
                  Text(
                    _error!,
                    style: const TextStyle(
                      color: AppColors.danger,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
