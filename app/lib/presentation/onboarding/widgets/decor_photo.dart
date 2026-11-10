import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/photos/photos.dart';
import '../../../core/theme/tokens.dart';

/// Decorative photo for an option. Keyed by [id] or [label].
/// Never required for meaning: a soft tile shows if the library is missing.
class DecorPhoto extends StatefulWidget {
  const DecorPhoto({
    super.key,
    required this.label,
    this.id,
    this.lifestyle = false,
    this.expert = false,
    this.icon,
    this.radius = 18,
    this.width,
    this.height,
  });

  final String label;
  final String? id;

  /// Prefer a lifestyle shot (activity, sleep) over a plate of food.
  final bool lifestyle;

  /// Prefer a portrait from the expert set.
  final bool expert;
  final IconData? icon;
  final double radius;
  final double? width, height;

  @override
  State<DecorPhoto> createState() => _DecorPhotoState();
}

class _DecorPhotoState extends State<DecorPhoto> {
  PhotoEntry? _photo;

  @override
  void initState() {
    super.initState();
    final ready = FoodPhotoResolver.instance;
    if (ready != null) {
      _photo = _pick(ready);
    } else {
      FoodPhotoResolver.load().then((resolver) {
        if (!mounted) return;
        setState(() => _photo = _pick(resolver));
      }, onError: (Object _, StackTrace _) {});
    }
  }

  @override
  void didUpdateWidget(DecorPhoto oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.label != widget.label ||
        oldWidget.id != widget.id ||
        oldWidget.lifestyle != widget.lifestyle ||
        oldWidget.expert != widget.expert) {
      final ready = FoodPhotoResolver.instance;
      _photo = ready == null ? null : _pick(ready);
    }
  }

  bool get _lifestyle =>
      widget.lifestyle || looksLikeLifestyle(widget.id ?? '', widget.label);

  PhotoEntry? _pick(FoodPhotoResolver resolver) {
    try {
      if (resolver.manifest.items.isEmpty) return null;
      final seed = (widget.id ?? widget.label).trim();
      if (widget.expert) {
        final portraits = resolver.manifest.ofKind('expert');
        if (portraits.isNotEmpty) return resolver.expert(seed);
      }
      if (_lifestyle) {
        final life = resolver.manifest.ofKind('lifestyle');
        if (life.isNotEmpty) return resolver.lifestyle(seed);
      }
      final title = widget.label.trim().isEmpty ? seed : widget.label.trim();
      if (title.isEmpty) return resolver.manifest.items.first;
      return resolver.resolve(title: title);
    } catch (_) {
      return null;
    }
  }

  @override
  Widget build(BuildContext context) {
    final photo = _photo;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final logical = widget.width ?? widget.height ?? 96;
    final cache = (logical * dpr).ceil().clamp(48, 420);
    final image = photo == null
        ? _fallback()
        : Image.asset(
            photo.thumb,
            fit: BoxFit.cover,
            cacheWidth: cache,
            gaplessPlayback: true,
            excludeFromSemantics: true,
            filterQuality: FilterQuality.low,
            errorBuilder: (_, _, _) => _fallback(),
          );
    final framed = ClipRRect(
      borderRadius: BorderRadius.circular(widget.radius),
      child: image,
    );
    if (widget.width == null && widget.height == null) {
      return SizedBox.expand(child: framed);
    }
    return SizedBox(width: widget.width, height: widget.height, child: framed);
  }

  Widget _fallback() => DecoratedBox(
    decoration: const BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topRight,
        end: Alignment.bottomLeft,
        colors: [AppColors.mint, Color(0xFFD7F0C8)],
      ),
    ),
    child: Center(
      child: Icon(
        widget.icon ?? Icons.spa_rounded,
        color: AppColors.emeraldDeep,
        size: (widget.width ?? 56) * 0.38,
      ),
    ),
  );
}

/// Activity / sleep / movement labels, so we don't decorate them with a meal.
bool looksLikeLifestyle(String id, String label) {
  final s = '$id $label'.toLowerCase();
  const keys = [
    'نشسته',
    'فعالیت',
    'ورزش',
    'خواب',
    'پیاده',
    'شیفت',
    'باردار',
    'activity',
    'sleep',
    'walk',
    'exercise',
    'lifestyle',
    'pregnancy',
  ];
  return keys.any(s.contains);
}

