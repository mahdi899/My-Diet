import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../data/wallet_catalog.dart';
import '../../core/theme/theme.dart';
import 'expert.dart';
import 'clinic_workspace.dart';
import '../widgets/ui.dart';
import 'messaging.dart';

class ChatScreen extends StatelessWidget {
  const ChatScreen({super.key, required this.threadId});
  final String threadId;
  @override
  Widget build(BuildContext context) =>
      DemoScope.of(context).role == AppRole.user
      ? MessagingScreen(
          threadId: threadId,
          support: threadId.startsWith('support'),
        )
      : LegacyChatScreen(threadId: threadId);
}

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
    if (s.serverAuthEnabled && role == AppRole.user) {
      return const LiveConversationsScreen();
    }
    final threads = s
        .visibleThreads(role, support: widget.support)
        .where(
          (t) =>
              s.threadTitle(t, role).contains(query) ||
              s.threadMessages(t.id).any((m) => m.text.contains(query)),
        )
        .toList();
    if (role == AppRole.expert) {
      return Scaffold(
        appBar: AppBar(
          title: const Text(
            'صندوق گفتگوها',
            style: TextStyle(color: Colors.white),
          ),
          backgroundColor: pine,
          foregroundColor: Colors.white,
        ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              color: pine,
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${fa(threads.length)} گفتگو با کاربران',
                    style: const TextStyle(color: Colors.white70, fontSize: 12),
                  ),
                  const SizedBox(height: 16),
                  SearchField(
                    hint: 'جست‌وجوی نام یا پیام',
                    onChanged: (v) => setState(() => query = v),
                  ),
                ],
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(20),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  clipBehavior: Clip.antiAlias,
                  child: Column(
                    children: [
                      if (threads.isEmpty)
                        const Padding(
                          padding: EdgeInsets.all(24),
                          child: Text('گفتگویی پیدا نشد'),
                        ),
                      for (var i = 0; i < threads.length; i++) ...[
                        if (i > 0)
                          const Divider(height: 1, indent: 15, endIndent: 15),
                        ClinicConversationRow(thread: threads[i]),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      );
    }
    return Scaffold(
      appBar: AppBar(
        title: Text(
          widget.support
              ? 'گفتگوهای پشتیبانی'
              : role == AppRole.expert
              ? 'صندوق پیام‌ها'
              : 'پیام‌ها',
        ),
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
      radius: role == AppRole.expert ? 14 : 22,
      padding: role == AppRole.expert ? 12 : 16,
      onTap: () => pushPage(context, ChatScreen(threadId: thread.id)),
      child: Row(
        children: [
          PersonAvatar(
            title,
            size: role == AppRole.expert ? 36 : 48,
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
                  maxLines: role == AppRole.expert ? 1 : 2,
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

class LegacyChatScreen extends StatefulWidget {
  const LegacyChatScreen({super.key, required this.threadId});
  final String threadId;
  @override
  State<LegacyChatScreen> createState() => _ChatScreenState();
}

class _ChatScreenState extends State<LegacyChatScreen> {
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
    final files = s.requests.where((r) => r.name == s.patientName(t));
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
        actions: [
          if (role == AppRole.expert && !t.support && files.isNotEmpty)
            TextButton(
              onPressed: () => openReview(context, files.first),
              child: const Text('مشاهده پرونده'),
            ),
        ],
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
                              : 'پشتیبانی رژیم من',
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
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('گردش کیف پول')),
      body: PageBody(
        children: [
          Surface(
            color: sage,
            child: Heading(
              'موجودی کیف پول',
              subtitle: formatToman(s.walletBalance),
            ),
          ),
          const Notice(
            'مبلغ‌ها و پرداخت‌ها نمایشی‌اند؛ پول واقعی جابه‌جا نمی‌شود.',
          ),
          if (s.walletTransactions.isEmpty)
            const EmptyPanel(
              'تراکنشی نداری',
              'شارژ، خرید و جایزهٔ هفتگی اینجا ثبت می‌شوند.',
              icon: Icons.receipt_long_outlined,
            ),
          for (final t in s.walletTransactions)
            Surface(
              child: Row(
                children: [
                  Icon(
                    t.credit ? Icons.south_west : Icons.north_east,
                    color: pine,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(t.title),
                        Text(
                          'مانده: ${formatToman(t.balanceAfter)}',
                          style: const TextStyle(color: muted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                  Text('${t.credit ? '+' : '−'} ${formatToman(t.amountToman)}'),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
