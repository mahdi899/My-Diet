import '../../core/icons/diet_icon.dart';
import 'package:flutter/material.dart';
import '../../core/motion/motion_kit.dart';
import '../../core/theme/tokens.dart';
import '../../core/theme/typography.dart';
import '../../data/day.dart';
import '../../presentation/session/customer_scope.dart';
import '../../presentation/widgets/kit/kit.dart';

class WaterCard extends StatefulWidget {
  const WaterCard({super.key, required this.goal, this.log});
  final int goal;
  final WaterRepository? log;
  @override
  State<WaterCard> createState() => _WaterCardState();
}

class _WaterCardState extends State<WaterCard> {
  WaterRepository get _log => widget.log ?? CustomerScope.of(context).waterLog;
  String? _day;
  int _glasses = 0;
  int? _undoValue, _undoExpected;
  bool _loading = true, _busy = false, _loadFailed = false;
  String? _notice;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncDay();
  }

  @override
  void didUpdateWidget(WaterCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncDay();
  }

  void _syncDay() {
    final store = CustomerScope.of(context);
    final key = dateKey(store.today);
    if (_day != key) {
      _day = key;
      _loading = true;
      _notice = null;
      _undoValue = null;
      _glasses = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) => _load());
    } else if (!_busy) {
      final remote = store.waterGlassesOn(store.today);
      if (remote != null && remote != _glasses) {
        _glasses = remote;
        _undoValue = null;
      }
    }
  }

  Future<void> _load() async {
    if (!mounted) return;
    final store = CustomerScope.of(context);
    final date = store.today;
    if (_day != dateKey(date)) {
      _syncDay();
      setState(() {});
      return;
    }
    final owner = store.userRequestId;
    setState(() {
      _loading = true;
      _loadFailed = false;
    });
    try {
      final count = store.waterGlassesOn(date) ?? await _log.read(date);
      if (!mounted || _day != dateKey(date) || owner != store.userRequestId) {
        return;
      }
      setState(() {
        _glasses = count;
        _loading = false;
      });
      store.rememberWater(date, count);
    } catch (_) {
      if (mounted && _day == dateKey(date)) {
        setState(() {
          _loading = false;
          _loadFailed = true;
        });
      }
    }
  }

  Future<void> _save(int value, {bool undo = false}) async {
    if (_busy || _loading || _loadFailed) return;
    final store = CustomerScope.of(context);
    final date = store.today;
    if (_day != dateKey(date)) {
      _syncDay();
      setState(() {});
      return;
    }
    final owner = store.userRequestId;
    final previous = _glasses;
    final next = value.clamp(0, 20);
    if (next == previous) return;
    setState(() {
      _busy = true;
      _notice = null;
    });
    try {
      if (undo && await _log.read(date) != _undoExpected) {
        throw StateError('ثبت آب تغییر کرده است.');
      }
      await _log.write(date, next);
      if (!mounted || _day != dateKey(date) || owner != store.userRequestId) {
        return;
      }
      setState(() {
        _glasses = next;
        _undoValue = undo ? null : previous;
        _undoExpected = next;
        _notice = undo
            ? 'تغییر برگردانده شد.'
            : next > previous
            ? 'یک لیوان به آب امروزت اضافه شد.'
            : 'یک لیوان از ثبت امروز کم شد.';
      });
      store.rememberWater(date, next);
      Haptics.tick();
    } catch (_) {
      if (mounted) {
        setState(
          () => _notice = 'ذخیره نشد؛ تعداد قبلی حفظ شد. دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final disabled = _busy || _loading || _loadFailed;
    final count = Semantics(
      liveRegion: true,
      child: Text(
        _loading
            ? 'در حال خواندن ثبت‌ها…'
            : '${fa(_glasses)} از ${fa(widget.goal)} لیوان',
        key: const ValueKey('home-water'),
        style: const TextStyle(
          fontSize: 18,
          height: 1.3,
          fontWeight: FontWeight.bold,
          color: AppColors.ink,
        ),
      ),
    );
    final controls = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton.filledTonal(
          key: const ValueKey('water-add'),
          tooltip: 'ثبت یک لیوان آب',
          style: IconButton.styleFrom(
            backgroundColor: AppColors.mint,
            foregroundColor: AppColors.emeraldDeep,
            minimumSize: const Size.square(44),
          ),
          onPressed: disabled || _glasses >= 20
              ? null
              : () => _save(_glasses + 1),
          icon: _busy
              ? const SizedBox.square(
                  dimension: 18,
                  child: CircularProgressIndicator(strokeWidth: 2),
                )
              : const Icon(Icons.add_rounded, size: 22),
        ),
        const SizedBox(width: 4),
        IconButton.outlined(
          key: const ValueKey('water-remove'),
          tooltip: 'کم‌کردن یک لیوان از ثبت آب',
          style: IconButton.styleFrom(
            minimumSize: const Size.square(44),
            foregroundColor: AppColors.inkSoft,
            side: const BorderSide(color: AppColors.faint),
          ),
          onPressed: disabled || _glasses == 0
              ? null
              : () => _save(_glasses - 1),
          icon: const Icon(Icons.remove_rounded, size: 22),
        ),
      ],
    );
    final glasses = _WaterGlasses(
      key: ValueKey('water-glasses-$_day'),
      count: _glasses,
      goal: widget.goal,
    );
    return AppCard(
      key: const ValueKey('daily-water-card'),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
      radius: 22,
      shadows: const [],
      border: Border.all(color: AppColors.line),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Row(
            children: [
              ExcludeSemantics(child: DietIcon(DietIconKind.water, size: 20)),
              SizedBox(width: 6),
              Expanded(
                child: Text(
                  'آب امروز',
                  style: TextStyle(
                    fontSize: 14,
                    height: 1.4,
                    fontWeight: FontWeight.bold,
                    color: AppColors.emeraldDark,
                  ),
                ),
              ),
              Text('هدف روزانه', style: AppTypography.supporting),
            ],
          ),
          const Divider(height: 14, color: AppColors.line),
          LayoutBuilder(
            builder: (context, constraints) {
              final largeText = MediaQuery.textScalerOf(context).scale(18) > 21;
              // Keep the reference's horizontal layout on ordinary phones;
              // allow a second row for larger goals and accessibility text.
              if (constraints.maxWidth < 310 || largeText || widget.goal > 8) {
                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: count),
                        const SizedBox(width: 8),
                        controls,
                      ],
                    ),
                    const SizedBox(height: 6),
                    Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 300),
                        child: glasses,
                      ),
                    ),
                  ],
                );
              }
              return Row(
                children: [
                  Expanded(
                    flex: 4,
                    child: Align(
                      alignment: AlignmentDirectional.centerStart,
                      child: FittedBox(fit: BoxFit.scaleDown, child: count),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(flex: 5, child: glasses),
                  const SizedBox(width: 8),
                  Container(width: 1, height: 28, color: AppColors.line),
                  const SizedBox(width: 8),
                  controls,
                ],
              );
            },
          ),
          const Divider(height: 12, color: AppColors.line),
          if (_loadFailed)
            TextButton(
              onPressed: _load,
              child: const Text('ثبت‌های آب خوانده نشد؛ تلاش دوباره'),
            )
          else
            Row(
              children: [
                Expanded(
                  child: Semantics(
                    liveRegion: _notice != null,
                    child: Text(
                      _notice ??
                          (_glasses == 0
                              ? 'از اولین لیوان امروز شروع کنیم؟'
                              : 'هر لیوان، یک قدم مراقبت از خودت.'),
                      style: AppTypography.supporting.copyWith(
                        fontSize: 11,
                        height: 1.5,
                        color: AppColors.inkSoft,
                      ),
                    ),
                  ),
                ),
                if (_undoValue != null) ...[
                  const SizedBox(width: 8),
                  TextButton.icon(
                    key: const ValueKey('water-undo'),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      minimumSize: const Size(0, 40),
                      textStyle: const TextStyle(
                        fontFamily: AppTypography.fontFamily,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    onPressed: disabled
                        ? null
                        : () => _save(_undoValue!, undo: true),
                    icon: const Icon(Icons.undo_rounded, size: 16),
                    label: const Text('برگرداندن'),
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }
}

/// Animate the saved count so glasses fill in reading order on initial load,
/// then only the changed glass fills or empties on add, remove, and Undo.
class _WaterGlasses extends StatelessWidget {
  const _WaterGlasses({super.key, required this.count, required this.goal});

  final int count;
  final int goal;

  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: RepaintBoundary(
      child: TweenAnimationBuilder<double>(
        duration: Motion.of(context, Motion.slow),
        curve: Curves.easeOutCubic,
        tween: Tween(begin: 0, end: count.toDouble()),
        builder: (context, filled, _) => Row(
          children: [
            for (var i = 0; i < goal.clamp(1, 20); i++)
              Expanded(
                child: Align(
                  child: SizedBox(
                    width: 24,
                    height: 38,
                    child: CustomPaint(
                      key: ValueKey('water-glass-$i'),
                      painter: WaterGlassPainter((filled - i).clamp(0, 1)),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    ),
  );
}

/// A finite rise of the liquid, with no continuously running wave animation.
class WaterGlassPainter extends CustomPainter {
  const WaterGlassPainter(this.level);
  final double level;
  @override
  void paint(Canvas canvas, Size size) {
    canvas.save();
    canvas.scale(size.width / 76, size.height / 102);
    final glass = Path()
      ..moveTo(12, 12)
      ..lineTo(64, 12)
      ..lineTo(58, 87)
      ..quadraticBezierTo(38, 96, 18, 87)
      ..close();
    final paint = Paint()..isAntiAlias = true;
    canvas.drawPath(glass, paint..color = const Color(0xFFF0F8FC));
    canvas.save();
    canvas.clipPath(glass);
    if (level > 0) {
      final y = 89 - level * 69;
      canvas.drawPath(
        Path()
          ..moveTo(5, y)
          ..cubicTo(25, y - 6, 42, y + 6, 70, y)
          ..lineTo(70, 100)
          ..lineTo(5, 100)
          ..close(),
        paint..color = const Color(0xFFB8E2F5),
      );
      canvas.drawPath(
        Path()
          ..moveTo(5, y + 4)
          ..cubicTo(25, y + 10, 48, y - 3, 70, y + 4)
          ..lineTo(70, 100)
          ..lineTo(5, 100)
          ..close(),
        paint..color = AppColors.sky.withValues(alpha: .72),
      );
    }
    canvas.drawLine(
      const Offset(23, 24),
      const Offset(27, 74),
      paint
        ..color = const Color(0xC0FFFFFF)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );
    canvas.restore();
    canvas.drawPath(
      glass,
      paint
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..color = const Color(0xFF8BBBCF),
    );
    canvas.drawOval(
      const Rect.fromLTWH(12, 8, 52, 9),
      paint
        ..color = const Color(0xFF8BBBCF)
        ..strokeWidth = 2,
    );
    canvas.restore();
  }

  @override
  bool shouldRepaint(WaterGlassPainter oldDelegate) =>
      oldDelegate.level != level;
}
