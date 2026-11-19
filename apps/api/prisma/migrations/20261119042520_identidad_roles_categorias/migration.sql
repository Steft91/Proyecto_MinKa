-- CreateEnum
CREATE TYPE "estado_usuario" AS ENUM ('activo', 'suspendido');

-- CreateTable
CREATE TABLE "persona" (
    "id_persona" UUID NOT NULL,
    "nombres" VARCHAR(120) NOT NULL,
    "apellidos" VARCHAR(120) NOT NULL,
    "fecha_nacimiento" DATE NOT NULL,
    "sector_residencia" VARCHAR(120) NOT NULL,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id_persona")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" UUID NOT NULL,
    "id_persona" UUID NOT NULL,
    "google_subject" VARCHAR(255) NOT NULL,
    "correo" VARCHAR(255) NOT NULL,
    "correo_verificado" BOOLEAN NOT NULL,
    "perfil_completo" BOOLEAN NOT NULL,
    "estado" "estado_usuario" NOT NULL DEFAULT 'activo',
    "puntos" INTEGER NOT NULL DEFAULT 0,
    "estrellas" DECIMAL(3,1) NOT NULL DEFAULT 5,
    "creado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" UUID NOT NULL,
    "nombre" VARCHAR(40) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "id_usuario_rol" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_rol" UUID NOT NULL,
    "asignado_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("id_usuario_rol")
);

-- CreateTable
CREATE TABLE "categoria_actividad" (
    "id_categoria" UUID NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(120) NOT NULL,
    "habilitada" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "categoria_actividad_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_id_persona_key" ON "usuario"("id_persona");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_google_subject_key" ON "usuario"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_key" ON "rol"("nombre");

-- CreateIndex
CREATE INDEX "usuario_rol_id_rol_idx" ON "usuario_rol"("id_rol");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_rol_id_usuario_id_rol_key" ON "usuario_rol"("id_usuario", "id_rol");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_actividad_codigo_key" ON "categoria_actividad"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "categoria_actividad_nombre_key" ON "categoria_actividad"("nombre");

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "usuario_rol_id_rol_fkey" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Reglas de reputación del diccionario, también exigidas por PostgreSQL.
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_puntos_no_negativos" CHECK ("puntos" >= 0);
ALTER TABLE "usuario" ADD CONSTRAINT "usuario_estrellas_rango" CHECK ("estrellas" BETWEEN 0 AND 5);
