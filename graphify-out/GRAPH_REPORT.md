# Graph Report - sabzine  (2026-10-28)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 974 nodes · 1322 edges · 55 communities (36 shown, 19 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 14 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `12949931`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- demo_store.dart
- wallet_catalog.dart
- ui.dart
- wallet_flow.dart
- user.dart
- celebration.dart
- expert.dart
- doctor.dart
- admin.dart
- form_config.dart
- questionnaire.dart
- nutrition_log_storage.dart
- question_admin.dart
- app.dart
- shared.dart
- utils.cpp
- pubspec.yaml
- StatelessWidget
- day.dart
- nutrition.dart
- win32_window.cpp
- State
- widget_test.dart
- capture_screens.dart
- dev_preview.dart
- wallet_flow_test.dart
- FlutterWindow
- panels_test.dart
- nutrition_test.dart
- extra_questions.dart
- flutter_window.cpp
- Win32Window
- manifest.json
- .MessageHandler
- data/demo_store.dart
- dashboard_test.dart
- analysis_options.yaml
- theme.dart
- package:flutter/material.dart
- DemoStore
- Point
- Size
- MainActivity.kt
- AppRole
- PlanStatus
- MockPaymentScreen
- PlanServicesScreen
- TokenPackagesScreen
- WalletDebugPanel

## God Nodes (most connected - your core abstractions)
1. `Win32Window` - 21 edges
2. `FlutterWindow` - 10 edges
3. `WindowClassRegistrar` - 7 edges
4. `Point` - 5 edges
5. `Size` - 5 edges
6. `wWinMain()` - 5 edges
7. `GetCommandLineArguments()` - 5 edges
8. `AppRole` - 5 edges
9. `Utf8FromUtf16()` - 4 edges
10. `NutritionLogStorage` - 4 edges

## Surprising Connections (you probably didn't know these)
- `wWinMain()` --calls--> `CreateAndAttachConsole()`  [INFERRED]
  windows/runner/main.cpp → windows/runner/utils.cpp
- `LogMemory` --implements--> `NutritionLogStorage`  [EXTRACTED]
  test/nutrition_test.dart → lib/data/nutrition_log_storage.dart
- `MemoryStorage` --implements--> `QuestionnaireStorage`  [EXTRACTED]
  test/widget_test.dart → lib/data/questionnaire_storage.dart
- `SettingsMemory` --implements--> `WorkspaceSettingsStorage`  [EXTRACTED]
  test/panels_test.dart → lib/data/workspace_settings_storage.dart
- `FlutterWindow` --inherits--> `Win32Window`  [EXTRACTED]
  windows/runner/flutter_window.h → windows/runner/win32_window.h

## Import Cycles
- None detected.

## Communities (55 total, 19 thin omitted)

### Community 0 - "demo_store.dart"
Cohesion: 0.01
Nodes (163): active, activity, addMeal, addPurchasedTokens, addWeight, allergens, _appliedWalletOperations, _applyExpert (+155 more)

### Community 1 - "wallet_catalog.dart"
Cohesion: 0.05
Nodes (36): QuestionnaireData, balanceAfter, credit, _faDigits, formatTokenNumber, formatToman, icon, id (+28 more)

### Community 2 - "ui.dart"
Cohesion: 0.05
Nodes (33): action, build, child, children, color, controller, description, gray (+25 more)

### Community 3 - "wallet_flow.dart"
Cohesion: 0.06
Nodes (30): attempt, balance, _BalanceLine, build, busy, buy, charge, child (+22 more)

### Community 4 - "user.dart"
Cohesion: 0.06
Nodes (26): build, controller, createState, dayRefresh, daysController, didChangeAppLifecycleState, didChangeDependencies, dispose (+18 more)

### Community 5 - "celebration.dart"
Cohesion: 0.06
Nodes (24): _WeightPainter, build, _MarkPainter, paint, SabzineMark, shouldRepaint, size, animation (+16 more)

### Community 6 - "expert.dart"
Cohesion: 0.07
Nodes (26): FoodRecord, Meal, addMealFromBank, approve, build, createState, dispose, editMeal (+18 more)

### Community 7 - "doctor.dart"
Cohesion: 0.07
Nodes (26): ExpertRecord, build, createState, didChangeDependencies, dispose, DoctorDetailsScreen, draft, ExpertProfileEditor (+18 more)

### Community 8 - "admin.dart"
Cohesion: 0.07
Nodes (28): active, AdminHome, AdminMoreScreen, AdminSettingsScreen, build, createState, dispose, editExpert (+20 more)

### Community 9 - "form_config.dart"
Cohesion: 0.07
Nodes (25): choice, choiceLabels, copy, core, defaultQuestions, defaultSections, enabled, extraQuestions (+17 more)

### Community 10 - "questionnaire.dart"
Cohesion: 0.08
Nodes (22): answers, back, build, createState, didChangeDependencies, dispose, _draft, editing (+14 more)

### Community 11 - "nutrition_log_storage.dart"
Cohesion: 0.09
Nodes (21): key, NutritionLogStorage, preferences, PreferencesNutritionLogStorage, read, write, key, _preferences (+13 more)

