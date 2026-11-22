CREATE TYPE "estado_envio_correo" AS ENUM ('pendiente', 'enviando', 'entregado');

CREATE TABLE "envio_correo" (
  "id_envio" UUID NOT NULL,
  "id_evento" UUID NOT NULL,
  "destinatario" VARCHAR(255) NOT NULL,
  "asunto" VARCHAR(180) NOT NULL,
  "cuerpo" TEXT NOT NULL,
  "estado" "estado_envio_correo" NOT NULL DEFAULT 'pendiente',
  "intentos" INTEGER NOT NULL DEFAULT 0,
  "token_reclamo" UUID,
  "reclamo_hasta" TIMESTAMPTZ(3),
  "proximo_intento" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimo_error" TEXT,
  "creada_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "entregada_en" TIMESTAMPTZ(3),
  CONSTRAINT "envio_correo_pkey" PRIMARY KEY ("id_envio")
);

CREATE UNIQUE INDEX "envio_correo_id_evento_key" ON "envio_correo"("id_evento");
CREATE INDEX "envio_correo_estado_proximo_intento_idx"
  ON "envio_correo"("estado", "proximo_intento");
ALTER TABLE "envio_correo"
  ADD CONSTRAINT "envio_correo_id_evento_fkey"
  FOREIGN KEY ("id_evento") REFERENCES "evento_notificacion"("id_evento")
  ON DELETE CASCADE ON UPDATE CASCADE;
