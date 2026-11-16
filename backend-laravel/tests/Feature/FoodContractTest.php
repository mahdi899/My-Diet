<?php

namespace Tests\Feature;

use App\Shared\Domain\LegacyCrypto;
use Tests\MySqlTestCase;

final class FoodContractTest extends MySqlTestCase
{
    private function food(string $slug = 'test_food'): array
    {
        return ['slug' => $slug, 'nameFa' => 'غذای آزمایشی', 'category' => 'main', 'mealTypes' => ['lunch', 'dinner'],
            'servingLabel' => '۱ کاسه', 'servingG' => 200, 'kcal' => 310, 'proteinG' => 14.5, 'carbsG' => 40, 'fatG' => 10.2, 'fiberG' => 8,
            'allergens' => [], 'tags' => ['vegetarian'], 'regions' => [], 'seasons' => [], 'costTier' => 1, 'prepMinutes' => 30,
            'ingredients' => [['name' => 'عدس', 'quantity' => 80, 'unit' => 'g', 'category' => 'pantry']]];
    }

    public function test_catalog_crud_images_compose_permissions_and_search(): void
    {
        $admin = $this->actor('admin');
        foreach (range(1, 3) as $index) {
            $this->postJson('/v1/admin/foods', [...$this->food('pagination_'.$index), 'nameFa' => 'خوراک نمونه '.$index])->assertCreated();
        }
        $auditBefore = $this->db->table('audit_logs')->where('actor_id', $admin['id'])->count();
        $initial = $this->getJson('/v1/admin/foods?limit=2')->assertOk()->assertJsonCount(2, 'items')->json();
        self::assertNotNull($initial['nextCursor']);
        $this->getJson('/v1/admin/foods?category=invalid')->assertStatus(400);
        $this->postJson('/v1/admin/foods', [...$this->food(), 'imageData' => base64_encode("\xff\xd8\xff".str_repeat('x', 40))])->assertCreated()->assertJsonPath('image', '/v1/public/food-images/test_food.jpg');
        $this->get('/v1/public/food-images/test_food.jpg')->assertOk()->assertHeader('content-type', 'image/jpeg');
        $this->postJson('/v1/admin/foods', $this->food())->assertStatus(409);
        $this->getJson('/v1/admin/foods?q=آزم')->assertOk()->assertJsonCount(1, 'items');
        $this->putJson('/v1/admin/foods/test_food', [...$this->food(), 'nameFa' => 'غذای ویرایش شده'])->assertOk()->assertJsonPath('nameFa', 'غذای ویرایش شده')->assertJsonPath('image', '/v1/public/food-images/test_food.jpg');
        $this->postJson('/v1/catalog/compose', ['kind' => 'specialist_alternative', 'items' => [['slug' => 'test_food', 'servings' => 1.5]], 'note' => 'نوش جان'])->assertCreated()
            ->assertJsonPath('macros.kcal', 465)->assertJsonPath('macros.proteinG', 22)->assertJsonPath('option.ingredients.0.quantity', 120)->assertJsonPath('option.approved', false);
        $this->postJson('/v1/admin/foods/test_food/active', ['active' => false])->assertCreated()->assertJsonPath('active', false);
        $this->postJson('/v1/catalog/compose', ['kind' => 'primary', 'items' => [['slug' => 'test_food', 'servings' => 1]]])->assertStatus(409)->assertJsonPath('code', 'food_inactive');
        $this->putJson('/v1/admin/foods/test_food', [...$this->food(), 'imageData' => null, 'image' => '/v1/public/food-images/test_food.jpg'])->assertOk()->assertJsonPath('image', null);
        $this->get('/v1/public/food-images/test_food.jpg')->assertNotFound();
        self::assertSame($auditBefore + 4, $this->db->table('audit_logs')->where('actor_id', $admin['id'])->count());
        $this->actor();
        $this->getJson('/v1/admin/foods')->assertForbidden();
        $this->getJson('/v1/catalog/foods')->assertForbidden();
    }

    public function test_csv_round_trip_validation_and_atomic_import(): void
    {
        $this->actor('admin');
        $this->postJson('/v1/admin/foods', $this->food())->assertCreated();
        $csv = $this->getJson('/v1/admin/foods/export')->assertOk()->json('csv');
        self::assertStringStartsWith("\xef\xbb\xbfslug,name_fa", $csv);
        $before = $this->db->table('food_catalog')->count();
        $this->postJson('/v1/admin/foods/import', ['csv' => $csv])->assertCreated()->assertExactJson(['created' => 0, 'updated' => $before]);
        $this->get('/v1/admin/foods/export.csv')->assertOk()->assertHeader('content-disposition', 'attachment; filename="sabzine-foods.csv"');
        $this->postJson('/v1/admin/foods/import', ['csv' => $csv."invalid,row\r\n"])->assertStatus(400)->assertJsonPath('code', 'validation');
        self::assertSame($before, $this->db->table('food_catalog')->count());
        $this->postJson('/v1/admin/foods/import', ['csv' => 'bad,headers'])->assertStatus(400);
    }

    public function test_catalog_replacement_checks_revision_keeps_backup_and_is_idempotent(): void
    {
        $this->actor('admin');
        $before = $this->getJson('/v1/admin/foods/export.json')->assertOk()->json('foods');
        $revision = $this->getJson('/v1/admin/foods/revision')->assertOk()->json('revision');
        $id = LegacyCrypto::uuid();
        $body = ['operationId' => $id, 'expectedRevision' => $revision, 'foods' => [$this->food()]];
        $this->postJson('/v1/admin/foods/replace', [...$body, 'expectedRevision' => str_repeat('0', 32)])->assertStatus(409)->assertJsonPath('code', 'catalog_changed');
        $this->postJson('/v1/admin/foods/replace', $body)->assertCreated()->assertExactJson(['replaced' => 1, 'removed' => count($before), 'backupId' => $id]);
        $this->postJson('/v1/admin/foods/replace', $body)->assertCreated()->assertExactJson(['replaced' => 1, 'backupId' => $id, 'duplicate' => true]);
        $backup = $this->getJson('/v1/admin/foods/backups/'.$id)->assertOk()->json('foods');
        self::assertEquals($before, $backup);
        self::assertSame(1, $this->db->table('food_catalog')->count());
        self::assertNotSame($revision, $this->getJson('/v1/admin/foods/revision')->json('revision'));
    }

    public function test_validation_paths_preserve_source_contract(): void
    {
        $this->actor('admin');
        foreach ([['kcal' => -1, 'path' => 'kcal'], ['proteinG' => '10', 'path' => 'proteinG'], ['mealTypes' => [], 'path' => 'mealTypes'], ['ingredients' => [['name' => 'عدس', 'quantity' => 0, 'unit' => 'g', 'category' => 'pantry']], 'path' => 'ingredients.0.quantity']] as $case) {
            $path = $case['path'];
            unset($case['path']);
            $this->postJson('/v1/admin/foods', [...$this->food(), ...$case])->assertStatus(400)->assertJsonPath('messageFa', 'فیلد «'.$path.'» معتبر نیست');
        }
        $this->postJson('/v1/catalog/compose', ['kind' => 'primary', 'items' => [['slug' => 'test_food', 'servings' => 0]]])->assertStatus(400);
    }
}
