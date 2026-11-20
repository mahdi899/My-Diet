import 'dart:convert';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../core/theme/tokens.dart';
import '../../../data/demo_store.dart';
import '../../../data/profile_photo_storage.dart';
import 'profile_avatars.dart';
import 'profile_photo_crop.dart';

Future<void> showProfilePhotoPicker(
  BuildContext context,
  DemoStore store,
) async {
  final owner = store.feedbackOwner;
  final auth = store.customerAuth;
  await showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: AppColors.surface,
    shape: const RoundedRectangleBorder(borderRadius: AppRadius.sheet),
    builder: (_) => ProfilePhotoPicker(
      initialPhoto: store.profilePhoto,
      onSave: (bytes) async {
        final encoded = base64Encode(bytes);
        if (!store.userSignedIn || store.feedbackOwner != owner) {
          throw StateError('The profile account changed.');
        }
        if (auth != null) {
          await auth.api(
            'me/personal-details',
            method: 'PATCH',
            body: {'photo': encoded},
          );
        } else {
          await ProfilePhotoStorage.save(owner, encoded);
        }
        if (store.userSignedIn && store.feedbackOwner == owner) {
          store.profilePhoto = encoded;
          store.update();
        }
      },
    ),
  );
}

class ProfilePhotoPicker extends StatefulWidget {
  const ProfilePhotoPicker({
    super.key,
    this.initialPhoto,
    required this.onSave,
  });
  final String? initialPhoto;
  final Future<void> Function(Uint8List bytes) onSave;

  @override
  State<ProfilePhotoPicker> createState() => _ProfilePhotoPickerState();
}

class _ProfilePhotoPickerState extends State<ProfilePhotoPicker> {
  Uint8List? photo;
  ProfileAvatar? selected;
  bool busy = false;
  bool choosing = false;
  String? error;

  @override
  void initState() {
    super.initState();
    try {
      if (widget.initialPhoto != null) {
        photo = base64Decode(widget.initialPhoto!);
      }
    } on FormatException {
      photo = null;
    }
  }

  Future<void> gallery() async {
    setState(() {
      choosing = true;
      error = null;
    });
    try {
      final image = await ImagePicker().pickImage(
        source: ImageSource.gallery,
        maxWidth: 2048,
        maxHeight: 2048,
        imageQuality: 95,
      );
      if (image == null) return;
      final bytes = await image.readAsBytes();
      if (!mounted) return;
      final cropped = await Navigator.of(context).push<Uint8List>(
        MaterialPageRoute(builder: (_) => ProfilePhotoCrop(bytes: bytes)),
      );
      if (mounted && cropped != null) {
        setState(() {
          photo = cropped;
          selected = null;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => error = 'انتخاب عکس ممکن نشد. دوباره امتحان کن.');
      }
    } finally {
      if (mounted) setState(() => choosing = false);
    }
  }

  Future<void> save() async {
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final bytes = selected == null ? photo! : await selected!.png();
      if (!mounted) return;
      await widget.onSave(bytes);
      if (mounted) Navigator.pop(context);
    } catch (_) {
      if (mounted) setState(() => error = 'عکس ذخیره نشد. دوباره امتحان کن.');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final disabled = busy || choosing;
    return PopScope<void>(
      canPop: !busy,
      child: SafeArea(
        top: false,
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(22, 12, 22, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: AppColors.line,
                    borderRadius: BorderRadius.circular(9),
                  ),
                ),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      'عکس پروفایل',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                  ),
                  IconButton(
                    tooltip: 'بستن',
                    onPressed: disabled ? null : () => Navigator.pop(context),
                    icon: const Icon(Icons.close_rounded),
                  ),
                ],
              ),
              const Text(
                'عکس خودت یا یکی از آواتارهای آماده را انتخاب کن.',
                style: TextStyle(color: AppColors.muted, height: 1.7),
              ),
              const SizedBox(height: 18),
              Center(
                child: Container(
                  width: 100,
                  height: 100,
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border: Border.all(color: AppColors.selectedLine, width: 2),
                  ),
                  child: ClipOval(
                    child: selected != null
                        ? CustomPaint(painter: ProfileAvatarPainter(selected!))
                        : photo != null
                        ? Image.memory(
                            photo!,
                            fit: BoxFit.cover,
                            errorBuilder: (_, _, _) =>
                                const Icon(Icons.person_outline, size: 48),
                          )
                        : const ColoredBox(
                            color: AppColors.mint,
                            child: Icon(
                              Icons.person_outline,
                              size: 48,
                              color: AppColors.emeraldDark,
                            ),
                          ),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton.icon(
                onPressed: disabled ? null : gallery,
                icon: choosing
                    ? const SizedBox.square(
                        dimension: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.add_photo_alternate_outlined),
                label: const Text('انتخاب عکس از گالری'),
              ),
              const SizedBox(height: 20),
              const Text(
                'آواتارهای آماده',
                style: TextStyle(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 12),
              LayoutBuilder(
                builder: (context, constraints) {
                  final columns = constraints.maxWidth < 260 ? 2 : 3;
                  return GridView.count(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    crossAxisCount: columns,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 14,
                    children: [
                      for (final avatar in ProfileAvatar.presets)
                        Semantics(
                          selected: selected == avatar,
                          child: Tooltip(
                            message: 'آواتار ${avatar.name}',
                            child: Material(
                              color: avatar.background,
                              shape: CircleBorder(
                                side: BorderSide(
                                  color: selected == avatar
                                      ? AppColors.emeraldDeep
                                      : Colors.transparent,
                                  width: 3,
                                ),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: InkWell(
                                key: ValueKey('profile-avatar-${avatar.style}'),
                                customBorder: const CircleBorder(),
                                onTap: disabled
                                    ? null
                                    : () => setState(() {
                                        selected = avatar;
                                        error = null;
                                      }),
                                child: Stack(
                                  fit: StackFit.expand,
                                  children: [
                                    Padding(
                                      padding: const EdgeInsets.all(5),
                                      child: ClipOval(
                                        child: CustomPaint(
                                          painter: ProfileAvatarPainter(avatar),
                                        ),
                                      ),
                                    ),
                                    if (selected == avatar)
                                      const Positioned(
                                        bottom: 4,
                                        right: 4,
                                        child: DecoratedBox(
                                          decoration: BoxDecoration(
                                            color: AppColors.emeraldDeep,
                                            shape: BoxShape.circle,
                                          ),
                                          child: Padding(
                                            padding: EdgeInsets.all(4),
                                            child: Icon(
                                              Icons.check_rounded,
                                              color: Colors.white,
                                              size: 18,
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
              if (error != null)
                Padding(
                  padding: const EdgeInsets.only(top: 12),
                  child: Semantics(
                    liveRegion: true,
                    child: Text(
                      error!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                ),
              const SizedBox(height: 22),
              FilledButton(
                key: const ValueKey('profile-photo-save'),
                onPressed: disabled || (photo == null && selected == null)
                    ? null
                    : save,
                child: busy
                    ? const SizedBox.square(
                        dimension: 22,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text('ذخیره عکس پروفایل'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
