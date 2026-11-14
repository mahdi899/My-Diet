<?php

namespace Tests\Feature;

use Tests\MySqlTestCase;

final class PublishingContractTest extends MySqlTestCase
{
    private function article(): array
    {
        return ['slug' => 'mysql-migration', 'title' => 'مقالهٔ آزمایشی', 'category' => 'تغذیه', 'image' => 1, 'readingMinutes' => 5, 'intro' => 'مقدمهٔ آزمایشی',
            'sections' => [['heading' => 'بخش اول', 'body' => 'متن مقاله']]];
    }

    public function test_article_lifecycle_versions_public_filtering_and_access_rules(): void
    {
        $public = $this->getJson('/v1/public/articles')->assertOk()->json();
        self::assertGreaterThan(0, $public['total']);
        $admin = $this->actor('admin');
        $this->postJson('/v1/admin/articles', $this->article())->assertCreated()->assertJsonPath('version', 1)->assertJsonPath('status', 'draft');
        $this->getJson('/v1/public/articles/mysql-migration')->assertNotFound();
        $this->postJson('/v1/admin/articles', $this->article())->assertStatus(409)->assertJsonPath('code', 'slug_taken');
        $this->postJson('/v1/admin/articles/mysql-migration/publish')->assertCreated()->assertJsonPath('version', 2)->assertJsonPath('replayed', false);
        $this->postJson('/v1/admin/articles/mysql-migration/publish')->assertCreated()->assertJsonPath('version', 2)->assertJsonPath('replayed', true);
        $this->getJson('/v1/public/articles/mysql-migration')->assertOk()->assertJsonPath('sections.0.body', 'متن مقاله');
        $input = $this->article();
        unset($input['slug']);
        $this->putJson('/v1/admin/articles/mysql-migration', [...$input, 'title' => 'عنوان جدید'])->assertOk()->assertJsonPath('version', 3);
        $this->postJson('/v1/admin/articles/mysql-migration/unpublish')->assertCreated()->assertJsonPath('version', 4);
        $this->getJson('/v1/public/articles/mysql-migration')->assertNotFound();
        $id = $this->db->table('articles')->where('slug', 'mysql-migration')->value('id');
        self::assertSame(4, $this->db->table('article_versions')->where('article_id', $id)->count());
        self::assertSame(4, $this->db->table('audit_logs')->where('actor_id', $admin['id'])->count());
        $this->actor();
        $this->getJson('/v1/admin/articles')->assertForbidden();
    }

    public function test_consent_versions_records_and_replays(): void
    {
        $this->actor('admin');
        $this->postJson('/v1/admin/consents', ['purpose' => 'test_consent', 'summary' => 'اجازهٔ پردازش اطلاعات سلامت', 'status' => 'published'])->assertCreated()->assertExactJson(['purpose' => 'test_consent', 'version' => 1, 'status' => 'published']);
        $this->getJson('/v1/public/consents')->assertOk()->assertJsonFragment(['purpose' => 'test_consent', 'version' => 1]);
        $user = $this->actor();
        $this->postJson('/v1/me/consents', ['purpose' => 'test_consent', 'version' => 1])->assertCreated()->assertJsonPath('replayed', false);
        $this->postJson('/v1/me/consents', ['purpose' => 'test_consent', 'version' => 1])->assertCreated()->assertJsonPath('replayed', true);
        $this->getJson('/v1/me/consents')->assertOk()->assertJsonCount(1, 'records');
        $this->postJson('/v1/me/consents', ['purpose' => 'test_consent', 'version' => 2])->assertNotFound();
        self::assertSame(1, $this->db->table('consent_records')->where('user_id', $user['id'])->count());
    }

    public function test_config_and_unsafe_content_validation(): void
    {
        $this->getJson('/v1/public/articles?page=0')->assertStatus(400)->assertJsonPath('messageFa', 'صفحه درست نیست');
        $this->getJson('/v1/public/articles?pageSize=21')->assertStatus(400);
        $this->actor('admin');
        $this->postJson('/v1/admin/articles', [...$this->article(), 'title' => '<script>'])->assertStatus(400)->assertJsonPath('code', 'unsafe_content');
        $this->postJson('/v1/admin/articles', [...$this->article(), 'extra' => 1])->assertStatus(400);
        $this->putJson('/v1/admin/public-config', ['minAppVersion' => '1.2.3', 'downloadStatus' => 'released', 'downloadUrl' => 'http://localhost/app.apk'])->assertStatus(400);
        $this->putJson('/v1/admin/public-config', ['minAppVersion' => '1.2.3', 'downloadStatus' => 'not_released', 'downloadUrl' => null])->assertOk()->assertJsonPath('download.url', null);
        $this->getJson('/v1/public/app-download')->assertOk()->assertJsonPath('minAppVersion', '1.2.3')->assertJsonPath('download.status', 'not_released');
    }
}
