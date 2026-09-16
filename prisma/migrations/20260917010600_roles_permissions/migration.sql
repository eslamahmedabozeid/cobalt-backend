-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_slug_key" ON "Role"("slug");

INSERT INTO "Role" ("id", "slug", "name", "description", "isSystem", "permissions", "createdAt", "updatedAt")
VALUES
  (
    'role-super-admin',
    'super-admin',
    'مدير النظام',
    'صلاحيات كاملة على كل الأقسام والعمليات',
    1,
    '*',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'role-editor',
    'editor',
    'محرر',
    'إدارة المحتوى والمتجر بدون إدارة المستخدمين والأدوار',
    1,
    '{"dashboard":["read","create","update","delete"],"orders":["read","create","update","delete"],"services":["read","create","update","delete"],"categories":["read","create","update","delete"],"bundles":["read","create","update","delete"],"coupons":["read","create","update","delete"],"calculator":["read","create","update","delete"],"homepage":["read","create","update","delete"],"hero-slides":["read","create","update","delete"],"portfolio":["read","create","update","delete"],"testimonials":["read","create","update","delete"],"faqs":["read","create","update","delete"],"media":["read","create","update","delete"],"navigation":["read","create","update","delete"],"footer-links":["read","create","update","delete"],"top-bar":["read","create","update","delete"],"currencies":["read","create","update","delete"],"settings":["read","create","update","delete"]}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  ),
  (
    'role-viewer',
    'viewer',
    'مشاهد',
    'عرض فقط بدون إضافة أو تعديل أو حذف',
    1,
    '{"dashboard":["read"],"orders":["read"],"services":["read"],"categories":["read"],"bundles":["read"],"coupons":["read"],"calculator":["read"],"homepage":["read"],"hero-slides":["read"],"portfolio":["read"],"testimonials":["read"],"faqs":["read"],"media":["read"],"navigation":["read"],"footer-links":["read"],"top-bar":["read"],"currencies":["read"],"settings":["read"]}',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "roleId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AdminUser_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_AdminUser" ("id", "email", "passwordHash", "name", "createdAt", "updatedAt", "active", "roleId")
SELECT "id", "email", "passwordHash", "name", "createdAt", "updatedAt", 1, 'role-super-admin' FROM "AdminUser";
DROP TABLE "AdminUser";
ALTER TABLE "new_AdminUser" RENAME TO "AdminUser";
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
