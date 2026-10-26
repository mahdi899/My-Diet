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
  final input = TextEditingController();
  final scroll = ScrollController();
  @override
  void dispose() {
    input.dispose();
    scroll.dispose();
    super.dispose();
  }

  void send(DemoStore store) {
    if (input.text.trim().isEmpty) return;
    store.send(input.text, support: widget.support);
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
    final store = DemoScope.of(context), role = store.role ?? AppRole.user;
    final items = store.messages
        .where((m) => m.support == widget.support)
        .toList();
    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: !widget.embedded,
        title: Text(
          widget.support
              ? 'پشتیبانی سبزینه'
              : role == AppRole.expert
              ? 'گفت‌وگو با سارا'
              : 'پیام‌های متخصص',
        ),
        bottom: const PreferredSize(
          preferredSize: Size.fromHeight(24),
          child: Padding(
            padding: EdgeInsets.only(bottom: 10),
            child: Text(
              'گفت‌وگوی نمونه · ارسال واقعی ندارد',
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
                          m.sender == AppRole.expert
                              ? 'متخصص'
                              : m.sender == AppRole.admin
                              ? 'پشتیبانی'
                              : 'سارا',
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
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              color: Colors.white,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Expanded(
                    child: TextField(
                      controller: input,
                      minLines: 1,
                      maxLines: 4,
                      textInputAction: TextInputAction.send,
                      onSubmitted: (_) => send(store),
                      decoration: const InputDecoration(
                        hintText: 'پیامت رو اینجا بنویس…',
                        contentPadding: EdgeInsets.all(13),
                      ),
                    ),
                  ),
                  const SizedBox(width: 9),
                  IconButton.filled(
                    tooltip: 'ارسال پیام',
                    onPressed: () => send(store),
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
