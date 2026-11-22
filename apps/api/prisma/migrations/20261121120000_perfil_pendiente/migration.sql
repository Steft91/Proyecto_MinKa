ALTER TABLE "persona"
  ALTER COLUMN "nombres" DROP NOT NULL,
  ALTER COLUMN "apellidos" DROP NOT NULL,
  ALTER COLUMN "fecha_nacimiento" DROP NOT NULL,
  ALTER COLUMN "sector_residencia" DROP NOT NULL;
