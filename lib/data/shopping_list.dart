import 'dart:convert';
import 'meal_plan.dart';

String shoppingRowKey(MealIngredient ingredient) =>
    jsonEncode([ingredient.id, ingredient.unit, ingredient.basis]);
String shoppingQuantity(double value) => value == value.roundToDouble()
    ? value.toInt().toString()
    : double.parse(value.toStringAsPrecision(12)).toString();

class MissingShoppingIngredient {
  const MissingShoppingIngredient(this.meal, this.description);
  final String meal, description;
}

class ShoppingListData {
  const ShoppingListData(this.rows, this.missing);
  final List<ShoppingIngredient> rows;
  final List<MissingShoppingIngredient> missing;
}

ShoppingListData aggregateShoppingIngredients(Iterable<Meal> meals) {
  final rows = <String, ShoppingIngredient>{};
  final missing = <MissingShoppingIngredient>[];
  for (final meal in meals) {
    if (meal.ingredients.isEmpty) {
      missing.add(MissingShoppingIngredient(meal.title, 'مواد اولیه ثبت نشده'));
    }
    for (final ingredient in meal.ingredients) {
      if (!ingredient.complete || !ingredient.quantity!.isFinite) {
        missing.add(
          MissingShoppingIngredient(
            meal.title,
            ingredient.name.isEmpty
                ? 'نام یا مقدار ماده ثبت نشده'
                : '${ingredient.name}: مقدار یا واحد کامل نیست',
          ),
        );
        continue;
      }
      final key = shoppingRowKey(ingredient);
      rows[key] = ShoppingIngredient(
        ingredient,
        (rows[key]?.quantity ?? 0) + ingredient.quantity!,
      );
    }
  }
  final result = rows.values.toList()
    ..sort((a, b) {
      final category = a.ingredient.category.compareTo(b.ingredient.category);
      return category == 0
          ? a.ingredient.name.compareTo(b.ingredient.name)
          : category;
    });
  return ShoppingListData(
    List.unmodifiable(result),
    List.unmodifiable(missing),
  );
}

class ShoppingMark {
  const ShoppingMark(this.status, this.quantity);
  final String status;
  final double quantity;
  Map<String, Object> toJson() => {'status': status, 'quantity': quantity};
  factory ShoppingMark.fromJson(Map<String, dynamic> json) {
    final status = json['status'], quantity = json['quantity'];
    if (!['have', 'purchased'].contains(status) ||
        quantity is! num ||
        !quantity.isFinite ||
        quantity <= 0) {
      throw const FormatException('Invalid shopping mark');
    }
    return ShoppingMark(status as String, quantity.toDouble());
  }
}
