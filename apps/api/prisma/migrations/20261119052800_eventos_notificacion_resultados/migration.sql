-- CreateEnum
CREATE TYPE "estado_entrega_evento" AS ENUM ('pendiente', 'enviando', 'entregada');

-- AlterTable
ALTER TABLE "evaluacion_ia" ADD COLUMN     "evento_clave" VARCHAR(180);

-- CreateTable
CREATE TABLE "evento_notificacion" (
    "id_evento" UUID NOT NULL,
    "evento_clave" VARCHAR(180) NOT NULL,
    "id_destinatario" UUID NOT NULL,
    "payload_json" JSONB NOT NULL,
    "estado" "estado_entrega_evento" NOT NULL DEFAULT 'pendiente',
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "token_reclamo" UUID,
    "reclamo_hasta" TIMESTAMPTZ(3),
    "proximo_intento" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimo_error" TEXT,
    "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregada_en" TIMESTAMPTZ(3),

    CONSTRAINT "evento_notificacion_pkey" PRIMARY KEY ("id_evento")
);

-- CreateIndex
CREATE UNIQUE INDEX "evento_notificacion_evento_clave_key" ON "evento_notificacion"("evento_clave");

-- CreateIndex
CREATE INDEX "evento_notificacion_estado_proximo_intento_idx" ON "evento_notificacion"("estado", "proximo_intento");

-- CreateIndex
CREATE UNIQUE INDEX "evaluacion_ia_evento_clave_key" ON "evaluacion_ia"("evento_clave");

-- AddForeignKey
ALTER TABLE "evento_notificacion" ADD CONSTRAINT "evento_notificacion_id_destinatario_fkey" FOREIGN KEY ("id_destinatario") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
