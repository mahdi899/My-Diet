import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../data/day.dart';
import '../widgets/ui.dart';
import 'questionnaire.dart';

class WeeklyFeedbackScreen extends StatefulWidget {
  const WeeklyFeedbackScreen({super.key});
  @override
  State<WeeklyFeedbackScreen> createState() => _WeeklyFeedbackScreenState();
}

class _WeeklyFeedbackScreenState extends State<WeeklyFeedbackScreen> {
  final favorite = <String>{}, disliked = <String>{}, difficult = <String>{};
  final comment = TextEditingController(), publicText = TextEditingController();
  String? availability, budget, portion, service, error;
  int rating = 5;
  bool consent = false, loading = true, started = false, busy = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (started) return;
    started = true;
    final store = DemoScope.of(context);
    store.restoreWeeklyFeedback().whenComplete(() {
      if (mounted) setState(() => loading = false);
    });
  }

  @override
  void dispose() {
    comment.dispose();
    publicText.dispose();
    super.dispose();
  }

  Future<void> save(DemoStore store, DietRequest request) async {
    if (busy) return;
    if ([availability, budget, portion, service].contains(null) ||
        (consent && publicText.text.trim().isEmpty)) {
      setState(
        () => error =
            'پرسش‌های انتخابی و در صورت رضایت، متن نظر عمومی را تکمیل کن.',
      );
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await store.saveWeeklyFeedback(
        WeeklyFeedback(
          owner: store.feedbackOwner,
          requestId: request.id,
          planVersion: request.version,
          week: dateKey(request.programWeek!),
          at: store.today,
          meals: store.feedbackMeals(request),
          favorite: favorite.toList(),
          disliked: disliked.toList(),
          difficult: difficult.toList(),
          availability: availability!,
          budget: budget!,
          portion: portion!,
          service: service!,
          rating: service == 'not_used' ? 0 : rating,
          comment: comment.text.trim(),
          publicConsent: consent,
          publicText: consent ? publicText.text.trim() : '',
        ),
      );
      if (mounted) showToast(context, 'بازخورد در نسخهٔ نمایشی ذخیره شد.');
    } catch (_) {
      if (mounted) {
        setState(
          () => error = 'ذخیره انجام نشد؛ پاسخ‌ها حفظ شدند. دوباره تلاش کن.',
        );
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget choices(
    String title,
    Map<String, String> options,
    String? value,
    ValueChanged<String> update,
  ) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      Heading(title),
      Wrap(
        spacing: 8,
        children: [
          for (final e in options.entries)
            ChoiceChip(
              label: Text(e.value),
              selected: value == e.key,
              onSelected: busy ? null : (_) => setState(() => update(e.key)),
            ),
        ],
      ),
    ],
  );
  Widget meals(
    String title,
    List<FeedbackMeal> meals,
    Set<String> selected, {
    Set<String>? opposing,
  }) => ExpansionTile(
    title: Text(title),
    subtitle: Text('${fa(selected.length)} انتخاب · اختیاری'),
    children: [
      for (final meal in meals)
        CheckboxListTile(
          title: Text(meal.title, style: const TextStyle(fontSize: 12)),
          value: selected.contains(meal.id),
          onChanged: busy
              ? null
              : (on) => setState(() {
                  if (on == true) {
                    selected.add(meal.id);
                    opposing?.remove(meal.id);
                  } else {
                    selected.remove(meal.id);
                  }
                }),
        ),
    ],
  );
  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), request = store.feedbackProgram;
    if (loading) {
      return Scaffold(
        appBar: AppBar(title: const Text('بازخورد هفته')),
        body: const Center(child: CircularProgressIndicator()),
      );
    }
    if (store.feedbackLoadError != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('بازخورد هفته')),
        body: PageBody(
          children: [
            Text(store.feedbackLoadError!),
            PrimaryButton(
              'تلاش مجدد',
              onPressed: () async {
                setState(() => loading = true);
                await store.restoreWeeklyFeedback();
                if (mounted) setState(() => loading = false);
              },
            ),
          ],
        ),
      );
    }
    if (!store.canReviewCurrentProgram || request == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('بازخورد هفته')),
        body: const PageBody(
          children: [
            EmptyPanel(
              'هنوز زمان بازخورد نرسیده',
              'در پایان هفته یا پس از تکمیل برنامه می‌توانی بازخورد ثبت کنی؛ دریافت جایزه شرط نیست.',
              icon: Icons.rate_review_outlined,
            ),
          ],
        ),
      );
    }
    final sent = store.feedbackFor(request);
    if (sent != null) {
      return Scaffold(
        appBar: AppBar(title: const Text('بازخورد هفته')),
        body: PageBody(
          children: [
            const Heading('بازخورد این هفته ذخیره شد'),
            Text(persianDate(request.programWeek!)),
            const Notice(
              'پاسخ‌های خصوصی برای شخصی‌سازی و بررسی متخصص هستند. این نسخه روی همین دستگاه ذخیره می‌شود.',
            ),
            Text(
              sent.rating == 0
                  ? 'برای متخصص امتیازی ثبت نکرده‌ای.'
                  : 'امتیاز ارتباط با متخصص: ${fa(sent.rating)} از ۵',
            ),
            if (sent.comment.isNotEmpty) Text(sent.comment),
            Text(
              sent.publicConsent
                  ? 'فقط متن عمومی جداگانه، پس از تأیید مدیر قابل نمایش است.'
                  : 'اجازهٔ انتشار عمومی نداده‌ای.',
            ),
            if (sent.publicConsent) Text(sent.publicText),
          ],
        ),
      );
    }
    final options = store.feedbackMeals(request);
    return Scaffold(
      appBar: AppBar(title: const Text('بازخورد برنامهٔ هفته')),
      body: PageBody(
        children: [
          Text(
            '${persianDate(request.programWeek!)} · برنامهٔ ${fa(request.id)}',
          ),
          const Notice(
            'بازخورد خصوصی است. انتشار نظر عمومی فقط با اجازهٔ جداگانهٔ تو و تأیید مدیر انجام می‌شود. ذخیره در این نسخه نمایشی و محلی است.',
          ),
          meals(
            'کدام غذاها را دوست داشتی؟',
            options,
            favorite,
            opposing: disliked,
          ),
          meals(
            'کدام غذاها را دوست نداشتی؟',
            options,
            disliked,
            opposing: favorite,
          ),
          meals('آماده‌سازی کدام غذاها سخت یا طولانی بود؟', options, difficult),
          choices(
            'دسترسی به مواد اولیه چطور بود؟',
            const {'easy': 'راحت', 'sometimes': 'گاهی سخت', 'hard': 'اغلب سخت'},
            availability,
            (v) => availability = v,
          ),
          choices(
            'هزینهٔ غذاها چطور بود؟',
            const {
              'comfortable': 'مناسب',
              'mixed': 'متوسط',
              'expensive': 'گران',
            },
            budget,
            (v) => budget = v,
          ),
          choices(
            'مقدار وعده‌ها چطور بود؟',
            const {'small': 'کم', 'suitable': 'مناسب', 'large': 'زیاد'},
            portion,
            (v) => portion = v,
          ),
          choices(
            'ارتباط و همراهی متخصص چطور بود؟',
            const {
              'good': 'خوب',
              'average': 'متوسط',
              'poor': 'نیازمند بهبود',
              'not_used': 'ارتباطی نداشتم',
            },
            service,
            (v) => service = v,
          ),
          if (service == 'not_used')
            const Notice('وقتی ارتباطی نداشتی، امتیازی برای متخصص ثبت نمی‌شود.')
          else ...[
            const Heading('امتیاز متخصص'),
            Wrap(
              spacing: 6,
              children: [
                for (var i = 1; i <= 5; i++)
                  ChoiceChip(
                    label: Text('${fa(i)} ★'),
                    selected: rating == i,
                    onSelected: busy ? null : (_) => setState(() => rating = i),
                  ),
              ],
            ),
          ],
          TextField(
            controller: comment,
            maxLength: 1500,
            maxLines: 3,
            enabled: !busy,
            decoration: const InputDecoration(
              labelText: 'توضیح خصوصی (اختیاری)',
            ),
          ),
          SwitchListTile(
            title: const Text('مایلم یک نظر جداگانه عمومی منتشر شود'),
            value: consent,
            onChanged: busy ? null : (v) => setState(() => consent = v),
          ),
          if (consent)
            TextField(
              controller: publicText,
              maxLength: 500,
              maxLines: 3,
              enabled: !busy,
              decoration: const InputDecoration(
                labelText: 'متن نظر عمومی؛ پاسخ‌های خصوصی منتشر نمی‌شوند',
              ),
            ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          PrimaryButton(
            busy ? 'در حال ذخیره…' : 'ذخیرهٔ بازخورد هفته',
            onPressed: busy ? null : () => save(store, request),
            icon: Icons.check,
          ),
        ],
      ),
    );
  }
}

