import 'package:flutter/material.dart';
import '../../theme.dart';
import '../commerce/commerce.dart';
import '../core/api.dart';
import '../core/digits.dart';
import '../core/motion.dart';

/// Opens a callback so the app can hand a hosted gateway page to the browser.
/// Set once at startup (see `main_real.dart`); null in tests and in sandbox-only setups.
Future<void> Function(Uri url)? openExternalUrl;

/// Returns true when the wallet was credited.
Future<bool?> showTopupSheet(
  BuildContext context, {
  required CommerceRepository commerce,
  required List<TopupPackage> packages,
  int need = 0,
}) => showModalBottomSheet<bool>(
  context: context,
  isScrollControlled: true,
  showDragHandle: true,
  backgroundColor: cream,
  builder: (_) =>
      _TopupSheet(commerce: commerce, packages: packages, need: need),
);

class _TopupSheet extends StatefulWidget {
  const _TopupSheet({
    required this.commerce,
    required this.packages,
    required this.need,
  });
  final CommerceRepository commerce;
  final List<TopupPackage> packages;
  final int need;

  @override
  State<_TopupSheet> createState() => _TopupSheetState();
}

class _TopupSheetState extends State<_TopupSheet> {
  String? selected;
  bool busy = false;
  String? error, status;

  @override
  void initState() {
    super.initState();
    // Preselect the smallest package that covers what is missing.
    final fit = widget.packages
        .where((p) => p.amountToman >= widget.need)
        .toList();
    selected = (fit.isNotEmpty ? fit.first : widget.packages.lastOrNull)?.code;
  }

  Future<void> _pay() async {
    final code = selected;
    if (code == null) return;
    setState(() {
      busy = true;
      error = null;
      status = 'در حال آماده‌سازی پرداخت…';
    });
    try {
      final gateways = await widget.commerce.gateways();
      final hosted = gateways.where((g) => g != 'sandbox').toList();
      final gateway = hosted.isNotEmpty ? hosted.first : 'sandbox';
      final start = await widget.commerce.startTopup(code, gateway: gateway);
      if (start.gateway == 'sandbox') {
        await widget.commerce.completeSandbox(start.paymentId);
      } else {
        final url = start.redirectUrl;
        if (url == null || openExternalUrl == null) {
          throw const ApiException('درگاه پرداخت در این دستگاه در دسترس نیست.');
        }
        await openExternalUrl!(Uri.parse(url));
        setState(() => status = 'پس از پرداخت به برنامه برگرد…');
        // The gateway calls our server; we just wait for the wallet to be credited.
        var credited = false;
        for (var i = 0; i < 90 && mounted && !credited; i++) {
          await Future<void>.delayed(const Duration(seconds: 2));
          credited =
              await widget.commerce.topupStatus(start.paymentId) == 'credited';
        }
        if (!credited) {
          throw const ApiException(
            'پرداخت هنوز تأیید نشده؛ اگه پرداخت کردی چند لحظه بعد موجودی رو ببین.',
          );
        }
      }
      Haptics.success();
      if (mounted) Navigator.pop(context, true);
    } on ApiException catch (e) {
      if (mounted) setState(() => error = e.message);
    } finally {
      if (mounted) {
        setState(() {
          busy = false;
          status = null;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      0,
      20,
      MediaQuery.of(context).viewInsets.bottom + 20,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text('شارژ کیف پول', style: Theme.of(context).textTheme.titleLarge),
        if (widget.need > 0)
          Padding(
            padding: const EdgeInsets.only(top: 4),
            child: Text(
              'برای خرید برنامه ${money(widget.need)} تومان کم داری.',
              style: const TextStyle(color: muted, fontSize: 12),
            ),
          ),
        const SizedBox(height: 14),
        RadioGroup<String>(
          groupValue: selected,
          onChanged: (v) {
            if (!busy) setState(() => selected = v);
          },
          child: Column(
            children: [
              for (final p in widget.packages)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: RadioListTile<String>(
                    value: p.code,
                    enabled: !busy,
                    tileColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),
                      side: BorderSide(
                        color: selected == p.code
                            ? pine
                            : const Color(0xFFDDE5D4),
                      ),
                    ),
                    title: Text('${money(p.amountToman)} تومان'),
                  ),
                ),
            ],
          ),
        ),
        if (status != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              status!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: muted),
            ),
          ),
        if (error != null)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(
              error!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Color(0xFFA02B2B)),
            ),
          ),
        const SizedBox(height: 6),
        FilledButton(
          onPressed: busy || selected == null ? null : _pay,
          child: busy
              ? const SizedBox(
                  width: 22,
                  height: 22,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.4,
                    color: Colors.white,
                  ),
                )
              : const Text('پرداخت'),
        ),
      ],
    ),
  );
}
