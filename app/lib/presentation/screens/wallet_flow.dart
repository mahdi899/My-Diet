import 'package:flutter/material.dart';
import '../../domain/common/failure.dart';
import '../../data/day.dart';
import '../../data/demo_store.dart';
import '../../data/wallet_catalog.dart';
import '../../domain/commerce/commerce.dart';
import '../../core/theme/theme.dart';
import '../session/live_session.dart';
import '../widgets/ui.dart';
import 'weekly_feedback.dart';

const planServicesRoute = '/plans/subscription';

Future<void> openPlanServices(
  BuildContext context, {
  bool browseOnly = false,
}) async {
  final store = DemoScope.of(context);
  if (!store.userSignedIn || (!browseOnly && !store.questionnaireComplete)) {
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
        settings: const RouteSettings(name: planServicesRoute),
        builder: (_) => const PlanServicesScreen(),
      ),
    );
  } finally {
    store.walletPricingOpen = false;
  }
}

class PlanSubscriptionChip extends StatelessWidget {
  const PlanSubscriptionChip({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    return ActionChip(
      avatar: const Icon(
        Icons.workspace_premium_outlined,
        color: pine,
        size: 19,
      ),
      label: Text(
        store.planSubscription?.activeAt(store.today) == true
            ? 'اشتراک من'
            : 'پلن‌ها',
      ),
      onPressed: () => openPlanServices(context, browseOnly: true),
    );
  }
}

class GetPlanHeroButton extends StatelessWidget {
  const GetPlanHeroButton({super.key});
  @override
  Widget build(BuildContext context) => Surface(
    key: const ValueKey('get-food-plan'),
    color: pine,
    padding: 18,
    onTap: () => openPlanServices(context),
    child: const Row(
      children: [
        Icon(Icons.restaurant_menu_outlined, color: Colors.white, size: 30),
        SizedBox(width: 12),
        Expanded(
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
                'انتخاب پلن و پرداخت مستقیم',
                style: TextStyle(fontSize: 11, color: Colors.white70),
              ),
            ],
          ),
        ),
        Icon(Icons.arrow_back_rounded, color: Colors.white70, size: 21),
      ],
    ),
  );
}

