import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../data/day.dart';
import '../../core/theme/theme.dart';
import '../widgets/ui.dart';
import '../widgets/clinic_food_art.dart';
import 'expert.dart';
import 'shared.dart';
import 'doctor.dart';
import 'privacy.dart';

class ClinicStatus extends StatelessWidget {
  const ClinicStatus(this.request, {super.key});
  final DietRequest request;
  @override
  Widget build(BuildContext context) {
    final answered =
        request.infoAnswer.isNotEmpty &&
        !request.infoAnswerReviewed &&
        request.status != PlanStatus.ready;
    final color = answered
        ? pine
        : request.status == PlanStatus.ready
        ? pine
        : request.status == PlanStatus.needsInfo
        ? muted
        : amber;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: .09),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        answered
            ? 'پاسخ جدید'
            : request.status == PlanStatus.needsInfo &&
                  request.infoAnswerReviewed
            ? 'پاسخ بررسی شده'
            : request.status.label,
        style: TextStyle(
          fontSize: 10,
          color: color,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class ClinicRequestRow extends StatelessWidget {
  const ClinicRequestRow(this.request, {super.key, this.color = Colors.white});
  final Color color;
  final DietRequest request;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    borderRadius: BorderRadius.circular(10),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: () => openReview(context, request),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              width: 4,
              color: request.status == PlanStatus.ready ? sage : pine,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Text(
                          'پرونده ${fa(request.id)}',
                          style: const TextStyle(fontSize: 10, color: muted),
                        ),
                        const Spacer(),
                        if (request.priority)
                          const Icon(
                            Icons.priority_high,
                            size: 14,
                            color: amber,
                          ),
                        Text(
                          request.wait,
                          style: const TextStyle(fontSize: 10, color: muted),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            request.name,
                            style: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const Icon(
                          Icons.arrow_back_rounded,
                          size: 18,
                          color: pine,
                        ),
                      ],
                    ),
                    const SizedBox(height: 5),
                    Text(
                      request.goal,
                      style: const TextStyle(fontSize: 11, color: muted),
                    ),
                    const SizedBox(height: 10),
                    Wrap(
                      spacing: 8,
                      crossAxisAlignment: WrapCrossAlignment.center,
                      children: [
                        ClinicStatus(request),
                        if (request.revisionRequested)
                          const Text(
                            'اصلاح برنامه',
                            style: TextStyle(fontSize: 11, color: pine),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class ClinicConversationRow extends StatelessWidget {
  const ClinicConversationRow({
    super.key,
    required this.thread,
    this.receivedOnly = false,
  });
  final ChatThread thread;
  final bool receivedOnly;
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    final messages = s
        .threadMessages(thread.id)
        .where((m) => !receivedOnly || s.incoming(m, AppRole.expert));
    final unread = s.unreadCount(thread, AppRole.expert);
    final title = s.threadTitle(thread, AppRole.expert);
    return InkWell(
      key: ValueKey('conversation-${thread.id}'),
      onTap: () => pushPage(context, ChatScreen(threadId: thread.id)),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 14),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: sage,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                title.isEmpty ? '' : title.substring(0, 1),
                style: const TextStyle(
                  color: pine,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    messages.lastOrNull?.text ?? 'شروع گفتگو',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 11, color: muted),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            if (unread > 0)
              Container(
                width: 22,
                height: 22,
                alignment: Alignment.center,
                decoration: const BoxDecoration(
                  color: pine,
                  shape: BoxShape.circle,
                ),
                child: Text(
                  fa(unread),
                  style: const TextStyle(color: Colors.white, fontSize: 10),
                ),
              )
            else
              const Icon(Icons.chevron_left, size: 18, color: muted),
          ],
        ),
      ),
    );
  }
}

