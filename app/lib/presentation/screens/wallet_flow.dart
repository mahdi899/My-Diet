import 'weekly_feedback.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../data/wallet_catalog.dart';
import '../session/live_session.dart';
import '../../domain/commerce/commerce.dart';
import '../../core/network/api_client.dart';
import '../../core/theme/theme.dart';
import '../widgets/ui.dart';

const walletPricingRoute = '/wallet/plan-services';

Future<void> openPlanServices(BuildContext context) async {
  final store = DemoScope.of(context);
  if (!store.userSignedIn || !store.questionnaireComplete) {
    Navigator.of(context).popUntil((route) => route.isFirst);
    store.startPlanAcquisition();
    return;
  }
  store.pendingPlanAcquisition = false;
  if (store.walletPricingOpen) return;
  store.journey.record('plan_purchase_started', {
    'serviceId': store.selectedPlanServiceId ?? 'unspecified',
  });
  store.journey.viewScreen('plan_purchase', store.today);
  store.walletPricingOpen = true;
  try {
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        settings: const RouteSettings(name: walletPricingRoute),
        builder: (_) => const PlanServicesScreen(),
      ),
    );
  } finally {
    store.walletPricingOpen = false;
  }
}

class WalletBalanceChip extends StatelessWidget {
  const WalletBalanceChip({super.key});
  @override
  Widget build(BuildContext context) {
    final balance = DemoScope.of(context).walletBalance;
    return Semantics(
      label: 'کیف پول: ${formatMoneyNumber(balance)} تومان',
      button: true,
      child: Material(
        color: sage,
        borderRadius: BorderRadius.circular(22),
        child: InkWell(
          onTap: () => openPlanServices(context),
          borderRadius: BorderRadius.circular(22),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 140),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.account_balance_wallet_outlined,
                    color: amber,
                    size: 20,
                  ),
                  const SizedBox(width: 5),
                  Flexible(
                    child: Text(
                      '${formatMoneyNumber(balance)} تومان',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                        color: pine,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class GetPlanHeroButton extends StatelessWidget {
  const GetPlanHeroButton({super.key});
  @override
  Widget build(BuildContext context) => Semantics(
    button: true,
    child: Surface(
      key: const ValueKey('get-food-plan'),
      color: pine,
      padding: 18,
      onTap: () => openPlanServices(context),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(11),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: .13),
              borderRadius: BorderRadius.circular(15),
            ),
            child: const Icon(
              Icons.restaurant_menu_outlined,
              color: Colors.white,
              size: 27,
            ),
          ),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'دریافت برنامه غذایی',
                  style: TextStyle(
                    fontSize: 19,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                SizedBox(height: 4),
                Text(
                  'انتخاب سرویس و پرداخت از کیف پول',
                  style: TextStyle(fontSize: 10, color: Colors.white70),
                ),
              ],
            ),
          ),
          const Icon(Icons.arrow_back_rounded, color: Colors.white70, size: 21),
        ],
      ),
    ),
  );
}

class WalletDebugPanel extends StatefulWidget {
  const WalletDebugPanel({super.key});
  @override
  State<WalletDebugPanel> createState() => _WalletDebugPanelState();
}

class _WalletDebugPanelState extends State<WalletDebugPanel> {
  final controller = TextEditingController(), form = GlobalKey<FormState>();
  bool initialized = false;
  bool toppingUp = false;

