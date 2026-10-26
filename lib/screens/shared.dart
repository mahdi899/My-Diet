import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../theme.dart';
import '../widgets/ui.dart';

class NoticesScreen extends StatelessWidget {
  const NoticesScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('اعلان‌ها')),
      body: PageBody(
        children: [
          ...store.notices.map(
            (s) => Surface(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Icon(Icons.notifications_none, color: pine),
                  const SizedBox(width: 13),
                  Expanded(child: Text(s)),
                ],
              ),
            ),
          ),
          const Notice(
            'این اعلان‌ها فقط داخل اپ هستند؛ پیامک یا اعلان بیرونی ارسال نمی‌شود.',
          ),
        ],
      ),
    );
  }
}

class MessagesScreen extends StatefulWidget {
  const MessagesScreen({
    super.key,
    this.embedded = false,
    this.support = false,
  });
  final bool embedded, support;
  @override
  State<MessagesScreen> createState() => _MessagesScreenState();
}

class _MessagesScreenState extends State<MessagesScreen> {
  String query = '';
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context), role = s.role ?? AppRole.user;
    final threads = s
        .visibleThreads(role, support: widget.support)
        .where(
          (t) =>
              s.threadTitle(t, role).contains(query) ||
              s.threadMessages(t.id).any((m) => m.text.contains(query)),
        )
        .toList();
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.support ? 'گفتگوهای پشتیبانی' : 'پیام‌ها'),
        automaticallyImplyLeading: !widget.embedded,
      ),
      body: PageBody(
        children: [
          SearchField(
            hint: 'جست‌وجوی نام یا پیام',
            onChanged: (v) => setState(() => query = v),
          ),
          Heading('گفتگوهای تو', subtitle: '${fa(threads.length)} گفتگو'),
          if (threads.isEmpty)
            const EmptyPanel(
              'گفتگویی پیدا نشد',
              'نام یا عبارت دیگری را جست‌وجو کن.',
              icon: Icons.chat_bubble_outline,
            ),
          for (final thread in threads) ConversationTile(thread: thread),
        ],
      ),
    );
  }
}

class ConversationTile extends StatelessWidget {
  const ConversationTile({
    super.key,
    required this.thread,
    this.receivedOnly = false,
  });
  final ChatThread thread;
  final bool receivedOnly;
  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context), role = s.role ?? AppRole.user;
    final messages = s
        .threadMessages(thread.id)
        .where((m) => !receivedOnly || s.incoming(m, role))
        .toList();
    final last = messages.lastOrNull,
        unread = s.unreadCount(thread, role),
        title = s.threadTitle(thread, role);
    return Surface(
      key: ValueKey('conversation-${thread.id}'),
      padding: 16,
      onTap: () => pushPage(context, ChatScreen(threadId: thread.id)),
      child: Row(
        children: [
          PersonAvatar(
            title,
            color: thread.support ? const Color(0xFFF2E8D6) : sage,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 15,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  last?.text ?? 'برای شروع گفتگو لمس کن',
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: muted,
                    fontSize: 12,
                    height: 1.7,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          if (unread > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: pine,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Text(
                fa(unread),
                style: const TextStyle(color: Colors.white, fontSize: 11),
              ),
            )
          else
            const Icon(Icons.chevron_left, color: muted),
        ],
      ),
    );
  }
}

