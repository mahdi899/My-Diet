import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:image_picker/image_picker.dart';

import '../../../data/demo_store.dart';
import '../../../domain/onboarding/onboarding.dart';
import '../../../presentation/onboarding/controller.dart';
import '../../../presentation/onboarding/onboarding_flow.dart';
import '../../../presentation/session/live_session.dart';

class PersonalDetails extends StatefulWidget {
  const PersonalDetails({super.key, required this.store});
  final DemoStore store;

  @override
  State<PersonalDetails> createState() => _PersonalDetailsState();
}

class _PersonalDetailsState extends State<PersonalDetails> {
  static const storage = FlutterSecureStorage();
  static const labels = [
    'نام',
    'سن',
    'شماره تلفن',
    'قد (سانتی‌متر)',
    'وزن (کیلوگرم)',
  ];
  final form = GlobalKey<FormState>();
  late final key = 'personal_details:${widget.store.feedbackOwner}';
  late final fields = [
    for (final value in [
      widget.store.questionnaire.name,
      widget.store.questionnaire.age,
      widget.store.sessionPhone,
      widget.store.questionnaire.height,
      widget.store.questionnaire.weight,
    ])
      TextEditingController(text: value),
  ];
  Uint8List? photo;
  bool busy = true;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final auth = widget.store.customerAuth;
      if (auth != null) {
        final response = await auth.api('me/personal-details') as Map;
        if (!mounted) return;
        if (response['details'] case final Map details) {
          const names = ['name', 'age', 'contactPhone', 'height', 'weight'];
          for (var i = 0; i < names.length; i++) {
            fields[i].text = details[names[i]].toString();
          }
          if (details['photo'] case final String encoded) {
            photo = base64Decode(encoded);
          }
          return;
        }
      }
      final saved = await storage.read(key: key);
      if (!mounted) return;
      if (saved == null) {
        if (widget.store.serverAuthEnabled) {
          final state = await ensureLiveServices(
            widget.store,
          ).onboarding.state();
          final profile = state.profile;
          if (!mounted || profile == null) return;
          fields[1].text = profile.age.toString();
          fields[3].text = profile.heightCm.toString();
          fields[4].text = profile.weightKg.toString();
        }
        return;
      }
      final data = jsonDecode(saved) as Map<String, dynamic>;
      final values = data['fields'] as List;
      for (var i = 0; i < fields.length; i++) {
        fields[i].text = values[i] as String;
      }
      if (data['photo'] case final String encoded)
        photo = base64Decode(encoded);
    } catch (_) {
      if (mounted) notice('خواندن اطلاعات ذخیره‌شده ممکن نشد.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  void notice(String message) => ScaffoldMessenger.of(
    context,
  ).showSnackBar(SnackBar(content: Text(message)));

  Future<void> choosePhoto() async {
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 320,
        maxHeight: 320,
        imageQuality: 75,
      );
      if (image == null) return;
      final bytes = await image.readAsBytes();
      if (mounted) setState(() => photo = bytes);
    } catch (_) {
      if (mounted) notice('انتخاب عکس ممکن نشد.');
    }
  }

  Future<void> save() async {
    if (!form.currentState!.validate()) return;
    setState(() => busy = true);
    try {
      final values = fields.map((field) => field.text.trim()).toList();
      final auth = widget.store.customerAuth;
      if (auth != null) {
        await auth.api(
          'me/personal-details',
          method: 'PATCH',
          body: {
            'name': values[0],
            'age': int.parse(latinDigits(values[1])),
            'contactPhone': latinDigits(values[2]),
            'height': double.parse(latinDigits(values[3])),
            'weight': double.parse(latinDigits(values[4])),
            'photo': photo == null ? null : base64Encode(photo!),
          },
        );
        if (mounted) {
          widget.store.questionnaire.name = values[0];
          widget.store.update();
          notice('اطلاعات در حساب ذخیره شد.');
        }
        return;
      }
      await storage.write(
        key: key,
        value: jsonEncode({
          'fields': values,
          'photo': photo == null ? null : base64Encode(photo!),
        }),
      );
      if (mounted) notice('اطلاعات روی این دستگاه ذخیره شد.');
    } catch (_) {
      if (mounted) notice('ذخیرهٔ اطلاعات ممکن نشد.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  void dispose() {
    for (final field in fields) {
      field.dispose();
    }
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('اطلاعات فردی')),
    body: SafeArea(
      child: Form(
        key: form,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Center(
              child: CircleAvatar(
                radius: 44,
                backgroundImage: photo == null ? null : MemoryImage(photo!),
                child: photo == null
                    ? const Icon(Icons.person_outline, size: 38)
                    : null,
              ),
            ),
            Center(
              child: TextButton(
                onPressed: busy ? null : choosePhoto,
                child: const Text('تغییر عکس پروفایل'),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.flag_outlined),
              title: const Text('رژیم فعلی'),
              subtitle: Text(widget.store.questionnaire.goal),
              trailing: const Icon(Icons.lock_outline),
            ),
            const SizedBox(height: 12),
            for (var i = 0; i < labels.length; i++)
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: TextFormField(
                  controller: fields[i],
                  enabled: !busy,
                  keyboardType: i == 0
                      ? TextInputType.name
                      : i == 2
                      ? TextInputType.phone
                      : const TextInputType.numberWithOptions(decimal: true),
                  decoration: InputDecoration(
                    labelText: labels[i],
                    helperText: i == 2
                        ? 'شمارهٔ تماس، جدا از شمارهٔ ورود'
                        : null,
                  ),
                  validator: (value) {
                    final text = value?.trim() ?? '';
                    if (text.isEmpty) return 'این فیلد را وارد کن.';
                    if (i == 0 || i == 2) return null;
                    final number = double.tryParse(latinDigits(text));
                    if (i == 1 &&
                        (int.tryParse(latinDigits(text)) == null ||
                            number == null ||
                            number < 1 ||
                            number > 130)) {
                      return 'سن را به‌صورت عدد صحیح بین ۱ و ۱۳۰ وارد کن.';
                    }
                    return number == null || !number.isFinite || number <= 0
                        ? 'عدد معتبر وارد کن.'
                        : null;
                  },
                ),
              ),
            FilledButton(
              onPressed: busy ? null : save,
              child: const Text('ذخیره تغییرات'),
            ),
          ],
        ),
      ),
    ),
  );
}