  Future<void> sandboxTopup(DemoStore store) async {
    setState(() => toppingUp = true);
    try {
      final commerce = ensureLiveServices(store).commerce;
      if (!(await commerce.gateways()).contains('sandbox')) {
        throw const ApiException(
          'شارژ تستی فقط به سرور توسعه با درگاه آزمایشی متصل است.',
        );
      }
      final packages = (await commerce.catalog()).topups;
      if (packages.isEmpty)
        throw const ApiException('بستهٔ شارژ آزمایشی موجود نیست.');
      final package = packages.reduce(
        (a, b) => a.amountToman >= b.amountToman ? a : b,
      );
      final payment = await commerce.startTopup(
        package.code,
        gateway: 'sandbox',
      );
      if (payment.gateway != 'sandbox')
        throw const ApiException('درگاه آزمایشی در دسترس نیست.');
      store.walletBalance = (await commerce.completeSandbox(
        payment.paymentId,
      )).total;
      store.update();
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('موجودی آزمایشی اضافه شد.')),
        );
    } catch (error) {
      if (mounted)
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              error is ApiException ? error.message : 'شارژ آزمایشی انجام نشد.',
            ),
          ),
        );
    } finally {
      if (mounted) setState(() => toppingUp = false);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!initialized) {
      controller.text = formatMoneyNumber(DemoScope.of(context).walletBalance);
      initialized = true;
    }
  }

  @override
  void dispose() {
    controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!kDebugMode) return const SizedBox.shrink();
    final s = DemoScope.of(context);
    return Surface(
      padding: 4,
      color: const Color(0xFFFFF8E8),
      child: ExpansionTile(
        key: const ValueKey('wallet-debug'),
        shape: const Border(),
        collapsedShape: const Border(),
        title: const Text('ابزار تست کیف پول', style: TextStyle(fontSize: 12)),
        subtitle: const Text(
          'فقط حالت توسعه',
          style: TextStyle(fontSize: 10, color: muted),
        ),
        leading: const Icon(Icons.tune, size: 21, color: amber),
        children: s.serverAuthEnabled
            ? [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: OutlinedButton(
                    onPressed: toppingUp ? null : () => sandboxTopup(s),
                    child: Text(
                      toppingUp
                          ? 'در حال افزایش موجودی…'
                          : 'افزایش موجودی تستی',
                    ),
                  ),
                ),
              ]
            : [
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Form(
                    key: form,
                    child: Column(
                      children: [
                        TextFormField(
                          key: const ValueKey('wallet-debug-balance'),
                          controller: controller,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(
                            labelText: 'موجودی دلخواه / تومان',
                          ),
                          validator: (v) {
                            final n = int.tryParse(
                              latinDigits(
                                v ?? '',
                              ).replaceAll(RegExp('[,٬]'), '').trim(),
                            );
                            return n == null || n < 0
                                ? 'یک عدد صحیح صفر یا بیشتر وارد کن.'
                                : null;
                          },
                        ),
                        const SizedBox(height: 10),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () {
                                  if (form.currentState!.validate()) {
                                    s.setDebugWalletBalance(
                                      int.parse(
                                        latinDigits(
                                          controller.text,
                                        ).replaceAll(RegExp('[,٬]'), '').trim(),
                                      ),
                                    );
                                    FocusScope.of(context).unfocus();
                                  }
                                },
                                child: const Text('اعمال موجودی'),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: OutlinedButton(
                                onPressed: () {
                                  s.resetWalletDebug();
                                  form.currentState!.reset();
                                  controller.text = formatMoneyNumber(
                                    kInitialWalletBalance,
                                  );
                                },
                                child: const Text('ریست پیش‌فرض'),
                              ),
                            ),
                          ],
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

class PlanServicesScreen extends StatefulWidget {
  const PlanServicesScreen({super.key});
  @override
  State<PlanServicesScreen> createState() => _PlanServicesScreenState();
}

class _PlanServicesScreenState extends State<PlanServicesScreen> {
  bool processing = false, charging = false, dialogAnswered = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final store = DemoScope.of(context);
      if (!store.serverAuthEnabled) return;
      try {
        await syncLiveCatalog(store);
      } on ApiException catch (e) {
        store.liveNotice = e.message;
        store.update();
      }
    });
  }

  Future<void> purchase() async {
    if (processing) return;
    final s = DemoScope.of(context),
        offer = s.serviceById(s.selectedPlanServiceId);
    if (offer == null) return;
    if (offer.id == 'new-plan') {
      setState(() => processing = true);
      try {
        await s.restoreWeeklyFeedback();
        if (!mounted) return;
        if (s.feedbackLoadError != null) {
          showToast(context, s.feedbackLoadError!);
          return;
        }
        if ((s.hasUserRequest && s.userRequest.isPublished) ||
            s.weeklyFeedback.isNotEmpty) {
          final confirmed = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const NextPlanReviewScreen()),
          );
          if (confirmed != true || !mounted) return;
        }
      } finally {
        if (mounted) setState(() => processing = false);
      }
    }
    final includedChange =
        s.serverAuthEnabled &&
        (offer.id == 'ai-change' || offer.id == 'expert-change');
    if (!includedChange && !s.canAfford(offer.priceToman)) {
      charge();
      return;
    }
    setState(() => processing = true);
    try {
      final bool ok;
      if (s.serverAuthEnabled) {
        ok = await buyLiveService(s, offer.id);
      } else {
        ok = s.tryPurchasePlanService(
          offer.id,
          operationId: s.nextWalletOperationId(),
        );
      }
      if (!ok || !mounted) {
        if (mounted && s.liveNotice != null) showToast(context, s.liveNotice!);
        return;
      }
      final balance = s.walletBalance;
      dialogAnswered = false;
      final action = await showDialog<String>(
        context: context,
        barrierDismissible: false,
        builder: (d) => PopScope(
          canPop: false,
          child: AlertDialog(
            icon: const Icon(Icons.check_circle_rounded, color: pine, size: 44),
            title: const Text('خرید با موفقیت انجام شد ✅'),
            content: Text(
              '${offer.successLine}\nموجودی شما ${formatMoneyNumber(balance)} تومان باقی ماند.',
              style: const TextStyle(height: 2),
            ),
            actions: [
              TextButton(
                onPressed: () {
                  if (dialogAnswered) return;
                  dialogAnswered = true;
                  Navigator.pop(d, 'home');
                },
                child: const Text('باشه'),
              ),
              FilledButton(
                onPressed: () {
                  if (dialogAnswered) return;
                  dialogAnswered = true;
                  Navigator.pop(d, 'charge');
                },
                child: const Text('شارژ کیف پول'),
              ),
            ],
          ),
        ),
      );
      if (!mounted) return;
      if (action == 'home') {
        Navigator.of(context).popUntil((r) => r.isFirst);
      } else if (action == 'charge') {
        await charge();
      }
    } finally {
      if (mounted) setState(() => processing = false);
    }
  }

  Future<void> charge() async {
    if (charging) return;
    setState(() => charging = true);
    try {
      await Navigator.of(context).push<void>(
        MaterialPageRoute(
          settings: const RouteSettings(name: '/wallet/charge'),
          builder: (_) => const WalletChargeScreen(),
        ),
      );
    } finally {
      if (mounted) setState(() => charging = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context),
        selected = s.serviceById(s.selectedPlanServiceId),
        balance = s.walletBalance;
    final enough = selected != null && s.canAfford(selected.priceToman);
    return Scaffold(
      appBar: AppBar(title: const Text('تعرفه برنامه‌ها')),
      body: PageBody(
        children: [
          const Heading(
            'قدم بعدی مسیرت را انتخاب کن',
            subtitle: 'هزینهٔ برنامه از موجودی کیف پول کسر می‌شود.',
          ),
          for (final offer in s.serviceOffers)
            _OfferCard(
              key: ValueKey('service-${offer.id}'),
              title: offer.title,
              subtitle: offer.subtitle,
              price: '${formatMoneyNumber(offer.priceToman)} تومان',
              icon: offer.icon,
              selected: selected?.id == offer.id,
              onTap: processing || charging
                  ? null
                  : () {
                      s.selectedPlanServiceId = offer.id;
                      s.update();
                    },
            ),
          if (!s.serverAuthEnabled)
            const Notice(
              'این مسیر کاملاً نمایشی است؛ پولی پرداخت نمی‌شود و درخواستی به سرور ارسال نمی‌شود.',
              icon: Icons.science_outlined,
            ),
          if (kDebugMode) const WalletDebugPanel(),
        ],
      ),
      bottomNavigationBar: _WalletBottom(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (selected == null) ...[
              _BalanceLine(balance: balance),
              const SizedBox(height: 8),
              const Text(
                'برای ادامه یک سرویس انتخاب کن.',
                style: TextStyle(color: muted, fontSize: 11),
              ),
              const SizedBox(height: 10),
              const PrimaryButton(
                'برداشت از کیف پول',
                onPressed: null,
                icon: Icons.account_balance_wallet_outlined,
              ),
            ] else if (enough) ...[
              Text(
                'مبلغ قابل پرداخت: ${formatMoneyNumber(selected.priceToman)} تومان',
                key: const ValueKey('payable-amount'),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 10),
              _BalanceLine(balance: balance, enough: true),
              const SizedBox(height: 12),
              PrimaryButton(
                processing ? 'در حال پردازش…' : 'برداشت از کیف پول',
                onPressed: processing || charging ? null : purchase,
                icon: Icons.account_balance_wallet_outlined,
              ),
            ] else ...[
              Text(
                'مبلغ قابل پرداخت: ${formatMoneyNumber(selected.priceToman)} تومان',
                key: const ValueKey('payable-amount'),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 12),
              PrimaryButton(
                'شارژ کیف پول',
                onPressed: processing || charging ? null : charge,
                icon: Icons.add_card_outlined,
              ),
              const SizedBox(height: 10),
              _BalanceLine(balance: balance, enough: false),
            ],
          ],
        ),
      ),
    );
  }
}