class ChatScreen extends StatefulWidget {
  const ChatScreen({super.key, required this.threadId});
  final String threadId;
  @override
  State<ChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<ChatScreen> {
  final input = TextEditingController(), scroll = ScrollController();
  @override
  void dispose() {
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  void send(DemoStore s) {
    if (input.text.trim().isEmpty) return;
    s.send(input.text, threadId: widget.threadId);
    input.clear();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (scroll.hasClients) {
        scroll.animateTo(
          scroll.position.maxScrollExtent,
          duration: const Duration(milliseconds: 180),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        role = s.role ?? AppRole.user,
        t = s.thread(widget.threadId);
    if (!s.visibleThreads(role).any((t) => t.id == widget.threadId)) {
      return const Scaffold(
        body: SafeArea(
          child: EmptyPanel(
            'گفتگو در دسترس نیست',
            'به فهرست گفتگوهای خودت برگرد.',
            icon: Icons.lock_outline,
          ),
        ),
      );
    }
    final items = s.threadMessages(t.id);
    if (s.unreadCount(t, role) > 0) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          s.markThreadRead(t.id, role);
          s.update();
        }
      });
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(s.threadTitle(t, role)),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(24),
          child: Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(
              'گفتگوی داخل نسخهٔ نمایشی',
              style: TextStyle(color: muted, fontSize: 11),
            ),
          ),
        ),
      ),
      body: Column(
        children: [
          Expanded(
            child: ListView.builder(
              controller: scroll,
              padding: const EdgeInsets.all(20),
              itemCount: items.length,
              itemBuilder: (context, i) {
                final m = items[i], mine = m.sender == role;
                return Align(
                  alignment: mine
                      ? AlignmentDirectional.centerStart
                      : AlignmentDirectional.centerEnd,
                  child: Container(
                    constraints: BoxConstraints(
                      maxWidth: MediaQuery.sizeOf(context).width * .79,
                    ),
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: mine ? sage : Colors.white,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: const Color(0xFFE0E8D6)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          m.sender == AppRole.user
                              ? s.patientName(t)
                              : m.sender == AppRole.expert
                              ? s.experts.first.name
                              : 'پشتیبانی سبزینه',
                          style: const TextStyle(
                            fontSize: 10,
                            color: muted,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          m.text,
                          style: const TextStyle(height: 2, fontSize: 13),
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
          SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.all(16),
              color: Colors.white,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      key: const ValueKey('chat-input'),
                      controller: input,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => send(s),
                      decoration: const InputDecoration(
                        hintText: 'پیامت رو اینجا بنویس…',
                        contentPadding: EdgeInsets.all(13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 9),
                  IconButton.filled(
                    tooltip: 'ارسال پیام',
                    onPressed: () => send(s),
                    icon: const Icon(Icons.send_outlined),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class HistoryScreen extends StatelessWidget {
  const HistoryScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final history = store.requests
        .where((r) => store.userRequestIds.contains(r.id) && r.isPublished)
        .toList();
    return Scaffold(
      appBar: AppBar(title: const Text('برنامه‌های قبلی')),
      body: PageBody(
        children: [
          if (history.isEmpty)
            const EmptyPanel(
              'هنوز برنامهٔ قبلی نداری',
              'بعد از تأیید برنامه، سابقهٔ آن اینجا قرار می‌گیرد.',
              icon: Icons.history,
            ),
          ...history.map(
            (r) => Surface(
              onTap: () => pushPage(context, ArchivedPlanScreen(request: r)),
              child: Row(
                children: [
                  const Icon(
                    Icons.calendar_month_outlined,
                    color: pine,
                    size: 30,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'برنامهٔ ${fa(r.id)}',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        Text(
                          '${r.specialist} · نسخهٔ ${fa(r.version)}',
                          style: const TextStyle(color: muted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  const Icon(Icons.chevron_left, color: muted),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class ArchivedPlanScreen extends StatelessWidget {
  const ArchivedPlanScreen({super.key, required this.request});
  final DietRequest request;
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text('برنامهٔ ${fa(request.id)}')),
    body: PageBody(
      children: [
        Tag('نسخهٔ ${fa(request.version)}'),
        ...request.published.map(
          (m) => Surface(
            child: InfoRows({
              m.name: m.title,
              'زمان': m.time,
              'مقدار': m.amount,
            }),
          ),
        ),
        Text(request.publishedNote),
      ],
    ),
  );
}

class OrdersScreen extends StatelessWidget {
  const OrdersScreen({super.key});
  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('سفارش‌ها و پرداخت‌ها')),
    body: PageBody(
      children: [
        const Notice(
          'قیمت‌ها و رسیدها نمایشی‌اند. درگاه پرداخت متصل نشده است.',
        ),
        Surface(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Heading(
                'برنامهٔ هفتگی',
                subtitle: 'سفارش ۲۰۸۴ · ۳ آبان ۱۴۰۵',
              ),
              const SizedBox(height: 12),
              const InfoRows({
                'مبلغ نمونه': '۴۹۰٬۰۰۰ تومان',
                'وضعیت': 'پرداخت موفق نمونه',
              }),
              OutlinedButton(
                onPressed: () => showDialog<void>(
                  context: context,
                  builder: (d) => AlertDialog(
                    title: const Text('رسید نمونهٔ سفارش ۲۰۸۴'),
                    content: const Text(
                      'این یک رسید نمایشی است و هیچ تراکنش مالی انجام نشده.',
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(d),
                        child: const Text('بستن'),
                      ),
                    ],
                  ),
                ),
                child: const Text('مشاهدهٔ رسید'),
              ),
            ],
          ),
        ),
      ],
    ),
  );
}
