import nodemailer from "nodemailer";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text: string;
  html: string;
  from?: string;
  replyTo?: string;
};

function getDefaultFromAddress(): string {
  const email =
    process.env.LEGALVAULT_EMAIL_FROM ||
    process.env.EMAIL_FROM;

  if (!email) {
    throw new Error(
      "LEGALVAULT_EMAIL_FROM or EMAIL_FROM is not configured.",
    );
  }

  return email;
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(
    process.env.SMTP_PORT || "587",
  );

  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;

  if (!host || !user || !password) {
    throw new Error(
      "SMTP email configuration is incomplete.",
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure:
      process.env.SMTP_SECURE === "true",
    auth: {
      user,
      pass: password,
    },
  });
}

export async function sendEmail(
  input: SendEmailInput,
) {
  const transporter =
    createTransporter();

  const from =
    input.from || getDefaultFromAddress();

  const result =
    await transporter.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });

  return {
    messageId: result.messageId,
    accepted: result.accepted,
    rejected: result.rejected,
  };
}