import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/day.dart';
import '../theme.dart';
import 'celebration.dart';
import 'ui.dart';

const mealLogLabels = {
  'according': 'طبق برنامه خوردم',
  'adjusted': 'کمتر یا بیشتر خوردم',
  'different': 'غذای دیگری خوردم',
  'skipped': 'این وعده را نخوردم',
};

class MealLogCheckbox extends StatelessWidget {
  const MealLogCheckbox({super.key, required this.date, required this.index});
  final DateTime date;
  final int index;

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final eaten = store.mealEaten(date, index);
    final today = dateKey(date) == dateKey(store.today);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: 22,
          height: 22,
          child: Checkbox(
            key: ValueKey('meal-log-${dateKey(date)}-$index'),
            value: eaten,
            visualDensity: VisualDensity.compact,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
            onChanged:
                !today || store.savingMeal || store.savingSubstitution
                ? null
                : (checked) async {
                    final next = checked ?? false;
                    await store.setMealEaten(date, index, next);
                    if (next && context.mounted) {
                      showMealCelebration(context);
                    }
                  },
          ),
        ),
        const SizedBox(width: 4),
        Text(
          'خوردم',
          style: TextStyle(
            fontSize: 11,
            color: eaten ? muted : ink,
            fontWeight: eaten ? FontWeight.normal : FontWeight.w500,
          ),
        ),
      ],
    );
  }
}

class MealLogAction extends StatelessWidget {
  const MealLogAction({super.key, required this.date, required this.index});
  final DateTime date;
  final int index;
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context),
        record = store.mealRecordOn(date, index);
    final recorded = record != null || store.mealEaten(date, index);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (record != null)
          Text(
            '${mealLogLabels[record["mode"]] ?? "طبق برنامه خوردم"}\n${record["amount"]}',
            style: const TextStyle(fontSize: 11),
          ),
        if (record != null &&
            record['mode'] != 'skipped' &&
            record['calories'] == null)
          const Text(
            'کالری این ثبت محاسبه نشده',
            style: TextStyle(color: muted, fontSize: 11),
          ),
        OutlinedButton.icon(
          key: ValueKey('meal-log-${dateKey(date)}-$index'),
          onPressed:
              store.savingMeal ||
                  store.savingSubstitution ||
                  dateKey(date) != dateKey(store.today)
              ? null
              : () => showMealLog(context, date, index),
          icon: Icon(
            recorded ? Icons.edit_outlined : Icons.restaurant_outlined,
            size: 18,
          ),
          label: Text(
            store.savingMeal
                ? 'در حال ذخیره…'
                : recorded
                ? 'اصلاح ثبت وعده'
                : 'ثبت وعده',
          ),
        ),
      ],
    );
  }
}

Future<void> showMealLog(BuildContext context, DateTime date, int index) async {
  final store = DemoScope.of(context);
  final saved = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: cream,
    builder: (_) => _LogForm(store: store, date: date, index: index),
  );
  if (saved == true && context.mounted) {
    showMealCelebration(context);
  }
}

class _LogForm extends StatefulWidget {
  const _LogForm({
    required this.store,
    required this.date,
    required this.index,
  });
  final DemoStore store;
  final DateTime date;
  final int index;
  @override
  State<_LogForm> createState() => _LogFormState();
}

class _LogFormState extends State<_LogForm> {
  final form = GlobalKey<FormState>();
  final food = TextEditingController(),
      amount = TextEditingController(),
      unit = TextEditingController();
  String mode = 'according';
  String? error;
  bool busy = false;
  @override
  void initState() {
    super.initState();
    final previous = widget.store.mealRecordOn(widget.date, widget.index);
    mode = previous?['mode'] as String? ?? 'according';
    food.text = previous?['title'] as String? ?? '';
    amount.text = previous?['quantity']?.toString() ?? '';
    unit.text = previous?['unit'] as String? ?? '';
  }

