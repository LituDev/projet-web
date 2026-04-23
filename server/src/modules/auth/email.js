import { logger } from '../../logger.js';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_FROM = process.env.SMTP_FROM || 'no-reply@gumes.local';

let transporter = null;

if (SMTP_HOST) {
  try {
    const { default: nodemailer } = await import('nodemailer');
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  } catch {
    logger.warn('SMTP_HOST défini mais nodemailer indisponible — npm install nodemailer dans server/');
  }
}

export async function sendPasswordResetEmail(toEmail, resetUrl) {
  if (transporter) {
    await transporter.sendMail({
      from: SMTP_FROM,
      to: toEmail,
      subject: 'Réinitialisation de votre mot de passe — Gumes',
      text: `Réinitialisez votre mot de passe (lien valable 15 min) :\n\n${resetUrl}\n\nSi vous n'avez pas fait cette demande, ignorez ce message.`,
      html: `<p>Cliquez sur ce lien pour réinitialiser votre mot de passe (valable 15&nbsp;min)&nbsp;:</p>
             <p><a href="${resetUrl}">${resetUrl}</a></p>
             <p><small>Si vous n'avez pas fait cette demande, ignorez ce message.</small></p>`,
    });
  } else {
    logger.info({ to: toEmail }, '[DEV] Email de réinitialisation (pas de SMTP configuré)');
    console.log(`\n📧  RESET PASSWORD [DEV MODE]\n   Pour : ${toEmail}\n   Lien : ${resetUrl}\n`);
  }
}
