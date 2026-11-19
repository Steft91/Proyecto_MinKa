-- CreateEnum
CREATE TYPE "estado_inscripcion" AS ENUM ('activa', 'pendiente_suspension', 'cancelada_ciudadano', 'cancelada_suspension', 'cancelada_actividad');

-- CreateTable
CREATE TABLE "inscripcion" (
    "id_inscripcion" UUID NOT NULL,
    "id_usuario" UUID NOT NULL,
    "id_actividad" UUID NOT NULL,
    "estado" "estado_inscripcion" NOT NULL DEFAULT 'activa',
    "inscrita_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelada_en" TIMESTAMPTZ(3),
    "motivo_cancelacion" VARCHAR(255),
    "penalizacion_cancelacion_aplicada" BOOLEAN NOT NULL DEFAULT false,
    "reactivada_en" TIMESTAMPTZ(3),
    "evento_cancelacion_actual" VARCHAR(180),

    CONSTRAINT "inscripcion_pkey" PRIMARY KEY ("id_inscripcion")
);

-- CreateIndex
CREATE INDEX "inscripcion_id_actividad_estado_idx" ON "inscripcion"("id_actividad", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "inscripcion_id_usuario_id_actividad_key" ON "inscripcion"("id_usuario", "id_actividad");

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inscripcion" ADD CONSTRAINT "inscripcion_id_actividad_fkey" FOREIGN KEY ("id_actividad") REFERENCES "actividad"("id_actividad") ON DELETE RESTRICT ON UPDATE CASCADE;
