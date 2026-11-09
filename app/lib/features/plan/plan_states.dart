import 'package:flutter/material.dart';

import '../../core/motion/stagger.dart';
import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/screens/wallet_flow.dart';
import '../../presentation/session/live_session.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../../presentation/widgets/ui.dart';
import 'goal_math.dart';
import 'streak_chip.dart';

class PlanSkeleton extends StatelessWidget {
  const PlanSkeleton({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('plan-skeleton'),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, shellBottomInset),
      children: const [
        Skeleton(width: 140, height: 22),
        SizedBox(height: 16),
        SkeletonCard(height: 180),
        SizedBox(height: 16),
        SkeletonCard(height: 140),
        SizedBox(height: 16),
        SkeletonCard(),
      ],
    );
  }
}

class PlanEmpty extends StatelessWidget {
  const PlanEmpty({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('plan-empty'),
      padding: const EdgeInsets.fromLTRB(20, 28, 20, shellBottomInset),
      children: [
        const Icon(
          Icons.calendar_month_rounded,
          color: AppColors.emerald,
          size: 42,
        ),
        const SizedBox(height: 12),
        Text(
          'هنوز برنامه‌ای نداری',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 18),
        PillButton(
          label: 'دریافت برنامه',
          icon: Icons.restaurant_rounded,
          onPressed: () => openPlanServices(context),
        ),
      ],
    );
  }
}

class PlanProblem extends StatelessWidget {
  const PlanProblem({super.key, required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('plan-error'),
      padding: const EdgeInsets.fromLTRB(20, 28, 20, shellBottomInset),
      children: [
        const Icon(Icons.cloud_off_rounded, color: AppColors.coral, size: 40),
        const SizedBox(height: 12),
        Text('ارتباط قطع شد', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(message, style: const TextStyle(color: AppColors.muted)),
      ],
    );
  }
}

class PlanExpired extends StatelessWidget {
  const PlanExpired({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView(
      key: const ValueKey('plan-expired'),
      padding: const EdgeInsets.fromLTRB(20, 16, 20, shellBottomInset),
      children: [
        const StreakChip(),
        const SizedBox(height: 18),
        Text(
          'این هفته تمام شد',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 18),
        PillButton(
          label: 'برنامهٔ جدید',
          onPressed: () {
            DemoScope.of(context).selectedPlanServiceId = 'new-plan';
            openPlanServices(context);
          },
        ),
      ],
    );
  }
}

class PlanWaiting extends StatelessWidget {
  const PlanWaiting({super.key});

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final request = store.userRequest;
    return ListView(
      key: const ValueKey('plan-waiting'),
      padding: const EdgeInsets.fromLTRB(20, 12, 20, shellBottomInset),
      children: [
        Text(
          'برنامه‌ات در راه است',
          style: Theme.of(context).textTheme.headlineMedium,
        ).rise(),
        const SizedBox(height: 4),
        Text(
          request.status.label,
          style: const TextStyle(color: AppColors.muted),
        ),
        const SizedBox(height: 16),
        const _StatusPath().rise(index: 1),
        const PlanQuestions(),
        if (!store.serverAuthEnabled && request.canApproveInformation) ...[
          const SizedBox(height: 8),
          PillButton(
            label: 'نمایش برنامه',
            onPressed: () {
              store.approve(request.id);
              showToast(context, 'برنامهٔ هفتگی نمونه نمایش داده شد.');
            },
          ),
        ],
      ],
    );
  }
}

class _StatusPath extends StatelessWidget {
  const _StatusPath();

  static const _labels = ['ثبت', 'بررسی', 'پیش‌نویس', 'متخصص', 'آماده'];

  int _active(PlanStatus status) => switch (status) {
    PlanStatus.incomplete => 0,
    PlanStatus.queued => 1,
    PlanStatus.generating => 2,
    PlanStatus.reviewing || PlanStatus.needsInfo => 3,
    PlanStatus.ready => 5,
  };

