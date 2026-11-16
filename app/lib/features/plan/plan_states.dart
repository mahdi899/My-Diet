import '../../core/icons/diet_icon.dart';
import 'package:flutter/material.dart';

import '../../core/theme/tokens.dart';
import '../../data/demo_store.dart';
import '../../presentation/screens/wallet_flow.dart';
import '../../presentation/session/live_session.dart';
import '../../presentation/widgets/kit/kit.dart';
import '../../presentation/widgets/ui.dart';
import '../../presentation/widgets/journey_status_view.dart';
import '../../presentation/widgets/brand_scene.dart';
import '../../presentation/screens/messaging.dart';
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
        const BrandScene(kind: BrandSceneKind.emptyPlan, height: 200),
        const SizedBox(height: 12),
        Text(
          'هنوز برنامه‌ای نداری',
          style: Theme.of(context).textTheme.headlineMedium,
        ),
        const SizedBox(height: 18),
        PillButton(
          label: 'دریافت برنامه',
          iconWidget: const DietIcon(
            DietIconKind.meal,
            color: Colors.white,
            monochrome: true,
          ),
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
      children: [PlanProgressCard(error: message)],
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
        const Padding(
          padding: EdgeInsets.only(bottom: 12),
          child: Text(
            'وضعیت برنامه',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 17,
              fontWeight: FontWeight.bold,
              color: AppColors.ink,
            ),
          ),
        ),
        const PlanProgressCard(),
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

/// Re-checks server state without claiming a generation/review ETA.
class PlanProgressCard extends StatefulWidget {
  const PlanProgressCard({super.key, this.error});
  final String? error;
  @override
  State<PlanProgressCard> createState() => _PlanProgressCardState();
}

class _PlanProgressCardState extends State<PlanProgressCard> {
  bool _checking = false;
  String? _error;
  Future<void> _refresh() async {
    if (_checking) return;
    final store = DemoScope.of(context);
    setState(() {
      _checking = true;
      _error = null;
    });
    try {
      await refreshLive(store);
      if (mounted) setState(() => _error = store.liveNotice);
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'وضعیت دریافت نشد؛ اتصال اینترنت را بررسی کن و دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => _checking = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final status = store.hasUserRequest
        ? store.userRequest.status
        : PlanStatus.incomplete;
    final published = store.hasUserRequest && store.userRequest.isPublished;
    final awaitingAnswer = store.serverAuthEnabled
        ? store.liveOpenQuestions.isNotEmpty
        : store.hasUserRequest &&
              ((store.userRequest.question.isNotEmpty &&
                      store.userRequest.infoAnswer.isEmpty) ||
                  store.userRequest.revisionAwaitingUser);
    final error = _error ?? widget.error ?? store.liveNotice;
    final (title, message, _, current) = published
        ? (
            'برنامه‌ات آماده است',
            'برنامهٔ تأییدشده منتشر شده و وعده‌ها در دسترس‌اند.',
            Icons.task_alt_rounded,
            4,
          )
        : switch (status) {
            PlanStatus.incomplete => (
              'اطلاعات برنامه را کامل کن',
              'برای ادامه، اطلاعات درخواست را بررسی کن. اگر قبلاً ثبت کرده‌ای، وضعیت را دوباره دریافت کن.',
              Icons.edit_note_rounded,
              0,
            ),
            PlanStatus.queued => (
              'درخواستت ثبت شده',
              'اطلاعاتت در صف آماده‌سازی برنامه است. فعلاً کاری لازم نیست؛ می‌توانی بعداً وضعیت را بررسی کنی.',
              Icons.inbox_outlined,
              1,
            ),
            PlanStatus.generating => (
              'برنامه‌ات در حال آماده‌سازی است',
              'پیش‌نویس برنامه در حال ساخته‌شدن است؛ پیش از انتشار، متخصص تغذیه آن را بررسی می‌کند.',
              Icons.auto_awesome_outlined,
              1,
            ),
            PlanStatus.needsInfo => (
              awaitingAnswer
                  ? 'متخصص منتظر پاسخ توست'
                  : 'اطلاعات تکمیلی در حال بررسی است',
              awaitingAnswer
                  ? 'سؤال‌های پایین صفحه را پاسخ بده تا بررسی برنامه ادامه پیدا کند.'
                  : 'اگر سؤال دیگری لازم باشد، همین‌جا نمایش داده می‌شود. می‌توانی بعداً وضعیت را بررسی کنی.',
              Icons.question_answer_outlined,
              2,
            ),
            PlanStatus.ready => (
              'در حال دریافت نسخهٔ منتشرشده',
              'تأیید برنامه ثبت شده؛ برای دریافت وعده‌ها وضعیت را به‌روز کن.',
              Icons.cloud_download_outlined,
              3,
            ),
            PlanStatus.reviewing => (
              'برنامه‌ات در دست متخصص است',
              'پیش‌نویس آماده شده و متخصص تغذیه در حال بررسی آن است.',
              Icons.fact_check_outlined,
              2,
            ),
          };
    return JourneyStatusView(
      key: const ValueKey('plan-progress-card'),
      scene: published
          ? BrandSceneKind.planReady
          : switch (status) {
              PlanStatus.incomplete => BrandSceneKind.needsInformation,
              PlanStatus.queued ||
              PlanStatus.generating ||
              PlanStatus.ready => BrandSceneKind.planBuilding,
              PlanStatus.needsInfo when awaitingAnswer =>
                BrandSceneKind.needsInformation,
              PlanStatus.needsInfo ||
              PlanStatus.reviewing => BrandSceneKind.specialistReview,
            },
      title: error == null ? title : 'وضعیت به‌روز نشد',
      message:
          error ??
          (store.planHoldReason?.trim().isNotEmpty == true
              ? store.planHoldReason!
              : message),
      badge: error != null
          ? 'نیاز به بررسی دوباره'
          : published
          ? 'منتشر شده'
          : status == PlanStatus.needsInfo && awaitingAnswer
          ? 'منتظر پاسخ تو'
          : status == PlanStatus.reviewing
          ? 'در حال بررسی'
          : 'در مسیر آماده‌سازی',
      current: current,
      error: error != null,
      showPath: store.hasUserRequest,
      actionLabel: store.serverAuthEnabled
          ? (error == null ? 'بررسی وضعیت' : 'تلاش دوباره')
          : null,
      onAction: _refresh,
      busy: _checking,
      onSupport: () => Navigator.of(context).push<void>(
        MaterialPageRoute(
          builder: (_) =>
              const MessagingScreen(threadId: 'support-main', support: true),
        ),
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
