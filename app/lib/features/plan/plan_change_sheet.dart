import 'dart:convert';

import 'package:flutter/material.dart';

import '../../core/icons/diet_icon.dart';
import '../../core/motion/motion_kit.dart';
import '../../core/theme/theme.dart';
import '../../data/customer_auth.dart';
import '../../data/demo_store.dart';
import '../../domain/common/day.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../../presentation/widgets/ui.dart' show showToast;
import 'data/plan_change_repository.dart';

Future<void> showPlanChange(BuildContext context) async {
  final store = DemoScope.of(context);
  final route = ModalBottomSheetRoute<bool>(
    isScrollControlled: true,
    isDismissible: false,
    enableDrag: false,
    backgroundColor: Colors.transparent,
    constraints: const BoxConstraints(maxWidth: 640),
    builder: (_) => PlanChangeSheet(store: store),
  );
  final submitted = await Navigator.of(context).push<bool>(route);
  if (submitted == true && context.mounted) {
    showToast(
      context,
      store.serverAuthEnabled
          ? 'درخواست تغییر برای متخصص ارسال شد.'
          : 'درخواست شما در نسخهٔ نمایشی ثبت شد.',
    );
  }
}

class PlanChangeSheet extends StatefulWidget {
  const PlanChangeSheet({super.key, required this.store});
  final DemoStore store;

  @override
  State<PlanChangeSheet> createState() => _PlanChangeSheetState();
}

