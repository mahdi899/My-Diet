import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/pill_button.dart';
import '../plan/goal_math.dart';

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
    _weight = TextEditingController(
      text: current.toStringAsFixed(fractionDigits(current)),
    );
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
    return Padding(
      padding: EdgeInsets.fromLTRB(20, 4, 20, bottom + 20),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('ثبت وزن', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          if (field != null)
            TextField(
              controller: field,
              autofocus: true,
              keyboardType: const TextInputType.numberWithOptions(
                decimal: true,
              ),
              decoration: const InputDecoration(
                labelText: 'کیلوگرم',
                suffixText: 'کیلو',
              ),
              onSubmitted: (_) => _save(),
            ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(
              _error!,
              style: const TextStyle(color: AppColors.danger, fontSize: 12),
            ),
          ],
          const SizedBox(height: 16),
          PillButton(label: 'ثبت', onPressed: field == null ? null : _save),
        ],
      ),
    );
  }
}