/// Overlapping food tiles for the intro. Static: no looping motion.
class PhotoCollage extends StatelessWidget {
  const PhotoCollage({super.key, this.compact = false});
  final bool compact;

  static const _seeds = ['صبحانه', 'ناهار', 'سالاد', 'کباب'];
  static const _offsets = [
    Offset(-62, -18),
    Offset(58, -28),
    Offset(-48, 62),
    Offset(64, 54),
  ];
  static const _turns = [-0.08, 0.07, 0.05, -0.06];

  @override
  Widget build(BuildContext context) {
    final tile = compact ? 86.0 : 108.0;
    return SizedBox(
      height: compact ? 200 : 240,
      child: Stack(
        alignment: Alignment.center,
        children: [
          for (var i = 0; i < _seeds.length; i++)
            Transform.translate(
              offset: _offsets[i] * (compact ? 0.86 : 1),
              child: Transform.rotate(
                angle: _turns[i],
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: AppShadows.soft,
                  ),
                  child: DecorPhoto(
                    label: _seeds[i],
                    width: tile,
                    height: tile,
                    radius: 20,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// Option row: photo is decoration, the label is the answer.
class PhotoOptionCard extends StatelessWidget {
  const PhotoOptionCard({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
    this.subtitle,
    this.photoKey,
    this.icon,
    this.compact = false,
    this.multi = false,
  });

  final String label;
  final String? subtitle;
  final String? photoKey;
  final bool selected;
  final bool compact;
  final bool multi;
  final IconData? icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    final size = compact ? 44.0 : 56.0;
    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: _Press(
        onTap: onTap,
        child: AnimatedContainer(
          duration: reduce ? Duration.zero : const Duration(milliseconds: 180),
          padding: EdgeInsets.symmetric(
            horizontal: compact ? 10 : 12,
            vertical: compact ? 8 : 10,
          ),
          decoration: BoxDecoration(
            color: selected ? AppColors.mint : AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
              color: selected ? AppColors.emerald : AppColors.line,
              width: selected ? 1.8 : 1,
            ),
            boxShadow: selected ? AppShadows.soft : const <BoxShadow>[],
          ),
          child: Row(
            children: [
              DecorPhoto(
                label: label,
                id: photoKey,
                icon: icon,
                width: size,
                height: size,
                radius: 16,
              ),
              SizedBox(width: compact ? 10 : 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      label,
                      style: TextStyle(
                        fontSize: compact ? 13.5 : 15,
                        fontWeight: FontWeight.w700,
                        color: AppColors.ink,
                        height: 1.5,
                      ),
                    ),
                    if (subtitle != null && subtitle!.isNotEmpty)
                      Text(
                        subtitle!,
                        style: const TextStyle(
                          color: AppColors.muted,
                          fontSize: 12,
                          height: 1.6,
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: reduce
                    ? Duration.zero
                    : const Duration(milliseconds: 180),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: multi ? BoxShape.rectangle : BoxShape.circle,
                  borderRadius: multi ? BorderRadius.circular(7) : null,
                  color: selected ? AppColors.emerald : Colors.transparent,
                  border: Border.all(
                    color: selected ? AppColors.emerald : AppColors.faint,
                    width: 1.6,
                  ),
                ),
                child: Icon(
                  Icons.check_rounded,
                  size: 16,
                  color: selected ? Colors.white : Colors.transparent,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Press extends StatefulWidget {
  const _Press({required this.child, required this.onTap});
  final Widget child;
  final VoidCallback onTap;

  @override
  State<_Press> createState() => _PressState();
}

class _PressState extends State<_Press> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    final reduce = MediaQuery.disableAnimationsOf(context);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTapDown: (_) {
        if (!reduce) setState(() => _down = true);
      },
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      onTap: () {
        Haptics.tap();
        widget.onTap();
      },
      child: AnimatedScale(
        scale: _down && !reduce ? 0.98 : 1,
        duration: const Duration(milliseconds: 120),
        curve: Curves.easeOutCubic,
        child: widget.child,
      ),
    );
  }
}