class NextPlanReviewScreen extends StatefulWidget {
  const NextPlanReviewScreen({super.key});
  @override
  State<NextPlanReviewScreen> createState() => _NextPlanReviewScreenState();
}

class _NextPlanReviewScreenState extends State<NextPlanReviewScreen> {
  final favorites = TextEditingController(),
      avoid = TextEditingController(),
      preparation = TextEditingController(),
      budget = TextEditingController();
  bool initialized = false,
      confirmed = false,
      useSuggestions = true,
      busy = false;
  String? error;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (initialized) return;
    initialized = true;
    final s = DemoScope.of(context);
    final p = s.foodPreferences ?? s.suggestedFoodPreferences;
    useSuggestions = p.accepted || s.foodPreferences == null;
    favorites.text = p.favorites;
    avoid.text = p.avoid;
    preparation.text = p.preparation;
    budget.text = p.budget;
  }

  @override
  void dispose() {
    for (final c in [favorites, avoid, preparation, budget]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> save(DemoStore s) async {
    if (busy || !confirmed) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await s.confirmFoodPreferences(
        useSuggestions
            ? FoodPreferences(
                favorites: favorites.text.trim(),
                avoid: avoid.text.trim(),
                preparation: preparation.text.trim(),
                budget: budget.text.trim(),
                accepted: true,
              )
            : const FoodPreferences(),
      );
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) setState(() => error = 'ذخیره انجام نشد؛ دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = DemoScope.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text('بازبینی برای برنامهٔ بعدی')),
      body: PageBody(
        children: [
          const Notice(
            'اطلاعات قبلی از پیش پر شده است. تغییر مهم در وزن، دارو، بیماری یا بارداری را پیش از دریافت برنامه اصلاح کن.',
          ),
          Surface(child: InfoRows(s.questionnaire.summary)),
          OutlinedButton(
            onPressed: busy
                ? null
                : () => pushPage(
                    context,
                    const QuestionnaireScreen(editing: true),
                  ),
            child: const Text('اصلاح اطلاعات فردی'),
          ),
          const Heading('ترجیحات پیشنهادی از بازخورد قبلی'),
          const Text(
            'این‌ها پیشنهادهای سادهٔ نسخهٔ نمایشی‌اند؛ نتیجهٔ تحلیل زندهٔ AI نیستند. می‌توانی ویرایش یا ردشان کنی.',
          ),
          SwitchListTile(
            title: const Text('از ترجیحات زیر استفاده شود'),
            value: useSuggestions,
            onChanged: busy ? null : (v) => setState(() => useSuggestions = v),
          ),
          if (useSuggestions) ...[
            for (final entry in {
              'غذاهای محبوب': favorites,
              'غذاهای نامطلوب': avoid,
              'آماده‌سازی': preparation,
              'بودجه': budget,
            }.entries)
              TextField(
                controller: entry.value,
                maxLines: 2,
                maxLength: 1500,
                enabled: !busy,
                decoration: InputDecoration(labelText: entry.key),
              ),
          ],
          CheckboxListTile(
            title: const Text(
              'اطلاعات مهم را بررسی و تغییرات لازم را ثبت کرده‌ام',
            ),
            value: confirmed,
            onChanged: busy
                ? null
                : (v) => setState(() => confirmed = v ?? false),
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          PrimaryButton(
            busy ? 'در حال ذخیره…' : 'تأیید و ادامه',
            onPressed: busy || !confirmed ? null : () => save(s),
            icon: Icons.check,
          ),
        ],
      ),
    );
  }
}