class _WalletBottom extends StatelessWidget {
  const _WalletBottom({required this.child});
  final Widget child;
  @override
  Widget build(BuildContext context) => Material(
    color: Colors.white,
    child: SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 14, 20, 16),
        child: Center(
          heightFactor: 1,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 640),
            child: AnimatedSize(
              duration: const Duration(milliseconds: 180),
              alignment: Alignment.bottomCenter,
              child: child,
            ),
          ),
        ),
      ),
    ),
  );
}

class _BalanceLine extends StatelessWidget {
  const _BalanceLine({required this.balance, this.enough});
  final int balance;
  final bool? enough;
  @override
  Widget build(BuildContext context) => Wrap(
    spacing: 8,
    runSpacing: 7,
    crossAxisAlignment: WrapCrossAlignment.center,
    children: [
      Text(
        'موجودی کیف پول شما: ${formatMoneyNumber(balance)} تومان',
        key: const ValueKey('wallet-balance-line'),
        style: const TextStyle(fontSize: 12, color: muted),
      ),
      if (enough != null)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
          decoration: BoxDecoration(
            color: enough! ? sage : const Color(0xFFFDE9E7),
            borderRadius: BorderRadius.circular(9),
          ),
          child: Text(
            enough! ? 'موجودی کافی' : 'موجودی ناکافی',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: enough! ? pine : const Color(0xFFB13532),
            ),
          ),
        ),
    ],
  );
}

