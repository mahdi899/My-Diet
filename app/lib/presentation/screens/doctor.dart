import 'package:flutter/material.dart';
import '../../data/demo_store.dart';
import '../../core/theme/theme.dart';
import '../widgets/ui.dart';

class DoctorDetailsScreen extends StatelessWidget {
  const DoctorDetailsScreen({super.key});
  @override
  Widget build(BuildContext context) {
    final e = DemoScope.of(context).assignedDoctor;
    return Scaffold(
      appBar: AppBar(title: const Text('مشخصات دکتر')),
      body: PageBody(
        children: [
          if (e == null)
            const EmptyPanel(
              'متخصص هنوز مشخص نشده',
              'اطلاعات پزشک رژیم من اینجا نمایش داده می‌شود.',
              icon: Icons.person_search_outlined,
            )
          else ...[
            Surface(
              child: Column(
                children: [
                  PersonAvatar(e.name, size: 76),
                  const SizedBox(height: 14),
                  Text(e.name, style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 5),
                  Text(e.specialty, style: const TextStyle(color: muted)),
                  const SizedBox(height: 12),
                  Tag(
                    'کد نظام پزشکی: ${e.medicalCode.isEmpty ? 'ثبت نشده' : e.medicalCode}',
                  ),
                ],
              ),
            ),
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Heading('اطلاعات مطب'),
                  const SizedBox(height: 16),
                  InfoRows({
                    'شهر': e.city.isEmpty ? 'ثبت نشده' : e.city,
                    'آدرس مطب': e.address.isEmpty ? 'ثبت نشده' : e.address,
                    'تلفن مطب': e.clinicPhone.isEmpty
                        ? 'ثبت نشده'
                        : e.clinicPhone,
                    'ساعت پذیرش': e.hours.isEmpty ? 'ثبت نشده' : e.hours,
                  }),
                ],
              ),
            ),
            Surface(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Heading('دربارهٔ متخصص'),
                  const SizedBox(height: 14),
                  InfoRows({
                    'مدرک تحصیلی': e.degree.isEmpty ? 'ثبت نشده' : e.degree,
                    'سابقهٔ کار': e.experience.isEmpty
                        ? 'ثبت نشده'
                        : '${fa(e.experience)} سال',
                  }),
                  if (e.bio.isNotEmpty) ...[
                    const SizedBox(height: 10),
                    Text(
                      e.bio,
                      style: const TextStyle(color: muted, height: 1.9),
                    ),
                  ],
                ],
              ),
            ),
            const Text(
              'اطلاعات این نسخه نمونهٔ طراحی است.',
              style: TextStyle(color: muted, fontSize: 11),
            ),
          ],
        ],
      ),
    );
  }
}

class ExpertProfileEditor extends StatefulWidget {
  const ExpertProfileEditor({super.key});
  @override
  State<ExpertProfileEditor> createState() => _ExpertProfileEditorState();
}

class _ExpertProfileEditorState extends State<ExpertProfileEditor> {
  final form = GlobalKey<FormState>();
  final fields = <String, TextEditingController>{};
  ExpertRecord? draft;
  bool saving = false;
  static const labels = {
    'name': 'نام و نام خانوادگی',
    'specialty': 'تخصص',
    'medicalCode': 'کد نظام پزشکی',
    'degree': 'مدرک تحصیلی',
    'experience': 'سابقهٔ کار / سال',
    'mobile': 'شمارهٔ همراه شخصی',
    'city': 'شهر',
    'address': 'آدرس مطب',
    'clinicPhone': 'شماره تلفن مطب',
    'hours': 'روزها و ساعت پذیرش',
    'bio': 'دربارهٔ من',
  };
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (draft == null) {
      draft = DemoScope.of(context).experts.first.copy();
      final data = draft!.toJson();
      for (final key in labels.keys) {
        fields[key] = TextEditingController(text: data[key] as String? ?? '');
      }
    }
  }

  @override
  void dispose() {
    for (final f in fields.values) {
      f.dispose();
    }
    super.dispose();
  }

  Future<void> save() async {
    if (saving || !form.currentState!.validate()) return;
    setState(() => saving = true);
    final data = draft!.toJson();
    for (final entry in fields.entries) {
      data[entry.key] = entry.value.text.trim();
    }
    try {
      await DemoScope.of(
        context,
      ).saveExpertProfile(ExpertRecord.fromJson(data));
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) showToast(context, 'ذخیره انجام نشد؛ دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('اطلاعات فردی و مطب')),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: PrimaryButton(
          saving ? 'در حال ذخیره…' : 'ثبت اطلاعات متخصص',
          onPressed: saving ? null : save,
          icon: Icons.check,
        ),
      ),
    ),
    body: Form(
      key: form,
      child: PageBody(
        spacing: 12,
        children: [
          const Heading(
            'پروفایل حرفه‌ای تو',
            subtitle:
                'اطلاعات مطب و تخصص برای کاربر نمایش داده می‌شود؛ شمارهٔ همراه شخصی نمایش عمومی ندارد.',
          ),
          for (final group in [
            (
              'اطلاعات حرفه‌ای',
              [
                'name',
                'specialty',
                'medicalCode',
                'degree',
                'experience',
                'bio',
              ],
            ),
            ('اطلاعات مطب', ['city', 'address', 'clinicPhone', 'hours']),
            ('حساب شخصی', ['mobile']),
          ])
            Surface(
              radius: 14,
              padding: 14,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Heading(group.$1),
                  const SizedBox(height: 14),
                  for (final entry in labels.entries.where(
                    (e) => group.$2.contains(e.key),
                  ))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 16),
                      child: TextFormField(
                        key: ValueKey('expert-${entry.key}'),
                        controller: fields[entry.key],
                        enabled: !saving,
                        minLines: entry.key == 'address' || entry.key == 'bio'
                            ? 2
                            : 1,
                        maxLines: entry.key == 'address' || entry.key == 'bio'
                            ? 4
                            : 1,
                        keyboardType:
                            entry.key == 'clinicPhone' || entry.key == 'mobile'
                            ? TextInputType.phone
                            : entry.key == 'experience'
                            ? TextInputType.number
                            : TextInputType.text,
                        decoration: InputDecoration(labelText: entry.value),
                        validator: (v) {
                          final text = (v ?? '').trim();
                          if ([
                                'name',
                                'specialty',
                                'medicalCode',
                                'address',
                                'clinicPhone',
                                'city',
                              ].contains(entry.key) &&
                              text.isEmpty) {
                            return 'این قسمت را تکمیل کن.';
                          }
                          if (text.isNotEmpty &&
                              (entry.key == 'clinicPhone' ||
                                  entry.key == 'mobile') &&
                              !RegExp(r'^\+?\d{8,15}$').hasMatch(
                                latinDigits(
                                  text,
                                ).replaceAll(RegExp(r'[\s\-()]'), ''),
                              )) {
                            return 'شمارهٔ تلفن معتبر وارد کن.';
                          }
                          if (text.isNotEmpty && entry.key == 'experience') {
                            final n = int.tryParse(latinDigits(text));
                            if (n == null || n < 0 || n > 80) {
                              return 'تعداد سال معتبر وارد کن.';
                            }
                          }
                          return null;
                        },
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    ),
  );
}
