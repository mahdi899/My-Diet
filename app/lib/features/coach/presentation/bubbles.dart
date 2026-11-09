import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';

class CoachTextBubble extends StatelessWidget {
  const CoachTextBubble({
    super.key,
    required this.text,
    required this.isUser,
    this.pending = false,
    this.failed = false,
  });

  final String text;
  final bool isUser;
  final bool pending;
  final bool failed;

  @override
  Widget build(BuildContext context) {
    const radius = Radius.circular(22);
    const tail = Radius.circular(6);
    return Align(
      alignment: isUser
          ? AlignmentDirectional.centerEnd
          : AlignmentDirectional.centerStart,
      child: ConstrainedBox(
        constraints: BoxConstraints(
          maxWidth: MediaQuery.sizeOf(context).width * 0.82,
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: isUser ? AppGradients.cta : null,
            color: isUser ? null : AppColors.surface,
            borderRadius: BorderRadiusDirectional.only(
              topStart: radius,
              topEnd: radius,
              bottomStart: isUser ? radius : tail,
              bottomEnd: isUser ? tail : radius,
            ),
            boxShadow: isUser ? AppShadows.cta : AppShadows.soft,
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            child: Text(
              text,
              style: TextStyle(
                color: isUser ? Colors.white : AppColors.ink,
                fontSize: 15,
                height: 1.75,
                fontWeight: isUser ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

int _bubbleCache(BuildContext context, double logical) {
  final dpr = MediaQuery.devicePixelRatioOf(context);
  return (logical * dpr).ceil().clamp(64, 720);
}

class CoachPhotoBubble extends StatelessWidget {
  const CoachPhotoBubble({super.key, this.bytes, this.caption = 'عکس وعده'});

  final Uint8List? bytes;
  final String caption;

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerEnd,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: SizedBox(
          width: 220,
          height: 160,
          child: bytes == null
              ? const ColoredBox(
                  color: AppColors.mint,
                  child: Icon(
                    Icons.image_rounded,
                    color: AppColors.emeraldDeep,
                    size: 36,
                  ),
                )
              : Image.memory(
                  bytes!,
                  fit: BoxFit.cover,
                  gaplessPlayback: true,
                  cacheWidth: _bubbleCache(context, 220),
                  cacheHeight: _bubbleCache(context, 160),
                ),
        ),
      ),
    );
  }
}

class CoachSystemNote extends StatelessWidget {
  const CoachSystemNote({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: AppColors.bgDeep,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Text(
          text,
          style: const TextStyle(
            color: AppColors.muted,
            fontSize: 12,
            height: 1.6,
          ),
        ),
      ),
    );
  }
}

class TypingDots extends StatefulWidget {
  const TypingDots({super.key});

  @override
  State<TypingDots> createState() => _TypingDotsState();
}

class _TypingDotsState extends State<TypingDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 900),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (reduced) {
      _controller.stop();
    } else if (!_controller.isAnimating) {
      _controller.repeat();
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: AlignmentDirectional.centerStart,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.soft,
        ),
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) => Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < 3; i++)
                Container(
                  width: 7,
                  height: 7,
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppColors.emerald.withValues(
                      alpha:
                          0.35 +
                          0.65 *
                              (((_controller.value + i / 3) % 1) > 0.5
                                  ? 1
                                  : 0.4),
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
