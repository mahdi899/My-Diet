import 'package:flutter/material.dart';
import '../../core/theme/tokens.dart';
import '../../data/customer_auth.dart';
import 'data/meal_swap_repository.dart';

/// Shows AI-suggested swap alternatives from backend for server-mode.
/// Opens as a bottom sheet alongside the existing demo substitution sheet.
class AiSwapAlternativesSheet extends StatefulWidget {
  const AiSwapAlternativesSheet({
    super.key,
    required this.mealId,
    required this.mealTitle,
    required this.auth,
    this.onApplied,
  });

  final String mealId;
  final String mealTitle;
  final CustomerAuth auth;
  final VoidCallback? onApplied;

  @override
  State<AiSwapAlternativesSheet> createState() => _AiSwapAlternativesSheetState();
}

class _AiSwapAlternativesSheetState extends State<AiSwapAlternativesSheet> {
  late final MealSwapRepository _repo;
  SwapResult? _result;
  String? _error;
  bool _loading = true;
  String? _applying;
  String _reason = 'variety';

  static const _reasons = {
    'variety': 'تنوع',
    'dislike': 'دوست ندارم',
    'unavailable': 'در دسترس نیست',
    'budget': 'گرون است',
    'time': 'وقت ندارم',
  };

  @override
  void initState() {
    super.initState();
    _repo = MealSwapRepository(auth: widget.auth);
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final result = await _repo.getAlternatives(
        mealId: widget.mealId,
        reason: _reason,
        budgetOk: _reason == 'budget',
      );
      if (mounted) setState(() { _result = result; _loading = false; });
    } on MealSwapException catch (e) {
      if (mounted) setState(() { _error = e.message; _loading = false; });
    } catch (_) {
      if (mounted) {
        setState(() {
          _error = 'گرفتن پیشنهادها انجام نشد. اینترنت رو چک کن.';
          _loading = false;
        });
      }
    }
  }

  Future<void> _apply(SwapAlternative alt) async {
    if (_applying != null) return;
    setState(() => _applying = alt.slug);
    try {
      await _repo.applySwap(
        mealId: widget.mealId,
        foodSlug: alt.slug,
        reason: _reason,
      );
      if (!mounted) return;
      Navigator.pop(context, true);
      widget.onApplied?.call();
    } on MealSwapException catch (e) {
      if (mounted) {
        setState(() => _applying = null);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (_) {
      if (mounted) {
        setState(() => _applying = null);
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('اعمال تعویض انجام نشد.')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.viewInsetsOf(context).bottom),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'جایگزین هوشمند',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        Text(
                          widget.mealTitle,
                          style: const TextStyle(color: AppColors.muted),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.close),
                  ),
                ],
              ),
            ),
            // Reason chips
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: _reasons.entries.map((e) => Padding(
                    padding: const EdgeInsets.only(left: 8),
                    child: ChoiceChip(
                      label: Text(e.value),
                      selected: _reason == e.key,
                      onSelected: (_) {
                        setState(() => _reason = e.key);
                        _load();
                      },
                    ),
                  )).toList(),
                ),
              ),
            ),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 32),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_error != null)
              Padding(
                padding: const EdgeInsets.all(20),
                child: Column(children: [
                  Text(_error!, style: const TextStyle(color: Colors.red)),
                  const SizedBox(height: 8),
                  TextButton(onPressed: _load, child: const Text('تلاش مجدد')),
                ]),
              )
            else if (_result != null) ...[
              if (_result!.tooFewResults)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 20),
                  child: Text(
                    'گزینه‌های محدودی یافت شد.',
                    style: TextStyle(color: AppColors.muted, fontSize: 13),
                  ),
                ),
              if (_result!.alternatives.isEmpty)
                const Padding(
                  padding: EdgeInsets.all(20),
                  child: Text(
                    'جایگزین مناسبی یافت نشد.',
                    style: TextStyle(color: AppColors.muted),
                  ),
                )
              else
                ListView.separated(
                  shrinkWrap: true,
                  physics: const NeverScrollableScrollPhysics(),
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                  itemCount: _result!.alternatives.length,
                  separatorBuilder: (context, index) => const SizedBox(height: 8),
                  itemBuilder: (_, i) {
                    final alt = _result!.alternatives[i];
                    return Card(
                      margin: EdgeInsets.zero,
                      child: ListTile(
                        title: Text(alt.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text(
                          '${alt.kcal} کالری  •  پروتئین: ${alt.protein.toStringAsFixed(0)}g',
                          style: const TextStyle(fontSize: 12),
                        ),
                        trailing: _applying == alt.slug
                            ? const SizedBox(width: 24, height: 24, child: CircularProgressIndicator(strokeWidth: 2))
                            : FilledButton(
                                onPressed: () => _apply(alt),
                                child: const Text('انتخاب'),
                              ),
                      ),
                    );
                  },
                ),
            ],
          ],
        ),
      ),
    );
  }
}

/// Open the AI swap sheet from anywhere.
Future<bool?> openAiSwapSheet(BuildContext context, {
  required String mealId,
  required String mealTitle,
  required CustomerAuth auth,
  VoidCallback? onApplied,
}) {
  return showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
    ),
    builder: (ctx) => AiSwapAlternativesSheet(
      mealId: mealId,
      mealTitle: mealTitle,
      auth: auth,
      onApplied: onApplied,
    ),
  );
}
