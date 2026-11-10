import 'package:flutter/material.dart';

import '../../core/motion/motion.dart';
import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/widgets/kit/app_card.dart';

class PlanShoppingPage extends StatefulWidget {
  const PlanShoppingPage({super.key});

  @override
  State<PlanShoppingPage> createState() => _PlanShoppingPageState();
}

class _PlanShoppingPageState extends State<PlanShoppingPage> {
  String? _error;

  Future<void> _cycle(DemoStore store, ShoppingIngredient row) async {
    if (store.savingShopping) return;
    final mark = store.shoppingMark(row);
    final covered = mark != null && mark.quantity + 1e-9 >= row.quantity;
    final String? next;
    if (!covered) {
      next = 'have';
    } else if (mark.status == 'have') {
      next = 'purchased';
    } else {
      next = null;
    }
    Haptics.tick();
    try {
      await store.setShoppingMark(row, next);
      if (mounted) setState(() => _error = null);
    } catch (_) {
      if (mounted) setState(() => _error = 'ذخیره نشد');
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final data = store.shoppingList();
    final groups = <String, List<ShoppingIngredient>>{};
    for (final row in data.rows) {
      groups.putIfAbsent(row.ingredient.category, () => []).add(row);
    }
    return Scaffold(
      backgroundColor: AppColors.bg,
      appBar: AppBar(title: const Text('لیست خرید')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 28),
        children: [
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                _error!,
                style: const TextStyle(color: AppColors.danger),
              ),
            ),
          if (data.rows.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: Text(
                'چیزی برای خرید نیست',
                textAlign: TextAlign.center,
                style: TextStyle(color: AppColors.muted),
              ),
            ),
          for (final group in groups.entries) ...[
            Padding(
              padding: const EdgeInsets.only(top: 8, bottom: 8),
              child: Text(
                group.key.isEmpty ? 'سایر' : group.key,
                style: const TextStyle(
                  color: AppColors.emeraldDeep,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
            for (final row in group.value)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _ShoppingRow(
                  row: row,
                  mark: store.shoppingMark(row),
                  onTap: store.savingShopping ? null : () => _cycle(store, row),
                ),
              ),
          ],
          for (final missing in data.missing)
            Padding(
              padding: const EdgeInsets.only(top: 6),
              child: Text(
                '${missing.meal}: ${missing.description}',
                style: const TextStyle(color: AppColors.muted, fontSize: 12),
              ),
            ),
        ],
      ),
    );
  }
}

class _ShoppingRow extends StatelessWidget {
  const _ShoppingRow({
    required this.row,
    required this.mark,
    required this.onTap,
  });

  final ShoppingIngredient row;
  final ShoppingMark? mark;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final covered = mark != null && mark!.quantity + 1e-9 >= row.quantity;
    final bought = covered && mark!.status == 'purchased';
    final have = covered && mark!.status == 'have';
    return AppCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      child: Row(
        children: [
          Icon(
            bought
                ? Icons.check_circle_rounded
                : have
                ? Icons.home_rounded
                : Icons.circle_outlined,
            color: bought || have ? AppColors.emerald : AppColors.faint,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              row.ingredient.name,
              style: TextStyle(
                decoration: bought ? TextDecoration.lineThrough : null,
                color: bought ? AppColors.muted : AppColors.ink,
              ),
            ),
          ),
          Text(
            '${fa(shoppingQuantity(row.quantity))} ${row.ingredient.unit}',
            style: const TextStyle(color: AppColors.muted, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
