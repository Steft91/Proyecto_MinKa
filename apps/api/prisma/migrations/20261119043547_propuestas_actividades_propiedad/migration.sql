-- CreateEnum
CREATE TYPE "estado_propuesta" AS ENUM ('pendiente_evaluacion', 'en_revision', 'aprobada', 'rechazada', 'retirada');

-- CreateEnum
CREATE TYPE "estado_actividad" AS ENUM ('publicada', 'finalizada', 'cancelada');

-- CreateTable
CREATE TABLE "propuesta" (
    "id_propuesta" UUID NOT NULL,
    "id_proponente" UUID NOT NULL,
    "id_categoria" UUID NOT NULL,
    "id_propuesta_origen" UUID,
    "titulo" VARCHAR(180) NOT NULL,
    "descripcion" TEXT NOT NULL,
    "finalidad_comunitaria" TEXT NOT NULL,
    "direccion_lugar" VARCHAR(255) NOT NULL,
    "latitud_lugar" DECIMAL(10,7) NOT NULL,
    "longitud_lugar" DECIMAL(10,7) NOT NULL,
    "inicio_previsto" TIMESTAMPTZ(3) NOT NULL,
    "fin_previsto" TIMESTAMPTZ(3) NOT NULL,
    "cupo_maximo" INTEGER NOT NULL,
    "estado" "estado_propuesta" NOT NULL DEFAULT 'pendiente_evaluacion',
    "version_actual" INTEGER NOT NULL DEFAULT 1,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actualizada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "propuesta_pkey" PRIMARY KEY ("id_propuesta")
);

-- CreateTable
CREATE TABLE "actividad" (
    "id_actividad" UUID NOT NULL,
    "id_propuesta" UUID NOT NULL,
    "id_organizador_actual" UUID NOT NULL,
    "estado" "estado_actividad" NOT NULL DEFAULT 'publicada',
    "version_publicada" INTEGER NOT NULL,
    "contenido_aprobado_json" JSONB NOT NULL,
    "publicada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalizada_en" TIMESTAMPTZ(3),
    "cancelada_en" TIMESTAMPTZ(3),
    "motivo_cancelacion" TEXT,

    CONSTRAINT "actividad_pkey" PRIMARY KEY ("id_actividad")
);

-- CreateIndex
CREATE INDEX "propuesta_id_proponente_idx" ON "propuesta"("id_proponente");

-- CreateIndex
CREATE INDEX "propuesta_id_categoria_idx" ON "propuesta"("id_categoria");

-- CreateIndex
CREATE INDEX "propuesta_id_propuesta_origen_idx" ON "propuesta"("id_propuesta_origen");

-- CreateIndex
CREATE UNIQUE INDEX "actividad_id_propuesta_key" ON "actividad"("id_propuesta");

-- CreateIndex
CREATE INDEX "actividad_id_organizador_actual_idx" ON "actividad"("id_organizador_actual");

-- AddForeignKey
ALTER TABLE "propuesta" ADD CONSTRAINT "propuesta_id_proponente_fkey" FOREIGN KEY ("id_proponente") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propuesta" ADD CONSTRAINT "propuesta_id_categoria_fkey" FOREIGN KEY ("id_categoria") REFERENCES "categoria_actividad"("id_categoria") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "propuesta" ADD CONSTRAINT "propuesta_id_propuesta_origen_fkey" FOREIGN KEY ("id_propuesta_origen") REFERENCES "propuesta"("id_propuesta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_id_propuesta_fkey" FOREIGN KEY ("id_propuesta") REFERENCES "propuesta"("id_propuesta") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_id_organizador_actual_fkey" FOREIGN KEY ("id_organizador_actual") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "propuesta" ADD CONSTRAINT "propuesta_cupo_positivo" CHECK ("cupo_maximo" > 0);
ALTER TABLE "propuesta" ADD CONSTRAINT "propuesta_version_positiva" CHECK ("version_actual" >= 1);
ALTER TABLE "propuesta" ADD CONSTRAINT "propuesta_fechas_validas" CHECK ("fin_previsto" > "inicio_previsto");
ALTER TABLE "actividad" ADD CONSTRAINT "actividad_version_positiva" CHECK ("version_publicada" >= 1);
