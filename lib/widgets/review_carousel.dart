import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import 'ui.dart';

class ReviewCarousel extends StatefulWidget {
  const ReviewCarousel({super.key, required this.reviews});
  final List<ProgramReview> reviews;
  @override
  State<ReviewCarousel> createState() => _ReviewCarouselState();
}

class _ReviewCarouselState extends State<ReviewCarousel> {
  final controller = PageController(viewportFraction: .96);
  int selected = 0;
  @override
  void didUpdateWidget(covariant ReviewCarousel oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (selected >= widget.reviews.length) {
      selected = 0;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && controller.hasClients) controller.jumpToPage(0);
      });
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  void showReview(ProgramReview review) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheet) => SafeArea(
        child: ConstrainedBox(
          constraints: BoxConstraints(
            maxHeight: MediaQuery.sizeOf(sheet).height * .7,
          ),
          child: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Heading(
                  review.authorName,
                  subtitle: 'امتیاز ${fa(review.rating)} از ۵',
                ),
                const SizedBox(height: 12),
                Text(review.text, style: const TextStyle(height: 1.9)),
              ],
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (widget.reviews.isEmpty) return const SizedBox.shrink();
    final multiple = widget.reviews.length > 1;
    final textScale = MediaQuery.textScalerOf(context).scale(12) / 12;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'تجربهٔ کاربران',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 10),
        SizedBox(
          height: 116 * textScale.clamp(1.0, 2.5),
          child: PageView.builder(
            key: const ValueKey('user-reviews-carousel'),
            controller: controller,
            padEnds: false,
            itemCount: widget.reviews.length,
            onPageChanged: (page) => setState(() => selected = page),
            itemBuilder: (_, index) {
              final review = widget.reviews[index];
              return Padding(
                padding: const EdgeInsetsDirectional.only(end: 8),
                child: Surface(
                  key: ValueKey('review-${review.id}'),
                  padding: 13,
                  onTap: () => showReview(review),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      Row(
                        children: [
                          PersonAvatar(review.authorName, size: 28),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              review.authorName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                          const Icon(
                            Icons.star_rounded,
                            color: amber,
                            size: 16,
                          ),
                          const SizedBox(width: 3),
                          Text(
                            fa(review.rating),
                            style: const TextStyle(fontSize: 12, color: ink),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Expanded(
                        child: Text(
                          review.text,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 12,
                            height: 1.7,
                            color: ink,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
        if (multiple) ...[
          const SizedBox(height: 9),
          Semantics(
            label: 'برای دیدن نظر بعدی، کارت را به طرفین بکش',
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(
                widget.reviews.length.clamp(0, 8),
                (i) => AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 3),
                  height: 4,
                  width: selected % 8 == i ? 18 : 5,
                  decoration: BoxDecoration(
                    color: selected % 8 == i
                        ? pine
                        : pine.withValues(alpha: .18),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
        ],
      ],
    );
  }
}
