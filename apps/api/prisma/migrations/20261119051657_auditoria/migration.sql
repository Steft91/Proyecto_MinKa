-- CreateTable
CREATE TABLE "registro_auditoria" (
    "id_auditoria" UUID NOT NULL,
    "id_actor" UUID,
    "entidad_afectada" VARCHAR(80) NOT NULL,
    "identificador_afectado" UUID NOT NULL,
    "accion" VARCHAR(90) NOT NULL,
    "estado_anterior" TEXT,
    "estado_nuevo" TEXT,
    "motivo" TEXT,
    "metadatos_json" JSONB,
    "evento_clave" VARCHAR(180),
    "ocurrido_en" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registro_auditoria_pkey" PRIMARY KEY ("id_auditoria")
);

-- CreateIndex
CREATE UNIQUE INDEX "registro_auditoria_evento_clave_key" ON "registro_auditoria"("evento_clave");

-- CreateIndex
CREATE INDEX "registro_auditoria_entidad_afectada_identificador_afectado__idx" ON "registro_auditoria"("entidad_afectada", "identificador_afectado", "ocurrido_en");

-- AddForeignKey
ALTER TABLE "registro_auditoria" ADD CONSTRAINT "registro_auditoria_id_actor_fkey" FOREIGN KEY ("id_actor") REFERENCES "usuario"("id_usuario") ON DELETE RESTRICT ON UPDATE CASCADE;
