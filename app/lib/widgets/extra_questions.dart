import 'package:flutter/material.dart';
import '../data/demo_store.dart';
import '../data/form_config.dart';
import 'ui.dart';

class ExtraQuestionField extends StatefulWidget {
  const ExtraQuestionField({
    super.key,
    required this.question,
    required this.answers,
  });
  final FormQuestion question;
  final Map<String, dynamic> answers;
  @override
  State<ExtraQuestionField> createState() => _ExtraQuestionFieldState();
}

class _ExtraQuestionFieldState extends State<ExtraQuestionField> {
  @override
  Widget build(BuildContext context) {
    final q = widget.question,
        answers = widget.answers,
        value = widget.answers[widget.question.id];
    return Padding(
      padding: const EdgeInsets.only(top: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Heading(
            q.title,
            subtitle:
                '${q.requiredAnswer ? 'پاسخ الزامی' : 'پاسخ اختیاری'}${q.helper.isEmpty ? '' : ' · ${q.helper}'}',
          ),
          const SizedBox(height: 10),
          if (q.kind == QuestionKind.text || q.kind == QuestionKind.number)
            TextFormField(
              key: ValueKey('extra-${q.id}'),
              initialValue: value is String ? value : '',
              keyboardType: q.kind == QuestionKind.number
                  ? const TextInputType.numberWithOptions(decimal: true)
                  : TextInputType.text,
              maxLines: q.kind == QuestionKind.text ? 3 : 1,
              minLines: 1,
              decoration: const InputDecoration(hintText: 'پاسخ تو'),
              onChanged: (v) => answers[q.id] = v,
              validator: (v) {
                if ((v ?? '').trim().isEmpty) {
                  return q.requiredAnswer ? 'پاسخ این سؤال لازم است.' : null;
                }
                if (q.kind == QuestionKind.number) {
                  final n = double.tryParse(latinDigits(v!));
                  if (n == null || !n.isFinite) return 'عدد معتبر وارد کن.';
                }
                return null;
              },
            )
          else if (q.kind == QuestionKind.single)
            DropdownButtonFormField<String>(
              key: ValueKey('extra-${q.id}'),
              initialValue: q.options.contains(value) ? value as String : null,
              isExpanded: true,
              decoration: const InputDecoration(hintText: 'یک گزینه انتخاب کن'),
              items: q.options
                  .map((o) => DropdownMenuItem(value: o, child: Text(o)))
                  .toList(),
              onChanged: (v) => answers[q.id] = v,
              validator: (v) =>
                  q.requiredAnswer && v == null ? 'یک گزینه انتخاب کن.' : null,
            )
          else if (q.kind == QuestionKind.multiple)
            FormField<List<String>>(
              initialValue: value is List
                  ? value.whereType<String>().where(q.options.contains).toList()
                  : [],
              validator: (v) => q.requiredAnswer && (v == null || v.isEmpty)
                  ? 'حداقل یک گزینه انتخاب کن.'
                  : null,
              builder: (state) => Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      for (final option in q.options)
                        FilterChip(
                          label: Text(option),
                          selected: state.value?.contains(option) ?? false,
                          onSelected: (v) {
                            final next = List<String>.of(state.value ?? []);
                            if (v) {
                              next.add(option);
                            } else {
                              next.remove(option);
                            }
                            answers[q.id] = next;
                            state.didChange(next);
                          },
                        ),
                    ],
                  ),
                  if (state.hasError)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        state.errorText!,
                        style: const TextStyle(color: Colors.red, fontSize: 12),
                      ),
                    ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}
