import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/form_config.dart';
import '../theme.dart';
import '../widgets/ui.dart';

String kindLabel(QuestionKind kind) => switch (kind) {
  QuestionKind.core => 'سؤال پایه',
  QuestionKind.text => 'پاسخ متنی',
  QuestionKind.number => 'پاسخ عددی',
  QuestionKind.single => 'تک‌انتخابی',
  QuestionKind.multiple => 'چندانتخابی',
};

class QuestionAdminScreen extends StatefulWidget {
  const QuestionAdminScreen({super.key});
  @override
  State<QuestionAdminScreen> createState() => _QuestionAdminScreenState();
}

class _QuestionAdminScreenState extends State<QuestionAdminScreen> {
  FormConfiguration? draft;
  int section = 0;
  bool saving = false;
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    draft ??= DemoScope.of(context).formConfiguration.copy();
  }

  Future<void> edit(FormQuestion? current) async {
    final q =
        current?.copy() ??
        FormQuestion(
          id: 'custom-${DateTime.now().microsecondsSinceEpoch}',
          section: section,
          title: '',
          kind: QuestionKind.text,
        );
    final result = await Navigator.of(context).push<FormQuestion>(
      MaterialPageRoute(
        builder: (_) =>
            QuestionEditorScreen(question: q, sections: draft!.sections),
      ),
    );
    if (result != null && mounted) {
      setState(() {
        final index = draft!.questions.indexWhere((q) => q.id == result.id);
        if (index < 0) {
          draft!.questions.add(result);
        } else {
          draft!.questions[index] = result;
        }
      });
    }
  }

  Future<void> editSections() async {
    final fields = draft!.sections
        .map((s) => TextEditingController(text: s))
        .toList();
    final key = GlobalKey<FormState>();
    final result = await showDialog<bool>(
      context: context,
      builder: (d) => AlertDialog(
        title: const Text('عنوان مرحله‌ها'),
        content: SingleChildScrollView(
          child: Form(
            key: key,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (var i = 0; i < fields.length; i++)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: TextFormField(
                      controller: fields[i],
                      decoration: InputDecoration(
                        labelText: 'مرحلهٔ ${fa(i + 1)}',
                      ),
                      validator: (v) =>
                          (v ?? '').trim().isEmpty ? 'عنوان لازم است.' : null,
                    ),
                  ),
              ],
            ),
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(d, false),
            child: const Text('انصراف'),
          ),
          FilledButton(
            onPressed: () {
              if (key.currentState!.validate()) Navigator.pop(d, true);
            },
            child: const Text('ثبت عنوان‌ها'),
          ),
        ],
      ),
    );
    if (result == true && mounted) {
      setState(() {
        for (var i = 0; i < fields.length; i++) {
          draft!.sections[i] = fields[i].text.trim();
        }
      });
    }
    for (final field in fields) {
      field.dispose();
    }
  }

  Future<void> save() async {
    if (saving) return;
    setState(() => saving = true);
    try {
      await DemoScope.of(context).saveFormConfiguration(draft!);
      if (mounted) {
        showToast(
          context,
          'سؤال‌ها ذخیره شدند و در پرسش‌نامهٔ کاربر نمایش داده می‌شوند.',
        );
      }
    } catch (_) {
      if (mounted) {
        showToast(context, 'ذخیره انجام نشد؛ سؤال‌ها و گزینه‌ها را بررسی کن.');
      }
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final d = draft!;
    final rows = d.questions.where((q) => q.section == section).toList();
    return Scaffold(
      appBar: AppBar(
        title: const Text('مدیریت پرسش‌نامه'),
        actions: [
          IconButton(
            tooltip: 'عنوان مرحله‌ها',
            onPressed: saving ? null : editSections,
            icon: const Icon(Icons.view_list_outlined),
          ),
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: PrimaryButton(
            saving ? 'در حال ذخیره…' : 'ذخیره و اعمال پرسش‌نامه',
            onPressed: saving ? null : save,
            icon: Icons.check,
          ),
        ),
      ),
      body: PageBody(
        children: [
          const Heading(
            'سؤال‌ها را متناسب با خدماتت تنظیم کن',
            subtitle:
                'متن و گزینه‌های سؤال‌های پایه را ویرایش کن یا سؤال تکمیلی بساز.',
          ),
          DropdownButtonFormField<int>(
            key: const ValueKey('admin-question-section'),
            initialValue: section,
            isExpanded: true,
            decoration: const InputDecoration(labelText: 'مرحلهٔ پرسش‌نامه'),
            items: [
              for (var i = 0; i < 5; i++)
                DropdownMenuItem(
                  value: i,
                  child: Text(
                    d.sections[i],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
            ],
            onChanged: saving ? null : (v) => setState(() => section = v ?? 0),
          ),
          OutlinedButton.icon(
            onPressed: saving ? null : () => edit(null),
            icon: const Icon(Icons.add),
            label: const Text('افزودن سؤال جدید'),
          ),
          for (final q in rows)
            Surface(
              key: ValueKey('admin-question-${q.id}'),
              padding: 15,
              onTap: saving ? null : () => edit(q),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          q.title,
                          style: const TextStyle(
                            fontWeight: FontWeight.bold,
                            fontSize: 14,
                          ),
                        ),
                      ),
                      IconButton(
                        tooltip: 'ویرایش سؤال',
                        onPressed: saving ? null : () => edit(q),
                        icon: const Icon(Icons.edit_outlined, color: pine),
                      ),
                    ],
                  ),
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      Tag(kindLabel(q.kind)),
                      if (!q.core)
                        Tag(
                          q.enabled
                              ? (q.requiredAnswer
                                    ? 'پاسخ الزامی'
                                    : 'پاسخ اختیاری')
                              : 'غیرفعال',
                          gray: !q.enabled,
                        ),
                      if (q.options.isNotEmpty)
                        Tag('${fa(q.options.length)} گزینه', gray: true),
                    ],
                  ),
                  if (!q.core)
                    Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        IconButton(
                          tooltip: 'بالاتر بردن سؤال',
                          onPressed: saving
                              ? null
                              : () {
                                  final index = d.questions.indexOf(q);
                                  if (index > 0) {
                                    setState(() {
                                      d.questions.removeAt(index);
                                      d.questions.insert(index - 1, q);
                                    });
                                  }
                                },
                          icon: const Icon(Icons.arrow_upward, size: 19),
                        ),
                        IconButton(
                          tooltip: 'پایین‌تر بردن سؤال',
                          onPressed: saving
                              ? null
                              : () {
                                  final index = d.questions.indexOf(q);
                                  if (index < d.questions.length - 1) {
                                    setState(() {
                                      d.questions.removeAt(index);
                                      d.questions.insert(index + 1, q);
                                    });
                                  }
                                },
                          icon: const Icon(Icons.arrow_downward, size: 19),
                        ),
                        IconButton(
                          tooltip: 'حذف سؤال تکمیلی',
                          onPressed: saving
                              ? null
                              : () => setState(() => d.questions.remove(q)),
                          icon: const Icon(
                            Icons.delete_outline,
                            color: Colors.redAccent,
                          ),
                        ),
                      ],
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class QuestionEditorScreen extends StatefulWidget {
  const QuestionEditorScreen({
    super.key,
    required this.question,
    required this.sections,
  });
  final FormQuestion question;
  final List<String> sections;
  @override
  State<QuestionEditorScreen> createState() => _QuestionEditorScreenState();
}

class _QuestionEditorScreenState extends State<QuestionEditorScreen> {
  late final FormQuestion q = widget.question.copy();
  late final title = TextEditingController(text: q.title),
      helper = TextEditingController(text: q.helper),
      options = TextEditingController(text: q.options.join('\n'));
  late final labels = {
    for (final option in q.options)
      option: TextEditingController(text: q.choiceLabels[option] ?? option),
  };
  final form = GlobalKey<FormState>();
  @override
  void dispose() {
    title.dispose();
    helper.dispose();
    options.dispose();
    for (final c in labels.values) {
      c.dispose();
    }
    super.dispose();
  }

  void done() {
    if (!form.currentState!.validate()) return;
    q.title = title.text.trim();
    q.helper = helper.text.trim();
    if (q.core) {
      q.choiceLabels = {
        for (final entry in labels.entries) entry.key: entry.value.text.trim(),
      };
    } else if (q.kind == QuestionKind.single ||
        q.kind == QuestionKind.multiple) {
      q.options = options.text
          .split('\n')
          .map((v) => v.trim())
          .where((v) => v.isNotEmpty)
          .toList();
    } else {
      q.options = [];
    }
    Navigator.pop(context, q);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: Text(q.title.isEmpty ? 'سؤال جدید' : 'ویرایش سؤال')),
    bottomNavigationBar: SafeArea(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: PrimaryButton('ثبت سؤال', onPressed: done, icon: Icons.check),
      ),
    ),
    body: Form(
      key: form,
      child: PageBody(
        children: [
          TextFormField(
            key: const ValueKey('question-title'),
            controller: title,
            decoration: const InputDecoration(labelText: 'متن سؤال'),
            maxLines: 3,
            minLines: 1,
            validator: (v) =>
                (v ?? '').trim().isEmpty ? 'متن سؤال لازم است.' : null,
          ),
          TextFormField(
            key: const ValueKey('question-helper'),
            controller: helper,
            decoration: const InputDecoration(
              labelText: 'راهنمای پاسخ (اختیاری)',
            ),
            maxLines: 3,
            minLines: 1,
          ),
          if (q.core) ...[
            const Tag('سؤال پایه'),
            if (q.options.isNotEmpty) const Heading('متن گزینه‌ها'),
            for (var i = 0; i < q.options.length; i++)
              TextFormField(
                key: ValueKey('core-choice-$i'),
                controller: labels[q.options[i]],
                decoration: InputDecoration(labelText: 'گزینهٔ ${fa(i + 1)}'),
                validator: (v) =>
                    (v ?? '').trim().isEmpty ? 'متن گزینه لازم است.' : null,
              ),
          ] else ...[
            DropdownButtonFormField<QuestionKind>(
              key: const ValueKey('question-kind'),
              initialValue: q.kind,
              decoration: const InputDecoration(labelText: 'نوع پاسخ'),
              items: [
                for (final kind in QuestionKind.values.where(
                  (v) => v != QuestionKind.core,
                ))
                  DropdownMenuItem(value: kind, child: Text(kindLabel(kind))),
              ],
              onChanged: (v) => setState(() => q.kind = v ?? QuestionKind.text),
            ),
            DropdownButtonFormField<int>(
              initialValue: q.section,
              isExpanded: true,
              decoration: const InputDecoration(labelText: 'نمایش در مرحله'),
              items: [
                for (var i = 0; i < 5; i++)
                  DropdownMenuItem(
                    value: i,
                    child: Text(
                      widget.sections[i],
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
              onChanged: (v) => q.section = v ?? 0,
            ),
            if (q.kind == QuestionKind.single ||
                q.kind == QuestionKind.multiple)
              TextFormField(
                key: const ValueKey('question-options'),
                controller: options,
                minLines: 4,
                maxLines: 8,
                decoration: const InputDecoration(
                  labelText: 'گزینه‌ها؛ هر گزینه در یک خط',
                ),
                validator: (v) {
                  final values = (v ?? '')
                      .split('\n')
                      .map((v) => v.trim())
                      .where((v) => v.isNotEmpty)
                      .toList();
                  return values.length < 2 ||
                          values.toSet().length != values.length
                      ? 'حداقل دو گزینهٔ متفاوت بنویس.'
                      : null;
                },
              ),
            SwitchListTile(
              title: const Text('پاسخ الزامی'),
              value: q.requiredAnswer,
              onChanged: (v) => setState(() => q.requiredAnswer = v),
            ),
            SwitchListTile(
              title: const Text('نمایش سؤال برای کاربر'),
              value: q.enabled,
              onChanged: (v) => setState(() => q.enabled = v),
            ),
          ],
        ],
      ),
    ),
  );
}