### Community 12 - "question_admin.dart"
Cohesion: 0.08
Nodes (24): FormConfiguration, QuestionKind, build, createState, didChangeDependencies, dispose, done, draft (+16 more)

### Community 13 - "app.dart"
Cohesion: 0.08
Nodes (15): AppRoot, build, createState, dispose, initialize, initState, restoreOnStart, role (+7 more)

### Community 14 - "shared.dart"
Cohesion: 0.09
Nodes (22): ChatThread, DietRequest, ArchivedPlanScreen, build, ChatScreen, _ChatScreenState, ConversationTile, createState (+14 more)

### Community 15 - "utils.cpp"
Cohesion: 0.12
Nodes (4): wWinMain(), CreateAndAttachConsole(), GetCommandLineArguments(), Utf8FromUtf16()

### Community 16 - "pubspec.yaml"
Cohesion: 0.08
Nodes (23): dependencies, flutter, flutter_localizations, shared_preferences, description, dev_dependencies, flutter_lints, flutter_test (+15 more)

### Community 17 - "StatelessWidget"
Cohesion: 0.09
Nodes (22): MealPreview, PlanSummaryScreen, PlanTimeline, ProfileScreen, TrackingScreen, _OfferCard, _PaymentField, ChoiceCard (+14 more)

### Community 18 - "day.dart"
Cohesion: 0.10
Nodes (17): 186, dailyEncouragement, dateKey, days, gy, gy2, j, jalali (+9 more)

### Community 19 - "nutrition.dart"
Cohesion: 0.11
Nodes (13): build, DailyAdviceCard, date, decimalFa, EnergyCard, index, s, ScheduledMealTile (+5 more)

### Community 20 - "win32_window.cpp"
Cohesion: 0.16
Nodes (6): EnableNonClientDpiScaling, Scale(), Win32Window::Win32Window(), WindowClassRegistrar, class_registered_, instance_

### Community 21 - "State"
Cohesion: 0.15
Nodes (16): PanelShell, _PanelShellState, AdminRequestsScreen, _AdminRequestsScreenState, TicketScreen, _TicketScreenState, RequestListScreen, _RequestListScreenState (+8 more)

### Community 22 - "widget_test.dart"
Cohesion: 0.11
Nodes (14): choose, ensureVisible, failWrites, field, item, main, mobile, next (+6 more)

### Community 23 - "capture_screens.dart"
Cohesion: 0.16
Nodes (3): main, main, main

### Community 24 - "dev_preview.dart"
Cohesion: 0.15
Nodes (8): boundaryKey, build, capturePath, child, createState, DevPreview, _DevPreviewState, initState

### Community 25 - "wallet_flow_test.dart"
Cohesion: 0.14
Nodes (11): PrimaryButton, cleanupWallet, ensureVisible, main, primary, pump, pumpAndSettle, pumpWidget (+3 more)

### Community 26 - "FlutterWindow"
Cohesion: 0.17
Nodes (3): FlutterWindow, flutter_controller_, project_

### Community 27 - "panels_test.dart"
Cohesion: 0.17
Nodes (9): ensureVisible, fail, main, pumpAndSettle, read, tap, tapVisible, value (+1 more)

### Community 28 - "nutrition_test.dart"
Cohesion: 0.18
Nodes (5): fail, main, read, value, write

### Community 29 - "extra_questions.dart"
Cohesion: 0.20
Nodes (7): FormQuestion, answers, build, createState, ExtraQuestionField, _ExtraQuestionFieldState, question

### Community 31 - "Win32Window"
Cohesion: 0.24
Nodes (4): Win32Window, child_content_, quit_on_close_, window_handle_

### Community 32 - "manifest.json"
Cohesion: 0.18
Nodes (10): background_color, description, display, icons, name, orientation, prefer_related_applications, short_name (+2 more)

### Community 36 - "analysis_options.yaml"
Cohesion: 0.33
Nodes (5): analyzer, exclude, include, linter, rules

### Community 38 - "package:flutter/material.dart"
Cohesion: 0.40
Nodes (3): appTheme, ink, pine

### Community 40 - "Point"
Cohesion: 0.50
Nodes (3): Point, x, y

### Community 41 - "Size"
Cohesion: 0.50
Nodes (3): Size, height, width

## Knowledge Gaps
- **543 isolated node(s):** `active`, `activity`, `addMeal`, `addPurchasedTokens`, `addWeight` (+538 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 687 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Meal` connect `expert.dart` to `demo_store.dart`, `user.dart`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `active`, `activity`, `addMeal` to the rest of the system?**
  _543 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `demo_store.dart` be split into smaller, more focused modules?**
  _Cohesion score 0.011235955056179775 - nodes in this community are weakly interconnected._
- **Why does `DietRequest` connect `shared.dart` to `demo_store.dart`, `ui.dart`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Should `wallet_catalog.dart` be split into smaller, more focused modules?**
  _Cohesion score 0.046511627906976744 - nodes in this community are weakly interconnected._
- **Why does `AppRole` connect `AppRole` to `demo_store.dart`, `wallet_catalog.dart`, `app.dart`, `doctor.dart`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Should `ui.dart` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._