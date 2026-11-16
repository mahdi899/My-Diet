import 'dart:typed_data';

import 'package:flutter/material.dart';

import '../../../core/theme/tokens.dart';
import 'coach_companion.dart';

class CoachTextBubble extends StatelessWidget {
  const CoachTextBubble({
    super.key,
    required this.text,
    required this.isUser,
    this.pending = false,
    this.failed = false,
    this.mood = CompanionMood.calm,
  });

  final String text;
  final bool isUser;
  final bool pending;
  final bool failed;
  final CompanionMood mood;

  @override
  Widget build(BuildContext context) {
    const radius = Radius.circular(22);
    const tail = Radius.circular(6);
    
    // Fix RTL for Persian text
    final displayText = _fixPersianText(text);
    
    final bubble = ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.sizeOf(context).width * (isUser ? .82 : .76),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: isUser ? AppColors.emeraldDeep : AppColors.surface,
          borderRadius: BorderRadius.only(
            topLeft: radius,
            topRight: radius,
            bottomLeft: isUser ? radius : tail,
            bottomRight: isUser ? tail : radius,
          ),
          boxShadow: isUser ? const [] : AppShadows.soft,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Text.rich(
              TextSpan(
                children:
                    !isUser && displayText.startsWith('سلام') && displayText.contains('\n')
                    ? [
                        TextSpan(
                          text: displayText.substring(0, displayText.indexOf('\n') + 1),
                          style: const TextStyle(
                            fontSize: 15,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        TextSpan(text: displayText.substring(displayText.indexOf('\n') + 1)),
                      ]
                    : [TextSpan(text: displayText)],
              ),
              style: TextStyle(
                color: isUser ? Colors.white : AppColors.emeraldDark,
                fontSize: 13,
                height: 1.9,
                fontWeight: isUser ? FontWeight.w600 : FontWeight.w500,
              ),
              textAlign: TextAlign.right,
            ),
          ),
        ),
      ),
    );
    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: isUser
          ? bubble
          : Directionality(
              textDirection: TextDirection.ltr,
              child: Row(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  ExcludeSemantics(child: CoachCompanion(size: 32, mood: mood)),
                  const SizedBox(width: 7),
                  bubble,
                ],
              ),
            ),
    );
  }
  
  /// Fix Persian text direction and convert English food names to Persian
  String _fixPersianText(String text) {
    // Convert common English food names to Persian
    final foodMap = {
      'breakfast': 'صبحانه',
      'lunch': 'ناهار',
      'dinner': 'شام',
      'snack': 'میان‌وعده',
      'kcal': 'کالری',
      'gram': 'گرم',
      'protein': 'پروتئین',
      'carbs': 'کربوهیدرات',
      'fat': 'چربی',
    };
    
    var result = text;
    foodMap.forEach((en, fa) {
      result = result.replaceAll(RegExp(en, caseSensitive: false), fa);
    });
    
    return result;
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
      alignment: Alignment.centerRight,
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

/// A finite sprout reaction replaces the perpetual typing-dot loop.
class TypingDots extends StatelessWidget {
  const TypingDots({super.key});

  @override
  Widget build(BuildContext context) => Semantics(
    liveRegion: true,
    label: 'مربی در حال پاسخ‌دادن است',
    excludeSemantics: true,
    child: Align(
      alignment: Alignment.centerLeft,
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const CoachCompanion(size: 44, mood: CompanionMood.thinking),
            const SizedBox(width: 7),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(20),
                boxShadow: AppShadows.soft,
              ),
              child: const Directionality(
                textDirection: TextDirection.rtl,
                child: Text(
                  'دارم به حرفت فکر می‌کنم…',
                  style: TextStyle(fontSize: 12, color: AppColors.emeraldDark),
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}
