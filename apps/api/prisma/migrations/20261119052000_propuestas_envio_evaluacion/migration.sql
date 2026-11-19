-- CreateEnum
CREATE TYPE "estado_solicitud_evaluacion" AS ENUM ('pendiente', 'enviando', 'entregada', 'requiere_revision');

-- AlterTable
ALTER TABLE "propuesta" ADD COLUMN     "clave_creacion" UUID;

-- CreateTable
CREATE TABLE "solicitud_evaluacion" (
    "id_solicitud" UUID NOT NULL,
    "id_propuesta" UUID NOT NULL,
    "version_propuesta" INTEGER NOT NULL,
    "evento_clave" VARCHAR(180) NOT NULL,
    "contenido_json" JSONB NOT NULL,
    "estado" "estado_solicitud_evaluacion" NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "token_reclamo" UUID,
    "reclamo_hasta" TIMESTAMPTZ(3),
    "ultimo_error" TEXT,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregada_en" TIMESTAMPTZ(3),

    CONSTRAINT "solicitud_evaluacion_pkey" PRIMARY KEY ("id_solicitud")
);

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_evaluacion_evento_clave_key" ON "solicitud_evaluacion"("evento_clave");

-- CreateIndex
CREATE INDEX "solicitud_evaluacion_estado_reclamo_hasta_idx" ON "solicitud_evaluacion"("estado", "reclamo_hasta");

-- CreateIndex
CREATE UNIQUE INDEX "solicitud_evaluacion_id_propuesta_version_propuesta_key" ON "solicitud_evaluacion"("id_propuesta", "version_propuesta");

-- CreateIndex
CREATE UNIQUE INDEX "propuesta_id_proponente_clave_creacion_key" ON "propuesta"("id_proponente", "clave_creacion");

-- AddForeignKey
ALTER TABLE "solicitud_evaluacion" ADD CONSTRAINT "solicitud_evaluacion_id_propuesta_fkey" FOREIGN KEY ("id_propuesta") REFERENCES "propuesta"("id_propuesta") ON DELETE RESTRICT ON UPDATE CASCADE;
