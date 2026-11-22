import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
}

export interface EmailSender {
  send(message: EmailMessage): Promise<void>;
}

@Injectable()
export class GmailApiEmailSender implements EmailSender {
  async send(message: EmailMessage): Promise<void> {
    const accessToken = process.env.GMAIL_ACCESS_TOKEN;
    const sender = process.env.GMAIL_SENDER_EMAIL;
    if (!accessToken || !sender) {
      throw new ServiceUnavailableException(
        'El adaptador Gmail requiere OAuth y GMAIL_SENDER_EMAIL.',
      );
    }
    const raw = [
      `From: ${sender}`,
      `To: ${message.to}`,
      `Subject: ${message.subject}`,
      'Content-Type: text/plain; charset="UTF-8"',
      '',
      message.text,
    ].join('\r\n');
    const encoded = Buffer.from(raw)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');
    const response = await fetch(
      'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ raw: encoded }),
        signal: AbortSignal.timeout(10000),
      },
    );
    if (!response.ok) throw new Error('Gmail rechazó el envío.');
  }
}
