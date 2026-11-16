import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/theme.dart';
import '../../domain/common/number_format.dart';
import '../../domain/common/day.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/pill_button.dart';

Future<void> showWeightSheet(BuildContext context) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    showDragHandle: true,
    backgroundColor: AppColors.surface,
    builder: (context) => const _WeightSheet(),
  );
}

class _WeightSheet extends StatefulWidget {
  const _WeightSheet();

  @override
  State<_WeightSheet> createState() => _WeightSheetState();
}

class _WeightSheetState extends State<_WeightSheet> {
  TextEditingController? _weight;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_weight != null) return;
    final current = DemoScope.of(context).latestWeight;
    _weight = TextEditingController(text: persianNumber(current));
  }

  @override
  void dispose() {
    _weight?.dispose();
    super.dispose();
  }

  void _save() {
    final field = _weight;
    if (field == null) return;
    final store = DemoScope.of(context);
    final raw = latinDigits(
      field.text,
    ).replaceAll(',', '').replaceAll('٬', '').trim();
    final value = double.tryParse(raw);
    if (value == null || value <= 0 || value > 500) {
      setState(() => _error = 'یک وزن واقعی بنویس');
      return;
    }
    store.addWeight(value);
    Haptics.success();
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final bottom = MediaQuery.viewInsetsOf(context).bottom;
    final field = _weight;
    return SingleChildScrollView(
      child: Padding(
        padding: EdgeInsets.fromLTRB(20, 4, 20, bottom + 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('ثبت وزن', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: AppSpacing.xs),
            Text(
              persianDate(DemoScope.of(context).today),
              style: AppTypography.supporting,
            ),
            const SizedBox(height: AppSpacing.xl),
            if (field != null)
              TextField(
                controller: field,
                autofocus: true,
                textDirection: TextDirection.ltr,
                textAlign: TextAlign.center,
                style: AppTypography.number,
                keyboardType: const TextInputType.numberWithOptions(
                  decimal: true,
                ),
                decoration: InputDecoration(
                  labelText: 'وزن امروز',
                  suffixText: 'کیلوگرم',
                  suffixStyle: AppTypography.supporting,
                  errorText: _error,
                ),
                onChanged: (_) {
                  if (_error != null) setState(() => _error = null);
                },
                onSubmitted: (_) => _save(),
              ),
            const SizedBox(height: AppSpacing.md),
            const Text(
              'وزن را به کیلوگرم بنویس؛ مثلاً ۶۸٫۵',
              style: AppTypography.supporting,
            ),
            const SizedBox(height: AppSpacing.section),
            PillButton(label: 'ثبت', onPressed: field == null ? null : _save),
          ],
        ),
      ),
    );
  }
}
