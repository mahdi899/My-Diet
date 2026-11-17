import 'dart:async';
import '../../core/motion/motion.dart';
import 'package:flutter/material.dart';
import '../../domain/common/failure.dart';
import '../../data/day.dart';
import '../../data/demo_store.dart';
import '../../data/wallet_catalog.dart';
import '../../domain/commerce/commerce.dart';
import '../../core/theme/theme.dart';
import '../session/live_session.dart';
import '../widgets/operation_status.dart';
import '../widgets/ui.dart';
import '../widgets/brand_scene.dart';
import '../widgets/subscription_plan_card.dart';
import 'weekly_feedback.dart';
import 'payment_recovery_view.dart';
import 'messaging.dart';

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
    final content = Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'اشتراک فعلی',
          style: TextStyle(color: Color(0xFFE7EFD8), fontSize: 12, height: 1.7),
        ),
        const SizedBox(height: 6),
        Wrap(
          spacing: 10,
          runSpacing: 6,
          crossAxisAlignment: WrapCrossAlignment.center,
          children: [
            Text(
              subscription?.title ?? 'بدون اشتراک فعال',
              style: const TextStyle(
                color: Color(0xFFFFFCF0),
                fontSize: 22,
                height: 1.5,
                fontWeight: FontWeight.bold,
              ),
            ),
            if (subscription != null)
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: active
                      ? const Color(0xFFE4F1CC)
                      : const Color(0xFFFFECCD),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  active ? 'فعال' : 'پایان یافته',
                  style: const TextStyle(
                    color: Color(0xFF07543A),
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
          ],
        ),
        const SizedBox(height: 8),
        if (subscription == null)
          const Text(
            'هنوز اشتراک فعالی نداری. با انتخاب و پرداخت پلن، اشتراکت فعال می‌شود.',
            style: TextStyle(
              color: Color(0xFFE7EFD8),
              height: 1.8,
              fontSize: 12,
            ),
          )
        else if (subscription.endsAt != null)
          Text(
            'اعتبار تا ${persianDate(subscription.endsAt!.toUtc().add(const Duration(hours: 3, minutes: 30)), year: true)}',
            style: const TextStyle(
              color: Color(0xFFE7EFD8),
              height: 1.8,
              fontSize: 11,
            ),
          ),
        if (active && store.hasUserRequest) ...[
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: const Color(0xFFD6ECC0),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Text(
              store.userRequest.status.label,
              style: const TextStyle(
                color: Color(0xFF07543A),
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ],
    );
    return Material(
      key: const ValueKey('subscription-summary'),
      color: const Color(0xFF07543A),
      borderRadius: BorderRadius.circular(26),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact =
                constraints.maxWidth < 280 ||
                MediaQuery.textScalerOf(context).scale(14) > 18;
            if (compact) return content;
            return Row(
              children: [
                Expanded(child: content),
                const SizedBox(width: 8),
                BrandScene(
                  kind: BrandSceneKind.companion,
                  width: compact ? 64 : 104,
                  height: compact ? 92 : 126,
                ),
              ],
            );
          },
        ),
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
  bool processing = false, loading = false, _viewCatalog = false;
  String? error;
  String errorKind = 'payment';
  final _scroll = ScrollController();
  final _errorAnchor = GlobalKey();
  final _waitingAnchor = GlobalKey();

  @override
  void dispose() {
    _scroll.dispose();
    super.dispose();
  }

  void _reveal(GlobalKey key) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final target = key.currentContext;
      if (!mounted || target == null) return;
      unawaited(
        Scrollable.ensureVisible(
          target,
          alignment: .1,
          duration: Motion.of(context, Motion.quick),
          curve: Curves.easeOut,
        ),
      );
    });
  }

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
      errorKind = 'catalog';
    });
    try {
      await syncLiveCatalog(store);
    } on AppFailure catch (failure) {
      if (mounted) setState(() => error = failure.message);
    } catch (_) {
      if (mounted) {
        setState(
          () => error =
              'اطلاعات پلن‌ها دریافت نشد؛ اتصال را بررسی کن و دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) {
        setState(() => loading = false);
        if (error != null) _reveal(_errorAnchor);
      }
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
      setState(() {
        errorKind = 'request';
        error =
            'درخواست برنامهٔ فعلی در حال بررسی است؛ وضعیت را در تب برنامه ببین.';
      });
      _reveal(_errorAnchor);
      return;
    }
    setState(() {
      processing = true;
      _viewCatalog = false;
      error = null;
      errorKind = 'payment';
    });
    _reveal(_waitingAnchor);
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
          onFailure: (failure) =>
              errorKind = failure.code == 'payment_pending' || failure.offline
              ? 'pending'
              : 'payment',
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
              '${offer.successLine}\n${store.hasUserRequest && store.userRequest.isPublished ? 'برنامهٔ تأییدشده در تب برنامه در دسترس است.' : 'فعال‌شدن پلن به معنی تأیید برنامهٔ غذایی نیست؛ وضعیت بررسی و انتشار را در تب برنامه ببین.'}\n${store.liveNotice ?? 'جزئیات اشتراکت در پروفایل در دسترس است.'}',
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
    } catch (_) {
      if (mounted) {
        setState(() {
          errorKind = 'pending';
          error =
              'نتیجهٔ درخواست دریافت نشد. برای بررسی نتیجه دوباره ادامه بده.';
        });
      }
    } finally {
      if (mounted) {
        setState(() => processing = false);
        if (error != null) _reveal(_errorAnchor);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final catalogReady =
        !store.serverAuthEnabled || store.liveServiceOffers != null;
    final selected = selectedOffer(store);
    final selectionLocked =
        processing ||
        loading ||
        (store.serverAuthEnabled && store.liveOrderKey != null);
    final covered = selected != null && included(store, selected);
    final eligible =
        selected == null || selected.id == 'new-plan' || store.hasUserRequest;
    final recovering =
        !_viewCatalog &&
        !processing &&
        !loading &&
        selected != null &&
        error != null &&
        (errorKind == 'payment' || errorKind == 'pending');
    final selectedPlan = store.subscriptionOffers
        .where((p) => p.id == store.selectedSubscriptionPlanId)
        .firstOrNull;
    return PopScope(
      canPop: !processing,
      child: Scaffold(
        backgroundColor: const Color(0xFFFBF9F3),
        appBar: AppBar(
          backgroundColor: const Color(0xFFFBF9F3),
          surfaceTintColor: Colors.transparent,
          foregroundColor: const Color(0xFF07543A),
          centerTitle: recovering,
          title: Text(recovering ? 'پرداخت' : 'پلن‌ها و اشتراک من'),
        ),
        body: recovering
            ? PaymentRecoveryView(
                key: const ValueKey('payment-error'),
                planTitle: selected.title,
                days: selected.id == 'new-plan' ? selectedPlan?.days : null,
                amount: formatToman(covered ? 0 : selected.priceToman),
                message: error!,
                pending: errorKind == 'pending',
                onRetry: purchase,
                onBack: () => setState(() {
                  _viewCatalog = true;
                  if (errorKind != 'pending') error = null;
                }),
                onSupport: () => Navigator.of(context).push<void>(
                  MaterialPageRoute(
                    builder: (_) => const MessagingScreen(
                      threadId: 'support-main',
                      support: true,
                    ),
                  ),
                ),
              )
            : PageBody(
                padding: 16,
                spacing: 12,
                controller: _scroll,
                children: [
                  if (loading)
                    const OperationStatus(
                      title: 'در حال دریافت پلن‌ها',
                      message: 'قیمت و جزئیات پلن‌ها از سرور دریافت می‌شود.',
                      icon: Icons.cloud_download_outlined,
                    ),
                  if (processing)
                    KeyedSubtree(
                      key: _waitingAnchor,
                      child: const OperationStatus(
                        key: ValueKey('payment-processing'),
                        title: 'منتظر نتیجهٔ پرداخت هستیم',
                        message:
                            'اگر درگاه را باز کرده‌ای، پرداخت را آنجا کامل کن. فعال‌سازی فقط پس از تأیید نتیجه انجام می‌شود.',
                        icon: Icons.payments_outlined,
                        child: OperationPath(
                          labels: [
                            'درخواست و انجام پرداخت',
                            'تأیید نتیجه و فعال‌سازی',
                          ],
                          current: 0,
                        ),
                      ),
                    ),
                  const SubscriptionSummaryCard(),
                  const Heading(
                    'پلن مناسب تو',
                    subtitle: 'برنامه پس از بررسی و تأیید متخصص منتشر می‌شود.',
                  ),
                  for (final plan
                      in catalogReady
                          ? store.subscriptionOffers
                          : <SubscriptionPlanOffer>[])
                    SubscriptionPlanCard(
                      key: ValueKey('plan-${plan.id}'),
                      plan: plan,
                      selected:
                          store.selectedPlanServiceId == 'new-plan' &&
                          store.selectedSubscriptionPlanId == plan.id,
                      onSelect: selectionLocked
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
                          ? store.serviceOffers.where(
                              (item) => item.id != 'new-plan',
                            )
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
                      onTap: selectionLocked
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
                  if (error != null)
                    KeyedSubtree(
                      key: _errorAnchor,
                      child: OperationStatus(
                        key: const ValueKey('payment-error'),
                        title: errorKind == 'catalog'
                            ? 'دریافت پلن‌ها کامل نشد'
                            : errorKind == 'pending'
                            ? 'نتیجهٔ پرداخت هنوز مشخص نیست'
                            : errorKind == 'request'
                            ? 'درخواستت در حال بررسی است'
                            : 'پرداخت تکمیل نشد',
                        message: error!,
                        icon: errorKind == 'pending'
                            ? Icons.hourglass_top_rounded
                            : Icons.info_outline_rounded,
                        tone: errorKind == 'pending' || errorKind == 'request'
                            ? OperationTone.attention
                            : OperationTone.error,
                        actionLabel: errorKind == 'catalog'
                            ? 'دریافت دوبارهٔ اطلاعات'
                            : errorKind == 'pending'
                            ? 'بررسی نتیجهٔ پرداخت'
                            : errorKind == 'request'
                            ? 'بازگشت به برنامه'
                            : 'تلاش دوباره برای پرداخت',
                        onAction: processing || loading
                            ? null
                            : errorKind == 'catalog'
                            ? load
                            : errorKind == 'request'
                            ? () => Navigator.of(
                                context,
                              ).popUntil((route) => route.isFirst)
                            : purchase,
                      ),
                    ),
                  if (!store.serverAuthEnabled)
                    const Notice(
                      'نسخهٔ نمایشی؛ پرداخت واقعی انجام نمی‌شود.',
                      icon: Icons.science_outlined,
                    ),
                ],
              ),
        bottomNavigationBar: recovering
            ? null
            : _PaymentBottom(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (selected == null)
                      const Text(
                        'برای ادامه یک پلن انتخاب کن.',
                        key: ValueKey('payable-amount'),
                        style: TextStyle(
                          color: AppColors.inkSoft,
                          fontSize: 13,
                        ),
                      )
                    else
                      Wrap(
                        alignment: WrapAlignment.spaceBetween,
                        crossAxisAlignment: WrapCrossAlignment.center,
                        spacing: 12,
                        runSpacing: 6,
                        children: [
                          Text(
                            selected.id == 'new-plan' && selectedPlan != null
                                ? 'پلن ${selectedPlan.title} · ${fa(selectedPlan.days)} روزه'
                                : selected.title,
                            key: const ValueKey('checkout-selection'),
                            style: const TextStyle(
                              color: Color(0xFF07543A),
                              fontSize: 13,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          Text(
                            formatToman(covered ? 0 : selected.priceToman),
                            key: const ValueKey('payable-amount'),
                            style: const TextStyle(
                              color: Color(0xFF07543A),
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              fontFeatures: [FontFeature.tabularFigures()],
                            ),
                          ),
                        ],
                      ),
                    const SizedBox(height: 12),
                    FilledButtonTheme(
                      data: FilledButtonThemeData(
                        style: FilledButton.styleFrom(
                          backgroundColor: const Color(0xFF07543A),
                          foregroundColor: const Color(0xFFFFFCF0),
                          minimumSize: const Size(0, 52),
                          padding: const EdgeInsets.symmetric(
                            horizontal: 14,
                            vertical: 14,
                          ),
                          textStyle: AppTypography.button.copyWith(
                            fontSize: 14,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      ),
                      child: PrimaryButton(
                        processing
                            ? 'در حال بررسی پرداخت…'
                            : error != null && errorKind == 'pending'
                            ? 'بررسی نتیجهٔ پرداخت'
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
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      side: BorderSide(color: Color(0xFFE5E7DD)),
    ),
    clipBehavior: Clip.antiAlias,
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