  @override
  void dispose() {
    food.dispose();
    amount.dispose();
    unit.dispose();
    super.dispose();
  }

  Future<void> save() async {
    if (busy || !form.currentState!.validate()) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await widget.store.recordMeal(
        widget.date,
        widget.index,
        mode,
        foodName: food.text,
        quantity: double.tryParse(
          latinDigits(amount.text).replaceAll('٫', '.'),
        ),
        unit: unit.text,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'ثبت انجام نشد؛ اطلاعات قبلی حفظ شد. دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final meal = widget.store.mealsOn(widget.date)[widget.index];
    return SafeArea(
      child: Padding(
        padding: EdgeInsets.fromLTRB(
          20,
          0,
          20,
          20 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: SingleChildScrollView(
          child: Form(
            key: form,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'ثبت ${meal.name}',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                Text(meal.title),
                const SizedBox(height: 12),
                const Text(
                  'این نسخه نمایشی است؛ ذخیره روی همین دستگاه انجام می‌شود.',
                  style: TextStyle(color: muted, fontSize: 11),
                ),
                const SizedBox(height: 12),
                for (final choice in mealLogLabels.entries)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 6),
                    child: OutlinedButton(
                      style: OutlinedButton.styleFrom(
                        backgroundColor: mode == choice.key
                            ? sage
                            : Colors.white,
                      ),
                      onPressed: busy
                          ? null
                          : () => setState(() {
                              mode = choice.key;
                              error = null;
                            }),
                      child: Row(
                        children: [
                          Icon(
                            mode == choice.key
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(child: Text(choice.value)),
                        ],
                      ),
                    ),
                  ),
                if (mode == 'according')
                  Text(meal.amount, style: const TextStyle(height: 1.8)),
                if (mode == 'different')
                  TextFormField(
                    controller: food,
                    maxLength: 120,
                    decoration: const InputDecoration(
                      labelText: 'نام غذای مصرف‌شده',
                    ),
                    enabled: !busy,
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'نام غذا را بنویس.' : null,
                  ),
                if (mode == 'different' || mode == 'adjusted') ...[
                  TextFormField(
                    controller: amount,
                    keyboardType: const TextInputType.numberWithOptions(
                      decimal: true,
                    ),
                    decoration: const InputDecoration(
                      labelText: 'مقدار واقعی مصرف‌شده',
                    ),
                    enabled: !busy,
                    validator: (v) {
                      final n = double.tryParse(
                        latinDigits(v ?? '').replaceAll('٫', '.'),
                      );
                      return n == null || !n.isFinite || n <= 0 || n > 100000
                          ? 'مقدار مثبت و معتبر وارد کن.'
                          : null;
                    },
                  ),
                  const SizedBox(height: 12),
                  TextFormField(
                    controller: unit,
                    maxLength: 40,
                    decoration: const InputDecoration(
                      labelText: 'واحد (مثلاً گرم، لیوان یا عدد)',
                    ),
                    enabled: !busy,
                    validator: (v) =>
                        (v ?? '').trim().isEmpty ? 'واحد را مشخص کن.' : null,
                  ),
                  const Notice(
                    'کالری این ثبت تا دریافت اطلاعات معتبر محاسبه نمی‌شود. مقدار غذای متفاوت را صفر در نظر نمی‌گیریم.',
                  ),
                ],
                if (mode == 'skipped')
                  const Notice(
                    'این وعده به‌عنوان مصرف‌نشده ثبت می‌شود؛ با وعده‌ای که هنوز ثبت نشده متفاوت است.',
                  ),
                if (error != null)
                  Text(error!, style: const TextStyle(color: Colors.red)),
                const SizedBox(height: 16),
                PrimaryButton(
                  busy ? 'در حال ذخیره…' : 'ذخیره ثبت وعده',
                  onPressed: busy ? null : save,
                  icon: Icons.check,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
