import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { EventoNotificable } from '@minka/contracts';
import type {
  EnvioCorreo,
  EventoNotificacion,
  Prisma,
} from '../../generated/prisma/client.js';
import { PrismaService } from '../../database/prisma.service.js';
import { GmailApiEmailSender } from './email-sender.js';

@Injectable()
export class NotificationEventsService
  implements OnModuleInit, OnModuleDestroy
{
  private timer?: ReturnType<typeof setInterval>;
  private emailTimer?: ReturnType<typeof setInterval>;
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSender: GmailApiEmailSender,
  ) {}

  async enqueue(event: EventoNotificable, tx: Prisma.TransactionClient) {
    const notification = await tx.eventoNotificacion.upsert({
      where: { evento_clave: event.evento_clave },
      update: {},
      create: {
        evento_clave: event.evento_clave,
        id_destinatario: event.id_destinatario,
        payload_json: { ...event },
      },
    });
    const recipient = await tx.usuario.findUnique({
      where: { id_usuario: event.id_destinatario },
      select: { correo: true },
    });
    if (recipient) {
      await tx.envioCorreo.upsert({
        where: { id_evento: notification.id_evento },
        update: {},
        create: {
          id_evento: notification.id_evento,
          destinatario: recipient.correo,
          asunto: event.titulo,
          cuerpo: event.mensaje,
        },
      });
    }
    return notification;
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV !== 'test') {
      this.timer = setInterval(() => {
        void this.dispatchOne().catch(() => {
          /* El registro duradero conserva el reintento. */
        });
      }, 5000);
      this.timer.unref();
      this.emailTimer = setInterval(() => {
        void this.dispatchEmailOne().catch(() => {
          /* El registro conserva el correo para reintentar. */
        });
      }, 5000);
      this.emailTimer.unref();
    }
  }
  onModuleDestroy(): void {
    clearInterval(this.timer);
    clearInterval(this.emailTimer);
  }

  async dispatchOne(): Promise<boolean> {
    const url = process.env.MINKA_NOTIFICATIONS_URL;
    const secret = process.env.MINKA_NOTIFICATIONS_TOKEN;
    if (!url || !secret) return false;
    const token = randomUUID();
    const event = await this.prisma.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<
        EventoNotificacion[]
      >`SELECT * FROM evento_notificacion
        WHERE (estado = 'pendiente' AND proximo_intento <= NOW()) OR (estado = 'enviando' AND reclamo_hasta < NOW())
        ORDER BY creada_en, id_evento FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.eventoNotificacion.update({
        where: { id_evento: rows[0].id_evento },
        data: {
          estado: 'enviando',
          token_reclamo: token,
          reclamo_hasta: new Date(Date.now() + 30000),
          intentos: { increment: 1 },
        },
      });
    });
    if (!event) return false;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
          'Idempotency-Key': event.evento_clave,
        },
        body: JSON.stringify(event.payload_json),
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) throw new Error('Entrega rechazada');
      const ack: unknown = await response.json();
      if (
        !ack ||
        typeof ack !== 'object' ||
        !('aceptada' in ack) ||
        ack.aceptada !== true ||
        !('evento_clave' in ack) ||
        ack.evento_clave !== event.evento_clave
      )
        throw new Error('Acuse inválido');
      await this.prisma.client.eventoNotificacion.updateMany({
        where: { id_evento: event.id_evento, token_reclamo: token },
        data: {
          estado: 'entregada',
          entregada_en: new Date(),
          token_reclamo: null,
          reclamo_hasta: null,
          ultimo_error: null,
        },
      });
    } catch {
      await this.prisma.client.eventoNotificacion.updateMany({
        where: { id_evento: event.id_evento, token_reclamo: token },
        data: {
          estado: 'pendiente',
          token_reclamo: null,
          reclamo_hasta: null,
          ultimo_error:
            'No se pudo confirmar la entrega al módulo de notificaciones.',
          proximo_intento: new Date(
            Date.now() +
              Math.min(3600000, 1000 * 2 ** Math.min(event.intentos, 12)),
          ),
        },
      });
    }
    return true;
  }

  async dispatchEmailOne(): Promise<boolean> {
    if (!process.env.GMAIL_ACCESS_TOKEN || !process.env.GMAIL_SENDER_EMAIL)
      return false;
    const token = randomUUID();
    const email = await this.prisma.client.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<EnvioCorreo[]>`
        SELECT * FROM envio_correo
        WHERE (estado = 'pendiente' AND proximo_intento <= NOW())
           OR (estado = 'enviando' AND reclamo_hasta < NOW())
        ORDER BY creada_en, id_envio FOR UPDATE SKIP LOCKED LIMIT 1`;
      if (!rows[0]) return null;
      return tx.envioCorreo.update({
        where: { id_envio: rows[0].id_envio },
        data: {
          estado: 'enviando',
          token_reclamo: token,
          reclamo_hasta: new Date(Date.now() + 30000),
          intentos: { increment: 1 },
        },
      });
    });
    if (!email) return false;
    try {
      await this.emailSender.send({
        to: email.destinatario,
        subject: email.asunto,
        text: email.cuerpo,
      });
      await this.prisma.client.envioCorreo.updateMany({
        where: { id_envio: email.id_envio, token_reclamo: token },
        data: {
          estado: 'entregado',
          entregada_en: new Date(),
          token_reclamo: null,
          reclamo_hasta: null,
          ultimo_error: null,
        },
      });
    } catch {
      await this.prisma.client.envioCorreo.updateMany({
        where: { id_envio: email.id_envio, token_reclamo: token },
        data: {
          estado: 'pendiente',
          token_reclamo: null,
          reclamo_hasta: null,
          ultimo_error: 'No se pudo entregar el correo por Gmail.',
          proximo_intento: new Date(
            Date.now() + Math.min(3600000, 1000 * 2 ** Math.min(email.intentos, 12)),
          ),
        },
      });
    }
    return true;
  }
}
