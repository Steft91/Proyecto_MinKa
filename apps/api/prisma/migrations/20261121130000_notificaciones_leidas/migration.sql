ALTER TABLE "evento_notificacion"
  ADD COLUMN "leida_en" TIMESTAMPTZ(3);

CREATE INDEX "evento_notificacion_destinatario_leida_idx"
  ON "evento_notificacion" ("id_destinatario", "leida_en");
