import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from '../config/logger';

const transporter = env.smtpHost
  ? nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPass } : undefined,
    })
  : undefined;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!transporter) {
    logger.info(`[email:dev-mode] Would send to=${to} subject="${subject}"`);
    return;
  }
  try {
    await transporter.sendMail({ from: env.smtpFrom, to, subject, html });
  } catch (err) {
    logger.error('Failed to send email', { error: err, to, subject });
  }
}