class ClinicHome extends StatelessWidget {
  const ClinicHome({super.key});
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context), doctor = s.experts.first;
    final pending = s.requests
        .where(
          (r) =>
              r.status != PlanStatus.ready && r.status != PlanStatus.needsInfo,
        )
        .length;
    final responses = s.requests
        .where(
          (r) =>
              r.infoAnswer.isNotEmpty &&
              !r.infoAnswerReviewed &&
              r.status != PlanStatus.ready,
        )
        .length;
    final revisions = s.requests.where((r) => r.revisionRequested).toList();
    final threads = s.receivedThreads(AppRole.expert).take(3).toList();
    return Scaffold(
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 26),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  PersonAvatar(doctor.name, size: 42),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          doctor.name,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          persianDate(s.today, year: true),
                          style: const TextStyle(color: muted, fontSize: 10),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    tooltip: 'پرونده‌های کاربران',
                    onPressed: () =>
                        pushPage(context, const ExpertPatientsScreen()),
                    icon: const Icon(Icons.folder_shared_outlined, color: pine),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                decoration: BoxDecoration(
                  color: pine,
                  borderRadius: BorderRadius.circular(26),
                  boxShadow: [
                    BoxShadow(
                      color: pine.withValues(alpha: .16),
                      blurRadius: 20,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(26),
                  child: Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(18, 22, 18, 10),
                        child: Row(
                          children: [
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 9,
                                      vertical: 4,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(
                                        alpha: .12,
                                      ),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: const Text(
                                      'رژیم من • پنل تخصصی',
                                      style: TextStyle(
                                        color: Colors.white70,
                                        fontSize: 9,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 14),
                                  const Text(
                                    'میز کار\nپزشک',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 26,
                                      fontWeight: FontWeight.bold,
                                      height: 1.5,
                                    ),
                                  ),
                                  const SizedBox(height: 7),
                                  const Text(
                                    'بررسی دقیق، تغذیهٔ بهتر',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(
                              width: 145,
                              child: ClinicFoodArt(size: 145),
                            ),
                          ],
                        ),
                      ),
                      Material(
                        color: const Color(0xFF17452C),
                        child: InkWell(
                          onTap: () => pushPage(
                            context,
                            const RequestListScreen(
                              initialFilter: 'نیازمند بررسی',
                            ),
                          ),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 20,
                              vertical: 14,
                            ),
                            child: Row(
                              children: [
                                Container(
                                  width: 38,
                                  height: 38,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: sage,
                                    borderRadius: BorderRadius.circular(12),
                                  ),
                                  child: Text(
                                    fa(pending),
                                    style: const TextStyle(
                                      color: pine,
                                      fontSize: 21,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 12),
                                const Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        'نیازمند بررسی',
                                        style: TextStyle(
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                          fontSize: 13,
                                        ),
                                      ),
                                      Text(
                                        'مشاهده و بررسی برنامه‌های غذایی',
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 9,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                const Icon(
                                  Icons.arrow_back_rounded,
                                  color: Colors.white,
                                  size: 19,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: _FoodMetric(
                      'پاسخ‌های جدید',
                      responses,
                      kind: 1,
                      color: pine,
                      onTap: () => pushPage(
                        context,
                        const RequestListScreen(initialFilter: 'پاسخ جدید'),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _FoodMetric(
                      'درخواست اصلاح',
                      revisions.length,
                      kind: 2,
                      color: sage,
                      onTap: () => pushPage(
                        context,
                        const RequestListScreen(initialFilter: 'درخواست اصلاح'),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              _DashboardSectionHeader(
                'پیام‌های دریافت‌شده',
                subtitle: 'گفتگوهای اخیر با کاربران',
                icon: Icons.forum_outlined,
                count: threads.length,
                onTap: () => pushPage(context, const MessagesScreen()),
              ),
              const SizedBox(height: 12),
              Material(
                color: sage,
                borderRadius: BorderRadius.circular(18),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  children: [
                    if (threads.isEmpty)
                      const Padding(
                        padding: EdgeInsets.all(20),
                        child: Text('پیام تازه‌ای نیست'),
                      ),
                    for (var i = 0; i < threads.length; i++) ...[
                      if (i > 0)
                        const Divider(height: 1, indent: 18, endIndent: 18),
                      ClinicConversationRow(
                        thread: threads[i],
                        receivedOnly: true,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: 24),
              Container(
                key: const ValueKey('revision-requests-section'),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    _DashboardSectionHeader(
                      'درخواست‌های تغییر برنامه',
                      subtitle: 'بازبینی وعده‌ها و مقدار مصرف',
                      icon: Icons.edit_document,
                      count: revisions.length,
                      onTap: () => pushPage(
                        context,
                        const RequestListScreen(initialFilter: 'درخواست اصلاح'),
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (revisions.isEmpty)
                      const Notice(
                        'درخواست اصلاحی ثبت نشده است.',
                        icon: Icons.edit_note,
                      ),
                    if (revisions.isNotEmpty)
                      RevisionRequestCarousel(requests: revisions),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class RevisionRequestCarousel extends StatefulWidget {
  const RevisionRequestCarousel({super.key, required this.requests});
  final List<DietRequest> requests;
  @override
  State<RevisionRequestCarousel> createState() =>
      _RevisionRequestCarouselState();
}

class _RevisionRequestCarouselState extends State<RevisionRequestCarousel> {
  final controller = PageController();
  int selected = 0;
  @override
  void didUpdateWidget(covariant RevisionRequestCarousel old) {
    super.didUpdateWidget(old);
    final oldId = selected < old.requests.length
        ? old.requests[selected].id
        : null;
    final next = widget.requests.indexWhere((r) => r.id == oldId);
    final target = next < 0 ? 0 : next;
    if (target != selected) {
      selected = target;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted && controller.hasClients) controller.jumpToPage(target);
      });
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.requests.isEmpty) return const SizedBox.shrink();
    final scale = MediaQuery.textScalerOf(context).scale(17) / 17;
    return LayoutBuilder(
      builder: (context, constraints) {
        var reasonHeight = 0.0;
        for (final r in widget.requests) {
          final painter = TextPainter(
            text: TextSpan(
              text: r.revisionReason.isEmpty
                  ? 'درخواست تغییر از سمت کاربر'
                  : r.revisionReason,
              style: TextStyle(
                fontFamily: 'Vazirmatn',
                fontSize: 17,
                fontWeight: FontWeight.w800,
                height: 1.8,
              ),
            ),
            textDirection: TextDirection.rtl,
            textScaler: MediaQuery.textScalerOf(context),
          );
          painter.layout(
            maxWidth: (constraints.maxWidth - 42).clamp(80, double.infinity),
          );
          if (painter.height > reasonHeight) reasonHeight = painter.height;
          painter.dispose();
        }
        return Column(
          children: [
            SizedBox(
              height: reasonHeight + 244 * scale,
              child: PageView.builder(
                key: const ValueKey('revision-request-carousel'),
                controller: controller,
                itemCount: widget.requests.length,
                onPageChanged: (i) => setState(() => selected = i),
                itemBuilder: (context, index) {
                  final request = widget.requests[index];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 2),
                    child: Align(
                      alignment: Alignment.topCenter,
                      child: Container(
                        decoration: BoxDecoration(
                          color: pine,
                          borderRadius: BorderRadius.circular(15),
                        ),
                        padding: const EdgeInsets.all(7),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 10,
                                vertical: 10,
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Text(
                                    'دلیل درخواست تغییر',
                                    style: TextStyle(
                                      color: Colors.white70,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 11,
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    request.revisionReason.isEmpty
                                        ? 'درخواست تغییر از سمت کاربر'
                                        : request.revisionReason,
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 17,
                                      fontWeight: FontWeight.w800,
                                      height: 1.8,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            ClinicRequestRow(request, color: sage),
                          ],
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            if (widget.requests.length > 1) ...[
              const SizedBox(height: 10),
              Semantics(
                label:
                    'درخواست ${fa(selected + 1)} از ${fa(widget.requests.length)}',
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < widget.requests.length; i++)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(12),
                          onTap: () => controller.animateToPage(
                            i,
                            duration: const Duration(milliseconds: 280),
                            curve: Curves.easeOutCubic,
                          ),
                          child: SizedBox(
                            width: 26,
                            height: 28,
                            child: Center(
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 180),
                                height: 5,
                                width: selected == i ? 22 : 6,
                                decoration: BoxDecoration(
                                  color: selected == i
                                      ? pine
                                      : pine.withValues(alpha: .2),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const Text(
                'برای دیدن درخواست بعدی، کارت را به طرفین بکش',
                style: TextStyle(color: muted, fontSize: 10),
              ),
            ],
          ],
        );
      },
    );
  }
}

class _FoodMetric extends StatelessWidget {
  const _FoodMetric(
    this.label,
    this.value, {
    required this.kind,
    required this.color,
    required this.onTap,
  });
  final String label;
  final int value, kind;
  final Color color;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Material(
    color: color,
    borderRadius: BorderRadius.circular(20),
    clipBehavior: Clip.antiAlias,
    child: InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 8, 8, 14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    fa(value),
                    style: TextStyle(
                      fontSize: 32,
                      color: color == pine ? Colors.white : pine,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                SizedBox(
                  width: 63,
                  height: 63,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.all(11),
                      decoration: BoxDecoration(
                        color: (color == pine ? Colors.white : pine).withValues(
                          alpha: .1,
                        ),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        kind == 1
                            ? Icons.forum_outlined
                            : Icons.edit_note_rounded,
                        size: 29,
                        color: color == pine ? Colors.white : pine,
                      ),
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 2),
            Text(
              label,
              style: TextStyle(
                color: color == pine ? Colors.white : pine,
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    ),
  );
}

class _DashboardSectionHeader extends StatelessWidget {
  const _DashboardSectionHeader(
    this.title, {
    required this.subtitle,
    required this.icon,
    required this.count,
    required this.onTap,
  });
  final String title, subtitle;
  final IconData icon;
  final int count;
  final VoidCallback onTap;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Container(
        width: 40,
        height: 44,
        decoration: BoxDecoration(
          color: sage,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Icon(icon, color: pine, size: 21),
      ),
      const SizedBox(width: 10),
      Expanded(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
            ),
            Text(subtitle, style: const TextStyle(color: muted, fontSize: 10)),
          ],
        ),
      ),
      Container(
        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(7),
        ),
        child: Text(
          fa(count),
          style: const TextStyle(color: pine, fontSize: 11),
        ),
      ),
      IconButton(
        tooltip: 'مشاهده همه',
        onPressed: onTap,
        visualDensity: VisualDensity.compact,
        icon: const Icon(Icons.arrow_back_rounded, size: 18, color: pine),
      ),
    ],
  );
}

class ClinicProfile extends StatefulWidget {
  const ClinicProfile({super.key});
  @override
  State<ClinicProfile> createState() => _ClinicProfileState();
}

class _ClinicProfileState extends State<ClinicProfile> {
  int? expanded;
  Widget section(
    int index,
    String title,
    String subtitle,
    IconData icon,
    Map<String, String> fields,
  ) {
    final open = expanded == index;
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          InkWell(
            key: ValueKey('clinic-profile-section-$index'),
            onTap: () => setState(() => expanded = open ? null : index),
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: sage,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(icon, color: pine, size: 20),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          title,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                        Text(
                          subtitle,
                          style: const TextStyle(fontSize: 10, color: muted),
                        ),
                      ],
                    ),
                  ),
                  Icon(
                    open ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: pine,
                  ),
                ],
              ),
            ),
          ),
          if (open)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (final entry in fields.entries) ...[
                    const Divider(height: 18),
                    Text(
                      entry.key,
                      style: const TextStyle(color: muted, fontSize: 10),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      entry.value.isEmpty ? 'ثبت نشده' : entry.value,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                      textDirection:
                          entry.key.contains('تلفن') ||
                              entry.key.contains('همراه')
                          ? TextDirection.ltr
                          : null,
                    ),
                  ],
                ],
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context), e = s.experts.first;
    return Scaffold(
      appBar: AppBar(
        title: const Text('پروفایل پزشک'),
        actions: [
          IconButton(
            tooltip: 'ویرایش اطلاعات فردی و مطب',
            onPressed: () => pushPage(context, const ExpertProfileEditor()),
            icon: const Icon(Icons.edit_outlined),
          ),
        ],
      ),
      body: PageBody(
        spacing: 12,
        children: [
          Container(
            padding: const EdgeInsets.fromLTRB(20, 24, 20, 20),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: pine, width: 1.5),
                  ),
                  child: PersonAvatar(e.name, size: 64),
                ),
                const SizedBox(height: 12),
                Text(
                  e.name,
                  style: const TextStyle(
                    fontWeight: FontWeight.bold,
                    fontSize: 19,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  e.specialty,
                  style: const TextStyle(color: muted, fontSize: 12),
                ),
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: sage,
                    borderRadius: BorderRadius.circular(7),
                  ),
                  child: Text(
                    'کد نظام پزشکی: ${e.medicalCode}',
                    style: const TextStyle(fontSize: 11, color: pine),
                  ),
                ),
                const SizedBox(height: 18),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () =>
                        pushPage(context, const ExpertProfileEditor()),
                    icon: const Icon(Icons.edit_outlined, size: 17),
                    label: const Text('ویرایش اطلاعات فردی و مطب'),
                  ),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.only(top: 10, bottom: 2),
            child: Text(
              'اطلاعات و تنظیمات',
              style: TextStyle(
                fontSize: 12,
                color: muted,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
          section(
            0,
            'اطلاعات حرفه‌ای',
            'تخصص، تحصیلات و سابقه',
            Icons.badge_outlined,
            {
              'تخصص': e.specialty,
              'مدرک تحصیلی': e.degree,
              'سابقهٔ فعالیت': '${fa(e.experience)} سال',
              'دربارهٔ پزشک': e.bio,
            },
          ),
          section(
            1,
            'اطلاعات مطب',
            'آدرس، تلفن و زمان پذیرش',
            Icons.local_hospital_outlined,
            {
              'شهر': e.city,
              'آدرس مطب': e.address,
              'تلفن مطب': e.clinicPhone,
              'روزها و ساعت پذیرش': e.hours,
            },
          ),
          section(2, 'حساب شخصی', 'شمارهٔ همراه خصوصی', Icons.lock_outline, {
            'شمارهٔ همراه': e.mobile,
            'نمایش اطلاعات':
                'شمارهٔ همراه شخصی برای کاربران نمایش داده نمی‌شود.',
          }),
          TextButton.icon(
            onPressed: () => pushPage(context, const PrivacyScreen()),
            icon: const Icon(Icons.privacy_tip_outlined, size: 17),
            label: const Text('حریم خصوصی', style: TextStyle(fontSize: 12)),
          ),
          Center(
            child: TextButton.icon(
              onPressed: () {
                s.showRoleSelection();
                Navigator.of(context).popUntil((r) => r.isFirst);
              },
              icon: const Icon(Icons.switch_account_outlined, size: 17),
              label: const Text(
                'تعویض پنل نمایشی',
                style: TextStyle(fontSize: 12, color: muted),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
