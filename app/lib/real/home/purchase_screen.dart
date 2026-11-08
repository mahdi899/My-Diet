import 'package:flutter/material.dart';
import '../../theme.dart';
import '../commerce/commerce.dart';
import '../core/api.dart';
import '../core/digits.dart';
import '../core/motion.dart';
import '../onboarding/repository.dart';
import '../session.dart';
import 'topup_sheet.dart';

/// Buying the plan from the wallet. The idempotency key is created once per attempt, so a
/// dropped connection followed by "try again" can never charge twice.
class PurchaseScreen extends StatefulWidget {
  const PurchaseScreen({
    super.key,
    required this.services,
    required this.onOrdered,
    required this.onSignOut,
    this.profile,
    this.cancelled = false,
  });
  final Services services;
  final ProfileSummary? profile;
  final bool cancelled;
  final Future<void> Function() onOrdered;
  final VoidCallback onSignOut;

  @override
  State<PurchaseScreen> createState() => _PurchaseScreenState();
}

class _PurchaseScreenState extends State<PurchaseScreen> {
  Catalog? catalog;
  Wallet? wallet;
  String? error;
  bool busy = false;
  String? _attemptKey;

  CommerceRepository get repo => widget.services.commerce;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final results = await Future.wait<Object>([
        repo.catalog(),
        repo.wallet(),
      ]);
      if (!mounted) return;
      setState(() {
        catalog = results[0] as Catalog;
        wallet = results[1] as Wallet;
        error = null;
      });
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    }
  }

  ServiceOffer? get offer => catalog?.service('new_plan');

  Future<void> _buy() async {
    final o = offer;
    if (o == null) return;
    setState(() {
      busy = true;
      error = null;
    });
    _attemptKey ??= newIdempotencyKey();
    try {
      await repo.placeOrder(
        serviceCode: 'new_plan',
        expectedPriceToman: o.priceToman,
        idempotencyKey: _attemptKey!,
      );
      Haptics.success();
      _attemptKey = null;
      await widget.onOrdered();
    } on ApiException catch (e) {
      // A definite server answer ends this attempt; a network failure keeps the key for the retry.
      if (!e.offline) _attemptKey = null;
      if (e.code == 'price_changed') await _load();
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> _topup() async {
    final done = await showTopupSheet(
      context,
      commerce: repo,
      packages: catalog?.topups ?? const [],
      need: (offer?.priceToman ?? 0) - (wallet?.total ?? 0),
    );
    if (done == true) await _load();
  }

  @override
  Widget build(BuildContext context) {
    final o = offer, w = wallet;
    final enough = o != null && w != null && w.total >= o.priceToman;
    final p = widget.profile;
    return Scaffold(
      appBar: AppBar(
        title: const Text('برنامهٔ غذایی تو'),
        actions: [
          IconButton(
            tooltip: 'خروج',
            onPressed: widget.onSignOut,
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 8, 20, 24),
        children: [
          if (widget.cancelled)
            const Padding(
              padding: EdgeInsets.only(bottom: 14),
              child: _Notice('درخواست قبلی لغو شده؛ می‌تونی دوباره ثبت کنی.'),
            ),
          Reveal(
            child: Text(
              'سه قدم تا شروع رژیم',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ),
          const SizedBox(height: 14),
          for (final (i, step) in const [
            (
              Icons.psychology_alt_outlined,
              'پیش‌نویس هوشمند',
              'هوش مصنوعی با غذاهای ایرانیِ سفرهٔ خودت، یه هفته می‌چینه.',
            ),
            (
              Icons.medical_services_outlined,
              'بررسی دکتر',
              'دکتر تغذیه پیش‌نویس رو می‌بینه، اصلاح و تأیید می‌کنه.',
            ),
            (
              Icons.play_circle_outline,
              'شروع رژیم',
              'فقط بعد از تأیید دکتر، برنامه برات فعال می‌شه.',
            ),
          ].indexed)
            Reveal(
              index: i + 1,
              child: Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFDDE5D4)),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        backgroundColor: sage,
                        child: Icon(step.$1, color: pine),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              step.$2,
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            Text(
                              step.$3,
                              style: const TextStyle(
                                color: muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          if (p != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: _Notice(
                'هدف انرژی تو: ${fa(p.targetKcal)} کیلوکالری در روز، بر پایهٔ پاسخ‌هات.',
              ),
            ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: sage,
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              children: [
                _Row(
                  'قیمت برنامه',
                  o == null ? '…' : '${money(o.priceToman)} تومان',
                ),
                const SizedBox(height: 6),
                _Row(
                  'موجودی کیف پول',
                  w == null ? '…' : '${money(w.total)} تومان',
                  warn: o != null && w != null && !enough,
                ),
              ],
            ),
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Text(
                error!,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Color(0xFFA02B2B)),
              ),
            ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: busy || o == null || w == null
                ? null
                : (enough ? _buy : _topup),
            child: busy
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2.4,
                      color: Colors.white,
                    ),
                  )
                : Text(enough ? 'پرداخت از کیف پول و شروع' : 'شارژ کیف پول'),
          ),
          if (enough)
            TextButton(onPressed: _topup, child: const Text('شارژ بیشتر')),
        ],
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  const _Notice(this.text);
  final String text;
  @override
  Widget build(BuildContext context) => Container(
    padding: const EdgeInsets.all(12),
    decoration: BoxDecoration(
      color: const Color(0xFFFFF7E3),
      borderRadius: BorderRadius.circular(14),
    ),
    child: Text(text, style: const TextStyle(fontSize: 12, height: 1.8)),
  );
}

class _Row extends StatelessWidget {
  const _Row(this.label, this.value, {this.warn = false});
  final String label, value;
  final bool warn;
  @override
  Widget build(BuildContext context) => Row(
    children: [
      Expanded(child: Text(label)),
      Text(
        value,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: warn ? const Color(0xFFA02B2B) : pine,
        ),
      ),
    ],
  );
}
