import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';

enum JourneyArtKind { plan, payment }

class JourneyArt extends StatelessWidget {
  const JourneyArt({super.key, required this.kind, this.height = 190});
  final JourneyArtKind kind;
  final double height;
  @override
  Widget build(BuildContext context) => ExcludeSemantics(
    child: Image.asset(
      kind == JourneyArtKind.plan
          ? 'assets/images/journey/plan_review.png'
          : 'assets/images/journey/payment_issue.png',
      height: height,
      width: double.infinity,
      fit: BoxFit.contain,
      cacheWidth:
          (MediaQuery.sizeOf(context).width *
                  MediaQuery.devicePixelRatioOf(context))
              .ceil()
              .clamp(300, 900),
      errorBuilder: (_, _, _) => SizedBox(
        height: height,
        child: Icon(
          kind == JourneyArtKind.plan
              ? Icons.assignment_turned_in_outlined
              : Icons.receipt_long_outlined,
          size: 78,
          color: AppColors.emeraldDeep,
        ),
      ),
    ),
  );
}

class JourneyStatusView extends StatelessWidget {
  const JourneyStatusView({
    super.key,
    required this.title,
    required this.message,
    required this.badge,
    required this.current,
    this.error = false,
    this.busy = false,
    this.showPath = true,
    this.actionLabel,
    this.onAction,
    this.onSupport,
  });
  final String title, message, badge;
  final int current;
  final bool error, busy, showPath;
  final String? actionLabel;
  final VoidCallback? onAction, onSupport;
  @override
  Widget build(BuildContext context) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      const SizedBox(height: 10),
      Center(
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
          decoration: BoxDecoration(
            color: error
                ? AppColors.coral.withValues(alpha: .1)
                : AppColors.mint,
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                error ? Icons.info_outline_rounded : Icons.circle,
                size: error ? 15 : 8,
                color: error ? AppColors.danger : AppColors.emerald,
              ),
              const SizedBox(width: 7),
              Flexible(
                child: Text(
                  badge,
                  style: const TextStyle(
                    color: AppColors.emeraldDark,
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      const SizedBox(height: 12),
      JourneyArt(
        kind: JourneyArtKind.plan,
        height: (MediaQuery.sizeOf(context).height * .24).clamp(150.0, 210.0),
      ),
      const SizedBox(height: 8),
      Semantics(
        header: true,
        liveRegion: error,
        child: Text(
          title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 23,
            color: AppColors.emeraldDark,
            fontWeight: FontWeight.w800,
            height: 1.55,
          ),
        ),
      ),
      const SizedBox(height: 8),
      Text(
        message,
        textAlign: TextAlign.center,
        style: const TextStyle(
          fontSize: 14,
          color: AppColors.inkSoft,
          height: 1.85,
        ),
      ),
      if (showPath) ...[
        const SizedBox(height: 20),
        JourneyPath(current: current),
        const SizedBox(height: 12),
        const Text(
          'بعد از تأیید، برنامه‌ات اینجا نمایش داده می‌شود.',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: AppColors.inkSoft, height: 1.7),
        ),
      ],
      if (actionLabel != null) ...[
        const SizedBox(height: 18),
        OutlinedButton(
          onPressed: busy ? null : onAction,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size.fromHeight(50),
            side: const BorderSide(color: AppColors.emeraldDeep, width: 1.3),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          child: busy
              ? const SizedBox.square(
                  dimension: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    semanticsLabel: 'در حال بررسی وضعیت',
                  ),
                )
              : Text(
                  actionLabel!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
        ),
      ],
      if (onSupport != null) ...[
        const SizedBox(height: 5),
        TextButton(
          onPressed: onSupport,
          child: const Text(
            'گفتگو با پشتیبانی',
            style: TextStyle(
              fontSize: 13,
              decoration: TextDecoration.underline,
              decorationColor: AppColors.emeraldDeep,
            ),
          ),
        ),
      ],
    ],
  );
}

class JourneyPath extends StatelessWidget {
  const JourneyPath({super.key, required this.current});
  final int current;
  static const labels = [
    'ثبت اطلاعات',
    'آماده‌سازی برنامه',
    'بررسی متخصص',
    'برنامه آماده',
  ];
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: AppColors.surfaceWarm,
      borderRadius: BorderRadius.circular(19),
      border: Border.all(color: AppColors.line),
    ),
    child: Stack(
      children: [
        PositionedDirectional(
          start: 23,
          top: 22,
          bottom: 22,
          width: 1,
          child: ColoredBox(color: AppColors.emeraldDeep.withValues(alpha: .3)),
        ),
        Column(
          children: [
            for (var i = 0; i < labels.length; i++)
              Semantics(
                label:
                    '${labels[i]}، ${i < current
                        ? 'انجام شده'
                        : i == current
                        ? 'مرحلهٔ فعلی'
                        : 'در ادامه'}',
                excludeSemantics: true,
                child: Container(
                  constraints: const BoxConstraints(minHeight: 43),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    color: i == current ? AppColors.mint : Colors.transparent,
                    borderRadius: BorderRadius.circular(13),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 23,
                        height: 23,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: i < current
                              ? AppColors.emeraldDeep
                              : AppColors.surfaceWarm,
                          border: Border.all(
                            color: i <= current
                                ? AppColors.emeraldDeep
                                : const Color(0xFFC3C3B7),
                            width: i == current ? 2 : 1,
                          ),
                        ),
                        child: i < current
                            ? const Icon(
                                Icons.check_rounded,
                                color: Colors.white,
                                size: 16,
                              )
                            : i == current
                            ? const Center(
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: AppColors.emeraldDeep,
                                    shape: BoxShape.circle,
                                  ),
                                  child: SizedBox.square(dimension: 11),
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          labels[i],
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: i == current
                                ? FontWeight.bold
                                : FontWeight.w500,
                            color: i <= current
                                ? AppColors.ink
                                : AppColors.inkSoft,
                          ),
                        ),
                      ),
                      if (i == current)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 7,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0xFFD4EFD9),
                            borderRadius: BorderRadius.circular(20),
                          ),
                          child: const Text(
                            'در حال انجام',
                            style: TextStyle(
                              fontSize: 9,
                              color: AppColors.emeraldDark,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ],
    ),
  );
}