class WalletChargeScreen extends StatefulWidget {
  const WalletChargeScreen({super.key});
  @override
  State<WalletChargeScreen> createState() => _WalletChargeScreenState();
}

class _WalletChargeScreenState extends State<WalletChargeScreen> {
  bool navigating = false, failed = false, loadingPackages = false;
  final customAmount = TextEditingController();
  WalletChargeOffer? customOffer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final store = DemoScope.of(context);
      if (!store.serverAuthEnabled) return;
      setState(() => loadingPackages = true);
      try {
        await syncLiveCatalog(store);
      } on ApiException catch (e) {
        if (mounted) {
          setState(() => failed = true);
          showToast(context, e.message);
        }
      } finally {
        if (mounted) setState(() => loadingPackages = false);
      }
    });
  }

  @override
  void dispose() {
    customAmount.dispose();
    super.dispose();
  }

  Future<void> buy(WalletChargeOffer offer) async {
    if (navigating) return;
    final store = DemoScope.of(context);
    setState(() => navigating = true);
    try {
      if (store.serverAuthEnabled) {
        try {
          final wallet = await settleTopup(
            ensureLiveServices(store).commerce,
            offer.id,
          );
          store.walletBalance = wallet.total;
          store.selectedChargeId = null;
          store.update();
          if (mounted) Navigator.pop(context);
        } on ApiException catch (e) {
          if (mounted) {
            setState(() => failed = true);
            showToast(context, e.message);
          }
        }
        return;
      }
      final result = await Navigator.of(context).push<bool>(
        MaterialPageRoute(
          settings: const RouteSettings(name: '/wallet/mock-payment'),
          builder: (_) => MockPaymentScreen(package: offer),
        ),
      );
      if (!mounted) return;
      if (result == true) {
        Navigator.pop(context);
      } else {
        setState(() => failed = true);
      }
    } finally {
      if (mounted) setState(() => navigating = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    final live = s.serverAuthEnabled;
    final offers = live
        ? [
            for (final package in s.liveTopups)
              WalletChargeOffer(
                id: package.code,
                amountToman: package.amountToman,
                priceToman: package.amountToman,
              ),
          ]
        : walletChargeOffers;
    final WalletChargeOffer? selected;
    if (!live && s.selectedChargeId == 'custom') {
      selected = customOffer;
    } else {
      WalletChargeOffer? match;
      for (final offer in offers) {
        if (offer.id == s.selectedChargeId) match = offer;
      }
      selected = match;
    }
    return Scaffold(
      appBar: AppBar(title: const Text('شارژ کیف پول')),
      body: PageBody(
        children: [
          Surface(
            color: sage,
            child: Row(
              children: [
                const Icon(Icons.savings_outlined, color: pine, size: 30),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'موجودی فعلی کیف پول',
                        style: TextStyle(fontSize: 12, color: muted),
                      ),
                      Text(
                        '${formatMoneyNumber(s.walletBalance)} تومان',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.bold,
                          color: pine,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Heading('مبلغ شارژ را انتخاب کن'),
          if (!live)
            TextField(
              key: const ValueKey('custom-charge'),
              controller: customAmount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'مبلغ دلخواه / تومان',
                hintText: 'مثلاً ۵۰۰۰۰۰',
              ),
              onChanged: (value) {
                final n = int.tryParse(
                  latinDigits(value).replaceAll(',', '').replaceAll('٬', ''),
                );
                setState(() {
                  customOffer = n != null && n > 0 && n <= 100000000
                      ? WalletChargeOffer(
                          id: 'custom',
                          amountToman: n,
                          priceToman: n,
                        )
                      : null;
                  s.selectedChargeId = 'custom';
                });
              },
            ),
          if (live && loadingPackages)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (failed)
            Container(
              key: const ValueKey('mock-payment-error'),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFFFDE9E7),
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Text(
                'پرداخت ناموفق بود یا لغو شد. موجودی تغییری نکرد؛ می‌توانی دوباره تلاش کنی.',
                style: TextStyle(
                  color: Color(0xFFB13532),
                  fontSize: 12,
                  height: 1.8,
                ),
              ),
            ),
          for (final offer in offers)
            _OfferCard(
              key: ValueKey('package-${offer.id}'),
              title: '${formatMoneyNumber(offer.amountToman)} تومان',
              subtitle: 'اعتبار قابل استفاده برای سرویس‌های برنامه غذایی',
              price: 'انتخاب مبلغ',
              icon: Icons.account_balance_wallet_outlined,
              selected: selected?.id == offer.id,
              onTap: navigating
                  ? null
                  : () {
                      s.selectedChargeId = offer.id;
                      s.update();
                      setState(() => failed = false);
                    },
            ),
          if (!live)
            const Text(
              'قیمت‌ها برای نمایش فلو هستند و خرید واقعی انجام نمی‌شود.',
              style: TextStyle(color: muted, fontSize: 11),
            ),
        ],
      ),
      bottomNavigationBar: _WalletBottom(
        child: PrimaryButton(
          'شارژ کیف پول',
          onPressed: selected == null || navigating || loadingPackages
              ? null
              : () => buy(selected!),
          icon: Icons.shopping_cart_checkout_outlined,
        ),
      ),
    );
  }
}

class MockPaymentScreen extends StatefulWidget {
  const MockPaymentScreen({super.key, required this.package});
  final WalletChargeOffer package;
  @override
  State<MockPaymentScreen> createState() => _MockPaymentScreenState();
}

class _MockPaymentScreenState extends State<MockPaymentScreen> {
  bool busy = false, acknowledged = false;
  String? attempt;
  Future<void> complete(bool success) async {
    if (busy) return;
    setState(() => busy = true);
    final s = DemoScope.of(context);
    if (!success) {
      Navigator.pop(context, false);
      return;
    }
    attempt ??= s.nextWalletOperationId();
    final credited = s.addWalletCredit(
      widget.package.priceToman,
      operationId: attempt!,
    );
    if (!credited) {
      if (mounted) {
        setState(() => busy = false);
        showToast(context, 'این پرداخت قبلاً ثبت شده است.');
      }
      return;
    }
    final balance = s.walletBalance;
    await showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (d) => PopScope(
        canPop: false,
        child: AlertDialog(
          icon: const Icon(Icons.check_circle_rounded, color: pine, size: 44),
          title: const Text('خرید با موفقیت انجام شد ✅'),
          content: Text(
            'موجودی کیف پول شما ${formatMoneyNumber(balance)} تومان است.',
            style: const TextStyle(height: 2),
          ),
          actions: [
            FilledButton(
              onPressed: () {
                if (acknowledged) return;
                acknowledged = true;
                Navigator.pop(d);
              },
              child: const Text('باشه'),
            ),
          ],
        ),
      ),
    );
    if (mounted) Navigator.pop(context, true);
  }

  @override
  Widget build(BuildContext context) => PopScope(
    canPop: !busy,
    child: Scaffold(
      appBar: AppBar(title: const Text('درگاه پرداخت نمایشی')),
      body: PageBody(
        children: [
          const Notice(
            'شبیه‌ساز پرداخت · اطلاعات بانکی وارد نکن. فیلدها فقط ظاهری‌اند و هیچ پولی جابه‌جا نمی‌شود.',
            icon: Icons.science_outlined,
          ),
          Surface(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Row(
                  children: [
                    Icon(Icons.account_balance_outlined, color: pine),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'پرداخت نمونهٔ رژیم من',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 17,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                InfoRows({
                  'پکیج انتخابی': 'شارژ کیف پول',
                  'مبلغ پرداختی': formatToman(widget.package.priceToman),
                  'پذیرنده': 'رژیم من · نسخهٔ آزمایشی',
                }),
              ],
            ),
          ),
          const _PaymentField('شماره کارت', '۶۰۳۷ ـ ۰۰۰۰ ـ ۰۰۰۰ ـ ۱۲۳۴'),
          const Row(
            children: [
              Expanded(child: _PaymentField('CVV2', '۱۲۳')),
              SizedBox(width: 12),
              Expanded(child: _PaymentField('تاریخ انقضا', '۰۸ / ۱۴۰۶')),
            ],
          ),
          const _PaymentField('رمز دوم', '••••••'),
          Surface(
            padding: 14,
            child: Row(
              children: [
                const Expanded(child: _PaymentField('کپچا', '۴۵۲۹')),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 14,
                  ),
                  decoration: BoxDecoration(
                    color: sage,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Text(
                    '۴ ۵ ۲ ۹',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: pine,
                      letterSpacing: 3,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Text(
            'برای بررسی مسیر، یکی از نتیجه‌های زیر را انتخاب کن.',
            style: TextStyle(fontSize: 11, color: muted),
          ),
        ],
      ),
      bottomNavigationBar: _WalletBottom(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            PrimaryButton(
              busy ? 'در حال ثبت…' : 'پرداخت موفق',
              onPressed: busy ? null : () => complete(true),
              icon: Icons.check_circle_outline,
            ),
            const SizedBox(height: 8),
            OutlinedButton(
              onPressed: busy ? null : () => complete(false),
              child: const Text('پرداخت ناموفق / انصراف'),
            ),
          ],
        ),
      ),
    ),
  );
}

class _PaymentField extends StatelessWidget {
  const _PaymentField(this.label, this.placeholder);
  final String label, placeholder;
  @override
  Widget build(BuildContext context) => TextField(
    readOnly: true,
    textDirection: TextDirection.ltr,
    textAlign: TextAlign.left,
    showCursor: false,
    enableInteractiveSelection: false,
    keyboardType: TextInputType.none,
    decoration: InputDecoration(
      labelText: label,
      hintText: placeholder,
      hintTextDirection: TextDirection.ltr,
      floatingLabelBehavior: FloatingLabelBehavior.always,
    ),
  );
}

class _OfferCard extends StatelessWidget {
  const _OfferCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.price,
    required this.icon,
    required this.selected,
    required this.onTap,
  });
  final String title, subtitle, price;
  final IconData icon;
  final bool selected;
  final VoidCallback? onTap;
  @override
  Widget build(BuildContext context) => Semantics(
    selected: selected,
    button: true,
    child: AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(22),
        border: Border.all(
          color: selected ? pine : const Color(0xFFE4EAD9),
          width: selected ? 2 : 1,
        ),
        boxShadow: selected
            ? [
                BoxShadow(
                  color: pine.withValues(alpha: .08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ]
            : null,
      ),
      child: Material(
        color: selected ? const Color(0xFFF1F7E9) : Colors.white,
        borderRadius: BorderRadius.circular(21),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  backgroundColor: selected ? pine : sage,
                  child: Icon(
                    icon,
                    color: selected ? Colors.white : pine,
                    size: 22,
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
                          fontSize: 15,
                          height: 1.7,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: const TextStyle(
                          fontSize: 10,
                          color: muted,
                          height: 1.8,
                        ),
                      ),
                      const SizedBox(height: 9),
                      Text(
                        price,
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          color: pine,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Icon(
                  selected
                      ? Icons.radio_button_checked
                      : Icons.radio_button_off,
                  color: selected ? pine : const Color(0xFFB6C1AD),
                  size: 22,
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