  @override
  Widget build(BuildContext context) {
    final active = _active(DemoScope.of(context).userRequest.status);
    return AppCard(
      child: Column(
        children: [
          for (var i = 0; i < _labels.length; i++)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                children: [
                  Icon(
                    i < active
                        ? Icons.check_circle_rounded
                        : i == active
                        ? Icons.timelapse_rounded
                        : Icons.circle_outlined,
                    size: 18,
                    color: i <= active ? AppColors.emerald : AppColors.faint,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    _labels[i],
                    style: TextStyle(
                      fontWeight: i == active
                          ? FontWeight.bold
                          : FontWeight.w500,
                      color: i <= active ? AppColors.ink : AppColors.muted,
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// Live doctor questions, demo info requests, and revision replies.
class PlanQuestions extends StatefulWidget {
  const PlanQuestions({super.key});

  @override
  State<PlanQuestions> createState() => _PlanQuestionsState();
}

class _PlanQuestionsState extends State<PlanQuestions> {
  final _answers = <String, TextEditingController>{};
  String? _busy;

  @override
  void dispose() {
    for (final controller in _answers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  TextEditingController _field(String id) =>
      _answers.putIfAbsent(id, TextEditingController.new);

  Future<void> _sendLive(DemoStore store, String id) async {
    final body = _field(id).text.trim();
    if (body.length < 2) {
      showToast(context, 'کمی کامل‌تر بنویس');
      return;
    }
    setState(() => _busy = id);
    final ok = await answerLiveQuestion(store, id, body);
    if (!mounted) return;
    setState(() => _busy = null);
    if (!ok && store.liveNotice != null) showToast(context, store.liveNotice!);
  }

  void _sendDemo(String id) {
    final body = _field(id).text.trim();
    if (body.length < 2) {
      showToast(context, 'کمی کامل‌تر بنویس');
      return;
    }
    DemoScope.of(context).send(body);
    _field(id).clear();
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final request = store.hasUserRequest ? store.userRequest : null;
    final live = store.liveOpenQuestions;
    final needsInfo =
        request != null &&
        request.status == PlanStatus.needsInfo &&
        request.question.isNotEmpty &&
        !request.revisionRequested;
    final revising = request != null && request.revisionRequested;
    if (live.isEmpty && !needsInfo && !revising && store.liveNotice == null) {
      return const SizedBox.shrink();
    }
    return Padding(
      padding: const EdgeInsets.only(top: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (store.liveNotice != null && store.hasUserRequest)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: Text(
                store.liveNotice!,
                style: const TextStyle(color: AppColors.danger, fontSize: 12),
              ),
            ),
          if (request != null && request.revisionRequested)
            AppCard.tinted(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    request.revisionAwaitingUser
                        ? 'منتظر جواب تو'
                        : 'اصلاح در حال بررسی',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  if (request.revisionMessage.isNotEmpty) ...[
                    const SizedBox(height: 6),
                    Text(request.revisionMessage),
                  ],
                  if (request.revisionAwaitingUser) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: _field('revision'),
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(hintText: 'جواب'),
                    ),
                    const SizedBox(height: 8),
                    PillButton(
                      label: 'ارسال',
                      onPressed: () => _sendDemo('revision'),
                    ),
                  ],
                ],
              ),
            ),
          if (request != null &&
              request.status == PlanStatus.needsInfo &&
              request.question.isNotEmpty &&
              !request.revisionRequested) ...[
            if (revising) const SizedBox(height: 10),
            AppCard.tinted(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    request.infoAnswer.isEmpty
                        ? 'یک سؤال مانده'
                        : 'جوابت ارسال شد',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  Text(request.question),
                  if (request.infoAnswer.isEmpty) ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: _field('info'),
                      minLines: 2,
                      maxLines: 4,
                      decoration: const InputDecoration(hintText: 'جواب'),
                    ),
                    const SizedBox(height: 8),
                    PillButton(
                      label: 'ارسال',
                      onPressed: () => _sendDemo('info'),
                    ),
                  ],
                ],
              ),
            ),
          ],
          for (final question in live) ...[
            const SizedBox(height: 10),
            AppCard.tinted(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(question.prompt),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _field(question.id),
                    minLines: 2,
                    maxLines: 4,
                    decoration: const InputDecoration(hintText: 'جواب'),
                  ),
                  const SizedBox(height: 8),
                  PillButton(
                    label: _busy == question.id ? 'در حال ارسال' : 'ارسال',
                    loading: _busy == question.id,
                    onPressed: _busy != null
                        ? null
                        : () => _sendLive(store, question.id),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