class ChangeGoal extends StatefulWidget {
  const ChangeGoal({super.key, required this.store});
  final DemoStore store;

  @override
  State<ChangeGoal> createState() => _ChangeGoalState();
}

class _ChangeGoalState extends State<ChangeGoal> {
  late final repository = ensureLiveServices(widget.store).onboarding;
  late final options = load();
  OnboardingController? controller;

  Future<OnboardingController> load() async {
    final state = await repository.state();
    return OnboardingController(
      repository: repository,
      spec: await repository.spec(),
      state: OnboardingState(
        nextStep: NextStep.start,
        claimedFromDemo: false,
        track: null,
        missing: const [],
        draft: state.draft,
        profile: state.profile,
      ),
    );
  }

  @override
  void dispose() {
    options.then((value) => value.dispose(), onError: (Object _) {});
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final active = controller;
    if (active != null) {
      return OnboardingFlow(
        controller: active,
        exitBeforeTrack: true,
        onExit: () => setState(() => controller = null),
        onDone: (profile) async {
          await refreshLive(widget.store, profile: profile);
          if (context.mounted) Navigator.pop(context);
        },
      );
    }
    return Scaffold(
      appBar: AppBar(title: const Text('تغییر هدف')),
      body: FutureBuilder(
        future: options,
        builder: (context, snapshot) {
          if (snapshot.hasError)
            return const Center(child: Text('دریافت هدف‌ها ممکن نشد.'));
          final flow = snapshot.data;
          if (flow == null)
            return const Center(child: CircularProgressIndicator());
          final current = flow.state.profile?.track;
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              for (final goal in flow.spec.tracks)
                ListTile(
                  leading: const Icon(Icons.flag_outlined),
                  title: Text(goal.title),
                  subtitle: Text(
                    goal.id == current ? 'هدف فعلی' : goal.description,
                  ),
                  enabled: goal.id != current,
                  onTap: goal.id == current
                      ? null
                      : () {
                          flow.setTrack(goal.id);
                          flow.next();
                          setState(() => controller = flow);
                        },
                ),
            ],
          );
        },
      ),
    );
  }
}
