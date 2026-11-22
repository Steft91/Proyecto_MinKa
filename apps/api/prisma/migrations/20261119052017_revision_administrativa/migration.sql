-- CreateEnum
CREATE TYPE "resultado_evaluacion" AS ENUM ('favorable', 'requiere_revision', 'error');

-- CreateEnum
CREATE TYPE "decision_revision" AS ENUM ('aprobada', 'rechazada');

-- CreateTable
CREATE TABLE "evaluacion_ia" (
    "id_evaluacion" UUID NOT NULL,
    "id_propuesta" UUID NOT NULL,
    "version_politica" VARCHAR(50) NOT NULL,
    "modelo_proveedor" VARCHAR(120),
    "resultado" "resultado_evaluacion" NOT NULL,
    "indicadores_json" JSONB NOT NULL,
    "razones" TEXT,
    "respuesta_valida" BOOLEAN NOT NULL,
    "version_propuesta" INTEGER NOT NULL,
    "contenido_evaluado_json" JSONB NOT NULL,
    "registrada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evaluacion_ia_pkey" PRIMARY KEY ("id_evaluacion")
);

-- CreateTable
CREATE TABLE "revision_administrativa" (
    "id_revision" UUID NOT NULL,
    "id_propuesta" UUID NOT NULL,
    "id_evaluacion" UUID,
    "id_administrador" UUID NOT NULL,
    "decision" "decision_revision" NOT NULL,
    "motivo" TEXT NOT NULL,
    "version_propuesta" INTEGER NOT NULL,
    "contenido_revisado_json" JSONB NOT NULL,
    "decidida_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "revision_administrativa_pkey" PRIMARY KEY ("id_revision")
);

-- CreateIndex
CREATE INDEX "evaluacion_ia_id_propuesta_version_propuesta_idx" ON "evaluacion_ia"("id_propuesta", "version_propuesta");

-- CreateIndex
CREATE UNIQUE INDEX "revision_administrativa_id_propuesta_version_propuesta_key" ON "revision_administrativa"("id_propuesta", "version_propuesta");

-- AddForeignKey
ALTER TABLE "evaluacion_ia" ADD CONSTRAINT "evaluacion_ia_id_propuesta_fkey" FOREIGN KEY ("id_propuesta") REFERENCES "propuesta"("id_propuesta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_administrativa" ADD CONSTRAINT "revision_administrativa_id_propuesta_fkey" FOREIGN KEY ("id_propuesta") REFERENCES "propuesta"("id_propuesta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_administrativa" ADD CONSTRAINT "revision_administrativa_id_evaluacion_fkey" FOREIGN KEY ("id_evaluacion") REFERENCES "evaluacion_ia"("id_evaluacion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_administrativa" ADD CONSTRAINT "revision_administrativa_id_administrador_fkey" FOREIGN KEY ("id_administrador") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