class SubscriptionSummaryCard extends StatelessWidget {
  const SubscriptionSummaryCard({super.key});
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final subscription = store.planSubscription;
    final active = subscription?.activeAt(store.today) == true;
    return Surface(
      key: const ValueKey('subscription-summary'),
      color: sage,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Heading('اشتراک من'),
          const SizedBox(height: 10),
          if (subscription == null)
            const Text(
              'هنوز اشتراک فعالی نداری. با انتخاب و پرداخت پلن، اشتراکت فعال می‌شود.',
              style: TextStyle(height: 1.8),
            )
          else ...[
            Row(
              children: [
                Expanded(
                  child: Text(
                    subscription.title,
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
                Tag(active ? 'فعال' : 'پایان یافته'),
              ],
            ),
            if (subscription.endsAt != null) ...[
              const SizedBox(height: 8),
              Text(
                'اعتبار تا ${persianDate(subscription.endsAt!.toUtc().add(const Duration(hours: 3, minutes: 30)), year: true)}',
                style: const TextStyle(color: muted, fontSize: 12),
              ),
            ],
            if (active && store.hasUserRequest) ...[
              const SizedBox(height: 8),
              Text(
                store.userRequest.status.label,
                style: const TextStyle(color: pine, fontSize: 12),
              ),
            ],
          ],
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
  bool processing = false, loading = false;
  String? error;

  bool included(DemoStore store, PlanServiceOffer offer) =>
      store.serverAuthEnabled &&
      offer.id != 'new-plan' &&
      store.planSubscription?.activeAt(store.today) == true &&
      store.planSubscription?.includedChanges == true;

  PlanServiceOffer? selectedOffer(DemoStore store) =>
      store.selectedPlanServiceId == 'new-plan'
      ? store.subscriptionServiceById(store.selectedSubscriptionPlanId)
      : store.serviceById(store.selectedPlanServiceId);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => load());
  }

  Future<void> load() async {
    final store = DemoScope.of(context);
    if (!store.serverAuthEnabled || !store.userSignedIn) return;
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await syncLiveCatalog(store);
    } on AppFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<bool> confirmPayment(PlanServiceOffer offer) async {
    if (!mounted) return false;
    return await Navigator.of(context).push<bool>(
          MaterialPageRoute(builder: (_) => PlanPaymentScreen(offer: offer)),
        ) ==
        true;
  }

  Future<void> purchase() async {
    if (processing || loading) return;
    final store = DemoScope.of(context);
    final offer = selectedOffer(store);
    if (offer == null) return;
    if (!store.userSignedIn || !store.questionnaireComplete) {
      Navigator.of(context).popUntil((route) => route.isFirst);
      store.startPlanAcquisition();
      return;
    }
    if (store.hasUserRequest &&
        !store.userRequest.isPublished &&
        offer.id == 'new-plan') {
      setState(() => error = 'درخواست برنامهٔ فعلی در حال بررسی است.');
      return;
    }
    setState(() {
      processing = true;
      error = null;
    });
    try {
      if (offer.id == 'new-plan') {
        await store.restoreWeeklyFeedback();
        if (!mounted) return;
        if (store.feedbackLoadError != null) {
          setState(() => error = store.feedbackLoadError);
          return;
        }
        if ((store.hasUserRequest && store.userRequest.isPublished) ||
            store.weeklyFeedback.isNotEmpty) {
          final confirmed = await Navigator.of(context).push<bool>(
            MaterialPageRoute(builder: (_) => const NextPlanReviewScreen()),
          );
          if (confirmed != true || !mounted) return;
        }
      }
      final bool paid;
      if (store.serverAuthEnabled) {
        paid = await checkoutLiveService(
          store,
          offer.id,
          confirmSandbox: () => confirmPayment(offer),
          planId: offer.id == 'new-plan'
              ? store.selectedSubscriptionPlanId
              : null,
        );
      } else {
        final paymentId = newIdempotencyKey();
        paid =
            await confirmPayment(offer) &&
            store.activateMockPlan(
              offer.id,
              paymentId,
              planId: offer.id == 'new-plan'
                  ? store.selectedSubscriptionPlanId
                  : null,
            );
      }
      if (!mounted) return;
      if (!paid) {
        setState(
          () => error = store.liveNotice ?? 'پرداخت لغو شد؛ پلنی فعال نشد.',
        );
        return;
      }
      await showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (dialog) => PopScope(
          canPop: false,
          child: AlertDialog(
            icon: const Icon(Icons.check_circle_rounded, color: pine, size: 44),
            title: const Text('پلن با موفقیت فعال شد'),
            content: Text(
              '${offer.successLine}\nجزئیات اشتراکت در پروفایل در دسترس است.',
              style: const TextStyle(height: 1.8),
            ),
            actions: [
              FilledButton(
                onPressed: () => Navigator.pop(dialog),
                child: const Text('ورود به برنامه'),
              ),
            ],
          ),
        ),
      );
      if (mounted) Navigator.of(context).popUntil((route) => route.isFirst);
    } on AppFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } finally {
      if (mounted) setState(() => processing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final catalogReady =
        !store.serverAuthEnabled || store.liveServiceOffers != null;
    final selected = selectedOffer(store);
    final covered = selected != null && included(store, selected);
    final eligible =
        selected == null || selected.id == 'new-plan' || store.hasUserRequest;
    return PopScope(
      canPop: !processing,
      child: Scaffold(
        appBar: AppBar(title: const Text('پلن‌ها و اشتراک من')),
        body: PageBody(
          children: [
            if (loading)
              const LinearProgressIndicator(semanticsLabel: 'دریافت پلن‌ها'),
            const SubscriptionSummaryCard(),
            const Heading(
              'پلن‌ها و تعرفه‌ها',
              subtitle:
                  'پلنت را انتخاب کن؛ پس از تأیید پرداخت وارد برنامه می‌شوی.',
            ),
            for (final plan
                in catalogReady
                    ? store.subscriptionOffers
                    : <SubscriptionPlanOffer>[])
              _OfferCard(
                key: ValueKey('plan-${plan.id}'),
                title: 'پلن ${plan.title} · ${fa(plan.days)} روزه',
                subtitle:
                    '${plan.description}${store.selectedPlanServiceId == 'new-plan' && store.selectedSubscriptionPlanId == plan.id ? '\n• ${plan.features.join('\n• ')}' : ''}',
                price: formatToman(plan.priceToman),
                icon: Icons.workspace_premium_outlined,
                selected:
                    store.selectedPlanServiceId == 'new-plan' &&
                    store.selectedSubscriptionPlanId == plan.id,
                onTap: processing || loading
                    ? null
                    : () {
                        store.selectedPlanServiceId = 'new-plan';
                        store.selectedSubscriptionPlanId = plan.id;
                        store.update();
                      },
              ),
            if (store.hasUserRequest && store.userRequest.isPublished)
              const Heading('خدمات برنامهٔ فعلی'),
            for (final offer
                in catalogReady &&
                        store.hasUserRequest &&
                        store.userRequest.isPublished
                    ? store.serviceOffers.where((item) => item.id != 'new-plan')
                    : <PlanServiceOffer>[])
              _OfferCard(
                key: ValueKey('service-${offer.id}'),
                title: offer.title,
                subtitle: offer.subtitle,
                price: included(store, offer)
                    ? 'شامل اشتراک فعال شما'
                    : formatToman(offer.priceToman),
                icon: offer.icon,
                selected: selected?.id == offer.id,
                onTap: processing || loading
                    ? null
                    : () {
                        store.selectedPlanServiceId = offer.id;
                        store.update();
                      },
              ),
            if (!eligible)
              const Notice(
                'برای تغییر برنامه، ابتدا پلن برنامهٔ غذایی را فعال کن.',
              ),
            if (error != null) ...[
              Notice(error!, icon: Icons.info_outline),
              if (store.serverAuthEnabled)
                TextButton(
                  onPressed: processing || loading ? null : load,
                  child: const Text('دریافت دوبارهٔ اطلاعات'),
                ),
            ],
            if (!store.serverAuthEnabled)
              const Notice(
                'نسخهٔ نمایشی؛ پرداخت واقعی انجام نمی‌شود.',
                icon: Icons.science_outlined,
              ),
          ],
        ),
        bottomNavigationBar: _PaymentBottom(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                selected == null
                    ? 'برای ادامه یک پلن انتخاب کن.'
                    : 'مبلغ قابل پرداخت: ${formatToman(covered ? 0 : selected.priceToman)}',
                key: const ValueKey('payable-amount'),
                style: const TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
              const SizedBox(height: 12),
              PrimaryButton(
                processing
                    ? 'در حال بررسی پرداخت…'
                    : covered
                    ? 'استفاده از اشتراک'
                    : 'پرداخت و فعال‌سازی پلن',
                onPressed:
                    selected == null ||
                        !eligible ||
                        processing ||
                        loading ||
                        !catalogReady
                    ? null
                    : purchase,
                icon: Icons.payment_outlined,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class PlanPaymentScreen extends StatefulWidget {
  const PlanPaymentScreen({super.key, required this.offer});
  final PlanServiceOffer offer;
  @override
  State<PlanPaymentScreen> createState() => _PlanPaymentScreenState();
}

class _PlanPaymentScreenState extends State<PlanPaymentScreen> {
  bool answered = false;
  void complete(bool success) {
    if (answered) return;
    answered = true;
    Navigator.pop(context, success);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('پرداخت آزمایشی پلن')),
    body: PageBody(
      children: [
        const Notice(
          'این پرداخت آزمایشی است و پول واقعی جابه‌جا نمی‌شود.',
          icon: Icons.science_outlined,
        ),
        Surface(
          child: InfoRows({
            'پلن انتخابی': widget.offer.title,
            'مبلغ پرداختی': formatToman(widget.offer.priceToman),
          }),
        ),
        const Text(
          'برای بررسی مسیر خرید، نتیجهٔ پرداخت را انتخاب کن.',
          style: TextStyle(height: 1.8),
        ),
      ],
    ),
    bottomNavigationBar: _PaymentBottom(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          PrimaryButton(
            'پرداخت موفق',
            onPressed: () => complete(true),
            icon: Icons.check_circle_outline,
          ),
          const SizedBox(height: 8),
          OutlinedButton(
            onPressed: () => complete(false),
            child: const Text('پرداخت ناموفق / انصراف'),
          ),
        ],
      ),
    ),
  );
}

class _PaymentBottom extends StatelessWidget {
  const _PaymentBottom({required this.child});
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
            child: child,
          ),
        ),
      ),
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
