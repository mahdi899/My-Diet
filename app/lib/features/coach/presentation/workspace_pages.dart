import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../../core/theme/tokens.dart';
import '../data/coach_parse.dart';
import 'coach_controller.dart';
import 'memory_view.dart';

void openCoachLibrary(
  BuildContext context,
  CoachController controller, {
  bool saved = false,
}) {
  Navigator.of(context).push(
    MaterialPageRoute<void>(
      builder: (_) => CoachLibraryPage(controller: controller, saved: saved),
    ),
  );
}

class CoachLibraryPage extends StatefulWidget {
  const CoachLibraryPage({
    super.key,
    required this.controller,
    this.saved = false,
  });
  final CoachController controller;
  final bool saved;
  @override
  State<CoachLibraryPage> createState() => _CoachLibraryPageState();
}

class _CoachLibraryPageState extends State<CoachLibraryPage> {
  final _query = TextEditingController();
  Timer? _debounce;
  late bool _saved = widget.saved;
  List<Map<String, dynamic>> _items = [];
  bool _loading = false;
  String? _error;
  String? _cursor;
  int _operation = 0;
  @override
  void initState() {
    super.initState();
    if (_saved) _load();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _query.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    final operation = ++_operation;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = _saved
          ? {'items': await widget.controller.notebook.saved()}
          : await widget.controller.workspace!.searchMessages(
              _query.text.trim(),
              before: more ? _cursor : null,
            );
      if (!mounted || operation != _operation) return;
      setState(() {
        _items = [if (more) ..._items, ...asMapList(data['items'])];
        _cursor = data['nextCursor']?.toString();
      });
    } catch (_) {
      if (mounted && operation == _operation) {
        setState(() => _error = 'دریافت انجام نشد. دوباره تلاش کن.');
      }
    } finally {
      if (mounted && operation == _operation) setState(() => _loading = false);
    }
  }

  Future<void> _open(Map<String, dynamic> row) async {
    final thread = asString(row['threadId']);
    if (thread.isEmpty) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    if (_saved && widget.controller.conversationRepository != null) {
      try {
        final threads = await widget.controller.conversationRepository!
            .listConversations();
        if (!mounted) return;
        if (!threads.any((t) => t.id == thread)) {
          setState(() {
            _loading = false;
            _error =
                'گفتگوی اصلی حذف شده؛ نسخه ذخیره‌شده این پیام همچنان باقی است.';
          });
          return;
        }
      } catch (_) {
        if (mounted) {
          setState(() {
            _loading = false;
            _error = 'دریافت گفتگو انجام نشد. دوباره تلاش کن.';
          });
        }
        return;
      }
    }
    await widget.controller.openSearchResult(
      thread,
      asString(row['messageId'], asString(row['id'])),
    );
    if (!mounted) return;
    if (widget.controller.historyFailed || widget.controller.error != null) {
      setState(() {
        _loading = false;
        _error = _saved
            ? 'گفتگوی اصلی در دسترس نیست؛ نسخه ذخیره‌شده این پیام همچنان باقی است.'
            : 'باز کردن پیام انجام نشد. دوباره تلاش کن.';
      });
    } else {
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    backgroundColor: AppColors.bg,
    appBar: AppBar(
      title: const Text('گفتگوهای من'),
      backgroundColor: AppColors.bg,
    ),
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 12),
            child: SegmentedButton<bool>(
              segments: const [
                ButtonSegment(
                  value: false,
                  label: Text('جست‌وجو'),
                  icon: Icon(Icons.search_rounded),
                ),
                ButtonSegment(
                  value: true,
                  label: Text('نشان‌شده‌ها'),
                  icon: Icon(Icons.bookmark_outline_rounded),
                ),
              ],
              selected: {_saved},
              onSelectionChanged: (v) {
                _debounce?.cancel();
                setState(() {
                  _saved = v.single;
                  _items = [];
                  _cursor = null;
                });
                _load();
              },
            ),
          ),
          if (!_saved)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: TextField(
                key: const ValueKey('coach-search-input'),
                controller: _query,
                maxLength: 100,
                textInputAction: TextInputAction.search,
                decoration: const InputDecoration(
                  labelText: 'جست‌وجو در عنوان و متن همه گفتگوها',
                  prefixIcon: Icon(Icons.search),
                  border: OutlineInputBorder(),
                ),
                onChanged: (_) {
                  _debounce?.cancel();
                  _debounce = Timer(
                    const Duration(milliseconds: 300),
                    () => _load(),
                  );
                },
                onSubmitted: (_) {
                  _debounce?.cancel();
                  _load();
                },
              ),
            ),
          if (_saved)
            const Padding(
              padding: EdgeInsets.symmetric(horizontal: 20, vertical: 8),
              child: Text(
                'این پیام‌ها روی همین دستگاه نگه داشته می‌شن؛ حتی اگر گفتگوی اصلی حذف بشه.',
                style: TextStyle(color: AppColors.inkSoft, height: 1.8),
              ),
            ),
          if (_loading) const LinearProgressIndicator(minHeight: 2),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(
                    _error!,
                    style: const TextStyle(color: AppColors.danger),
                  ),
                  TextButton(
                    onPressed: () => _load(),
                    child: const Text('تلاش دوباره'),
                  ),
                ],
              ),
            ),
          Expanded(
            child: _items.isEmpty && !_loading
                ? Center(
                    child: Text(
                      _saved
                          ? 'پیام‌های مهم رو از منوی هر پیام نشان کن.'
                          : _query.text.trim().isEmpty
                          ? 'دنبال کدوم غذا یا توصیه می‌گردی؟'
                          : 'پیامی با این عبارت پیدا نشد.',
                      textAlign: TextAlign.center,
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.all(20),
                    itemCount: _items.length + (_cursor == null ? 0 : 1),
                    separatorBuilder: (_, _) => const SizedBox(height: 12),
                    itemBuilder: (context, index) {
                      if (index == _items.length) {
                        return TextButton(
                          onPressed: _loading ? null : () => _load(more: true),
                          child: const Text('نتایج بیشتر'),
                        );
                      }
                      final row = _items[index];
                      return Card(
                        color: AppColors.surface,
                        child: Padding(
                          padding: const EdgeInsets.all(16),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                asString(row['title'], 'گفتگو'),
                                style: const TextStyle(
                                  color: AppColors.emeraldDeep,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 8),
                              if (_saved)
                                SelectableText(
                                  asString(row['text']),
                                  style: const TextStyle(height: 1.9),
                                )
                              else
                                Text(
                                  asString(row['text']),
                                  maxLines: 4,
                                  overflow: TextOverflow.ellipsis,
                                  style: const TextStyle(height: 1.9),
                                ),
                              Wrap(
                                alignment: WrapAlignment.end,
                                children: [
                                  if (_saved)
                                    IconButton(
                                      tooltip: 'کپی پیام',
                                      onPressed: () => Clipboard.setData(
                                        ClipboardData(
                                          text: asString(row['text']),
                                        ),
                                      ),
                                      icon: const Icon(
                                        Icons.copy_rounded,
                                        size: 20,
                                      ),
                                    ),
                                  if (_saved)
                                    IconButton(
                                      tooltip: 'حذف از نشان‌شده‌ها',
                                      onPressed: _loading
                                          ? null
                                          : () async {
                                              try {
                                                await widget.controller.notebook
                                                    .removeBookmark(
                                                      asString(row['id']),
                                                    );
                                                await _load();
                                              } catch (_) {
                                                if (mounted) {
                                                  setState(
                                                    () => _error =
                                                        'حذف نشان انجام نشد.',
                                                  );
                                                }
                                              }
                                            },
                                      icon: const Icon(
                                        Icons.bookmark_remove_outlined,
                                        size: 20,
                                      ),
                                    ),
                                  TextButton.icon(
                                    onPressed: _loading
                                        ? null
                                        : () => _open(row),
                                    icon: const Icon(
                                      Icons.arrow_outward_rounded,
                                      size: 18,
                                    ),
                                    label: const Text('رفتن به پیام'),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
    ),
  );
}

class CoachMemoryPage extends StatefulWidget {
  const CoachMemoryPage({super.key, required this.controller});
  final CoachController controller;
  @override
  State<CoachMemoryPage> createState() => _CoachMemoryPageState();
}

class _CoachMemoryPageState extends State<CoachMemoryPage> {
  Map<String, dynamic>? _data;
  String? _error;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final data = await widget.controller.workspace!.memory();
      if (mounted) setState(() => _data = data);
    } catch (_) {
      if (mounted) setState(() => _error = 'حافظه دریافت نشد. دوباره تلاش کن.');
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _edit(Map<String, dynamic> row, {bool remove = false}) async {
    var proposed = asString(row['value']);
    final value = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(remove ? 'این ترجیح فراموش بشه؟' : 'اصلاح ترجیح غذایی'),
        content: remove
            ? Text(asString(row['value']))
            : TextFormField(
                initialValue: proposed,
                onChanged: (v) => proposed = v,
                autofocus: true,
                maxLength: 200,
                decoration: const InputDecoration(labelText: 'متن درست'),
              ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('انصراف'),
          ),
          TextButton(
            onPressed: () {
              if (remove || proposed.trim().isNotEmpty) {
                Navigator.pop(context, remove ? '' : proposed.trim());
              }
            },
            child: Text(remove ? 'فراموش کن' : 'ذخیره'),
          ),
        ],
      ),
    );
    if (!mounted || value == null) return;
    setState(() => _busy = true);
    try {
      await widget.controller.workspace!.editMemory(
        asString(row['id']),
        remove ? null : value,
      );
      await _load();
    } catch (_) {
      if (mounted) {
        setState(() {
          _busy = false;
          _error = 'تغییر ذخیره نشد. دوباره تلاش کن.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => CoachMemoryView(
    preferences: asMapList(_data?['preferences']),
    summary: asString(_data?['summary']),
    loaded: _data != null,
    busy: _busy,
    error: _error,
    onRetry: _load,
    onEdit: (row) => _edit(row),
    onForget: (row) => _edit(row, remove: true),
  );
}
