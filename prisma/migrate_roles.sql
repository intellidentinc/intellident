-- One-time migration: convert UserRole enum → Int
-- Run this BEFORE `npx prisma db push`
--   npx prisma db execute --stdin < prisma/migrate_roles.sql
--
-- Mapping: ADMIN=1, DENTIST=2, RECEPTIONIST=3, PATIENT=4

-- 1. Add temporary integer column
ALTER TABLE "User" ADD COLUMN "role_int" INTEGER;

-- 2. Populate from enum values
UPDATE "User" SET "role_int" = CASE
  WHEN "role"::text = 'ADMIN'        THEN 1
  WHEN "role"::text = 'DENTIST'      THEN 2
  WHEN "role"::text = 'RECEPTIONIST' THEN 3
  WHEN "role"::text = 'PATIENT'      THEN 4
  ELSE 4
END;

-- 3. Drop the old enum column
ALTER TABLE "User" DROP COLUMN "role";

-- 4. Rename int column to role
ALTER TABLE "User" RENAME COLUMN "role_int" TO "role";

-- 5. Add NOT NULL + default
ALTER TABLE "User" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 4;

-- 6. Drop the enum type
DROP TYPE IF EXISTS "UserRole";