class _PlanChangeSheetState extends State<PlanChangeSheet> {
  final _details = TextEditingController();
  final _scroll = ScrollController();
  final _errorKey = GlobalKey();
  final _selected = <String>{};
  PlanChangeData? _data;
  String? _loadError, _submitError, _commandId, _fingerprint;
  bool _loading = true, _busy = false, _refreshNeeded = false;
  int _day = 0;
  int _generation = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _generation++;
    _details.dispose();
    _scroll.dispose();
    super.dispose();
  }

  String _message(Object error, String fallback) => switch (error) {
    AuthFailure e => e.message,
    StateError e => e.message,
    _ => fallback,
  };

  Future<void> _load() async {
    if (_busy) return;
    final generation = ++_generation;
    setState(() {
      _loading = true;
      _loadError = null;
      _submitError = null;
      _refreshNeeded = false;
    });
    try {
      final store = widget.store;
      final PlanChangeData data;
      if (store.serverAuthEnabled) {
        data = await PlanChangeRepository(store.customerAuth!).load();
      } else {
        if (!store.hasUserRequest || !store.userRequest.isPublished) {
          throw StateError('ابتدا باید برنامهٔ تأییدشده داشته باشی.');
        }
        final start = store.userRequest.programWeek ?? startOfWeek(store.today);
        data = PlanChangeData(
          versionId: store.userRequest.id,
          reasons: [
            for (final label in store.messaging.reasons)
              PlanChangeReason(label, label),
          ],
          days: [
            for (var i = 0; i < 7; i++)
              PlanChangeDay(persianDate(start.add(Duration(days: i))), [
                for (final meal in store.userRequest.mealsForDay(i))
                  PlanChangeMeal(
                    '${meal.name} · ${meal.title}',
                    meal.amount,
                    meal.instructions,
                  ),
              ]),
          ],
        );
      }
      if (!mounted || generation != _generation) return;
      setState(() {
        _data = data;
        _selected.removeWhere((id) => !data.reasons.any((r) => r.id == id));
        _day = 0;
      });
    } catch (error) {
      if (mounted && generation == _generation) {
        setState(
          () => _loadError = _message(
            error,
            'دریافت برنامه و دلایل انجام نشد. دوباره تلاش کن.',
          ),
        );
      }
    } finally {
      if (mounted && generation == _generation) {
        setState(() => _loading = false);
      }
    }
  }

  void _showError(String message) {
    setState(() => _submitError = message);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = _errorKey.currentContext;
      if (mounted && target != null) {
        Scrollable.ensureVisible(
          target,
          duration: Motion.of(context, Motion.quick),
          alignment: 1,
        );
      }
    });
  }

  Future<void> _submit() async {
    if (_busy || _loading || _loadError != null || _data == null) return;
    if (_selected.isEmpty) {
      _showError('حداقل یک دلیل برای تغییر برنامه انتخاب کن.');
      return;
    }
    if (_selected.length > 8) {
      _showError('حداکثر ۸ دلیل انتخاب کن.');
      return;
    }
    final explanation = _details.text.trim();
    if (explanation.runes.length > 2000) {
      _showError('توضیحات باید حداکثر ۲۰۰۰ کاراکتر باشد.');
      return;
    }
    final data = _data!;
    final ids = _selected.toList()..sort();
    final fingerprint = jsonEncode([data.versionId, ids, explanation]);
    // An uncertain network result can be retried without creating a duplicate.
    if (_fingerprint != fingerprint) {
      _fingerprint = fingerprint;
      _commandId = newPlanChangeCommandId();
    }
    setState(() {
      _busy = true;
      _submitError = null;
    });
    FocusScope.of(context).unfocus();
    try {
      final store = widget.store;
      final labels = [
        for (final reason in data.reasons)
          if (_selected.contains(reason.id)) reason.label,
      ];
      if (store.serverAuthEnabled) {
        await PlanChangeRepository(store.customerAuth!).submit(
          commandId: _commandId!,
          versionId: data.versionId,
          reasonIds: ids,
          explanation: explanation,
        );
      } else {
        store.messaging.submit(data.versionId, labels, explanation);
      }
      if (!mounted) return;
      store.requestRevision(labels.join('، '), explanation);
      Haptics.confirm();
      Navigator.of(context).pop(true);
    } catch (error) {
      if (mounted) {
        _refreshNeeded =
            error is AuthFailure &&
            ['plan_changed', 'week_closed', 'validation'].contains(error.code);
        _showError(
          _message(error, 'ارسال تأیید نشد. با همین اطلاعات دوباره تلاش کن.'),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final available =
        (media.size.height - media.viewInsets.bottom - media.padding.top - 16)
            .clamp(0.0, double.infinity);
    final data = _data;
    return PopScope(
      canPop: !_busy,
      child: Padding(
        padding: EdgeInsets.only(bottom: media.viewInsets.bottom),
        child: SafeArea(
          top: false,
          child: ConstrainedBox(
            constraints: BoxConstraints(maxHeight: available * .96),
            child: Material(
              key: const ValueKey('plan-change-sheet'),
              color: AppColors.surface,
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(28),
              ),
              clipBehavior: Clip.antiAlias,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Flexible(
                    fit: FlexFit.loose,
                    child: SingleChildScrollView(
                      controller: _scroll,
                      keyboardDismissBehavior:
                          ScrollViewKeyboardDismissBehavior.onDrag,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          _header(),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                if (_loading)
                                  const Padding(
                                    padding: EdgeInsets.all(24),
                                    child: Center(
                                      child: CircularProgressIndicator(),
                                    ),
                                  )
                                else if (_loadError != null)
                                  _retry(_loadError!)
                                else if (data != null) ...[
                                  _preview(data),
                                  const SizedBox(height: 20),
                                  Row(
                                    children: [
                                      const Expanded(
                                        child: Text(
                                          'چه چیزی را تغییر بدهیم؟',
                                          style: AppTypography.cardTitle,
                                        ),
                                      ),
                                      if (_selected.isNotEmpty)
                                        Text(
                                          '${fa(_selected.length)} انتخاب',
                                          style: AppTypography.supporting
                                              .copyWith(
                                                color: AppColors.emeraldDeep,
                                              ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(height: 3),
                                  const Text(
                                    'یک یا چند دلیل انتخاب کن.',
                                    style: AppTypography.supporting,
                                  ),
                                  const SizedBox(height: 10),
                                  if (data.reasons.isEmpty)
                                    _retry(
                                      'فعلاً دلیلی برای انتخاب موجود نیست. دوباره دریافت کن.',
                                    )
                                  else
                                    LayoutBuilder(
                                      builder: (context, constraints) {
                                        final wideText =
                                            MediaQuery.textScalerOf(
                                              context,
                                            ).scale(12) >
                                            15;
                                        final columns =
                                            constraints.maxWidth < 270 ||
                                                wideText
                                            ? 1
                                            : 2;
                                        return Wrap(
                                          spacing: 8,
                                          runSpacing: 8,
                                          children: [
                                            for (final reason in data.reasons)
                                              SizedBox(
                                                width:
                                                    (constraints.maxWidth -
                                                        (columns - 1) * 8) /
                                                    columns,
                                                child: _ReasonOption(
                                                  reason: reason,
                                                  selected: _selected.contains(
                                                    reason.id,
                                                  ),
                                                  onPressed:
                                                      _busy ||
                                                          (_selected.length >=
                                                                  8 &&
                                                              !_selected
                                                                  .contains(
                                                                    reason.id,
                                                                  ))
                                                      ? null
                                                      : () => setState(() {
                                                          _selected.contains(
                                                                reason.id,
                                                              )
                                                              ? _selected
                                                                    .remove(
                                                                      reason.id,
                                                                    )
                                                              : _selected.add(
                                                                  reason.id,
                                                                );
                                                          _submitError = null;
                                                        }),
                                                ),
                                              ),
                                          ],
                                        );
                                      },
                                    ),
                                  const SizedBox(height: 20),
                                  const Text(
                                    'توضیحات بیشتر',
                                    style: AppTypography.cardTitle,
                                  ),
                                  const SizedBox(height: 3),
                                  const Text(
                                    'اختیاری؛ اگر نکته‌ای هست برای متخصص بنویس.',
                                    style: AppTypography.supporting,
                                  ),
                                  const SizedBox(height: 8),
                                  Semantics(
                                    label: 'توضیحات بیشتر، اختیاری',
                                    child: TextField(
                                      key: const ValueKey(
                                        'plan-change-details',
                                      ),
                                      controller: _details,
                                      readOnly: _busy,
                                      minLines: 3,
                                      maxLines: 5,
                                      maxLength: 2000,
                                      buildCounter:
                                          (
                                            context, {
                                            required currentLength,
                                            required isFocused,
                                            maxLength,
                                          }) => Text(
                                            '${fa(currentLength)}/${fa(maxLength ?? 2000)}',
                                            textDirection: TextDirection.ltr,
                                            style: AppTypography.supporting,
                                          ),
                                      textInputAction: TextInputAction.newline,
                                      decoration: const InputDecoration(
                                        hintText:
                                            'مثلاً برای آماده‌کردن ناهار وقت کمتری دارم…',
                                        filled: true,
                                        fillColor: Color(0xFFF7FAF7),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 6),
                                  const Row(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Icon(
                                        Icons.verified_user_outlined,
                                        size: 18,
                                        color: AppColors.emeraldDeep,
                                      ),
                                      SizedBox(width: 7),
                                      Expanded(
                                        child: Text(
                                          'تا تأیید نسخهٔ جدید، برنامهٔ فعلی‌ات فعال می‌ماند.',
                                          style: AppTypography.supporting,
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
                                if (_submitError != null) ...[
                                  const SizedBox(height: 12),
                                  Semantics(
                                    key: _errorKey,
                                    liveRegion: true,
                                    child: Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        color: AppColors.dangerSurface,
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                      child: Text(
                                        _submitError!,
                                        style: AppTypography.supporting
                                            .copyWith(color: AppColors.danger),
                                      ),
                                    ),
                                  ),
                                  if (_refreshNeeded)
                                    TextButton.icon(
                                      key: const ValueKey(
                                        'plan-change-refresh',
                                      ),
                                      onPressed: _busy ? null : _load,
                                      icon: const Icon(Icons.refresh_rounded),
                                      label: const Text(
                                        'به‌روزرسانی برنامه و دلایل',
                                      ),
                                    ),
                                ],
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.fromLTRB(20, 12, 20, 8),
                    decoration: const BoxDecoration(
                      border: Border(top: BorderSide(color: AppColors.line)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        PillButton(
                          key: const ValueKey('plan-change-submit'),
                          label: 'ارسال درخواست',
                          trailingIcon: Icons.arrow_back_rounded,
                          height: 48,
                          loading: _busy,
                          onPressed:
                              _loading ||
                                  _loadError != null ||
                                  data == null ||
                                  data.reasons.isEmpty
                              ? null
                              : _submit,
                        ),
                        TextButton(
                          onPressed: _busy
                              ? null
                              : () => Navigator.pop(context),
                          child: const Text('انصراف'),
                        ),
                      ],
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

  Widget _header() => Container(
    padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
    decoration: const BoxDecoration(
      gradient: LinearGradient(colors: [Color(0xFFF2F8EA), Color(0xFFE2F4E8)]),
    ),
    child: Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          padding: const EdgeInsets.all(9),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: .75),
            borderRadius: BorderRadius.circular(16),
          ),
          child: const DietIcon(DietIconKind.plan, size: 26),
        ),
        const SizedBox(width: 10),
        const Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'برنامه‌ات را بهتر کنیم',
                style: TextStyle(
                  fontSize: 19,
                  height: 1.5,
                  fontWeight: FontWeight.bold,
                  color: AppColors.emeraldDark,
                ),
              ),
              SizedBox(height: 3),
              Text(
                'درخواستت برای بررسی به متخصص می‌رسد.',
                style: AppTypography.supporting,
              ),
            ],
          ),
        ),
        IconButton(
          key: const ValueKey('plan-change-close'),
          tooltip: 'بستن درخواست تغییر',
          onPressed: _busy ? null : () => Navigator.pop(context),
          icon: const Icon(Icons.close_rounded, size: 22),
        ),
      ],
    ),
  );

  Widget _retry(String message) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Semantics(
        liveRegion: true,
        child: Text(
          message,
          style: AppTypography.supporting.copyWith(color: AppColors.inkSoft),
        ),
      ),
      TextButton.icon(
        key: const ValueKey('plan-change-retry'),
        onPressed: _busy ? null : _load,
        icon: const Icon(Icons.refresh_rounded),
        label: const Text('تلاش دوباره'),
      ),
    ],
  );

  Widget _preview(PlanChangeData data) => AppCard(
    padding: EdgeInsets.zero,
    radius: 18,
    shadows: const [],
    color: const Color(0xFFF7FAF7),
    border: Border.all(color: AppColors.selectedLine),
    child: Theme(
      data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        key: const ValueKey('plan-change-preview'),
        leading: const DietIcon(DietIconKind.meal, size: 26),
        title: const Text('برنامهٔ فعلی', style: AppTypography.quantity),
        subtitle: Text(
          '${fa(data.days.length)} روز · نسخهٔ فعال',
          style: AppTypography.supporting,
        ),
        childrenPadding: const EdgeInsets.fromLTRB(12, 0, 12, 12),
        children: [
          if (data.days.isEmpty)
            const Text(
              'وعده‌ای برای نمایش وجود ندارد.',
              style: AppTypography.supporting,
            )
          else ...[
            SizedBox(
              height: 44,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: data.days.length,
                separatorBuilder: (_, _) => const SizedBox(width: 6),
                itemBuilder: (_, i) => ChoiceChip(
                  key: ValueKey('plan-change-day-$i'),
                  selected: _day == i,
                  label: Text(
                    data.days[i].label.split('،').first,
                    style: const TextStyle(fontSize: 11),
                  ),
                  onSelected: _busy ? null : (_) => setState(() => _day = i),
                ),
              ),
            ),
            const SizedBox(height: 8),
            for (final meal in data.days[_day].meals)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 5),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      meal.title,
                      style: const TextStyle(
                        fontSize: 13,
                        height: 1.6,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    if (meal.amount.isNotEmpty)
                      Text(meal.amount, style: AppTypography.supporting),
                    if (meal.instructions.isNotEmpty)
                      Text(meal.instructions, style: AppTypography.supporting),
                  ],
                ),
              ),
          ],
        ],
      ),
    ),
  );
}

class _ReasonOption extends StatelessWidget {
  const _ReasonOption({
    required this.reason,
    required this.selected,
    required this.onPressed,
  });
  final PlanChangeReason reason;
  final bool selected;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    child: OutlinedButton(
      key: ValueKey('plan-change-reason-${reason.id}'),
      onPressed: onPressed,
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(0, 52),
        padding: const EdgeInsets.all(10),
        backgroundColor: selected ? AppColors.mint : AppColors.surface,
        side: BorderSide(color: selected ? AppColors.emerald : AppColors.line),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Row(
        children: [
          ExcludeSemantics(
            child: Icon(
              selected ? Icons.check_circle_rounded : Icons.circle_outlined,
              size: 20,
              color: selected ? AppColors.emeraldDeep : AppColors.faint,
            ),
          ),
          const SizedBox(width: 7),
          Expanded(
            child: Text(
              reason.label,
              style: const TextStyle(
                fontSize: 12,
                height: 1.5,
                fontWeight: FontWeight.normal,
                color: AppColors.ink,
              ),
            ),
          ),
        ],
      ),
    ),
  );
}
