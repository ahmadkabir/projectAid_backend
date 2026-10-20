import nodemailer from 'nodemailer';

const getProvider = () => (process.env.EMAIL_PROVIDER || 'console').toLowerCase();

const buildTransport = () => {
  const host = process.env.EMAIL_SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.EMAIL_SMTP_PORT || '587', 10);
  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Never throws: returns { delivered, provider, fallback?, error? }
const deliver = async ({ to, subject, html, text }) => {
  const provider = getProvider();

  if (provider === 'smtp') {
    try {
      const transport = buildTransport();
      await transport.sendMail({
        from: process.env.EMAIL_FROM || process.env.EMAIL_USER,
        to,
        subject,
        html,
        text
      });
      return { delivered: true, provider: 'smtp' };
    } catch (error) {
      console.error(`[EMAIL] SMTP delivery failed: ${error.message}`);
      if (process.env.NODE_ENV !== 'production') {
        // Development fallback: log the email so the flow stays usable
        console.log(`\n[EMAIL:fallback-console] To: ${to}\nSubject: ${subject}\n${text}\n`);
        return { delivered: false, provider: 'smtp', fallback: true, error: error.message };
      }
      return { delivered: false, provider: 'smtp', error: error.message };
    }
  }

  // Default: console provider — prints the email (and link) to the backend log
  console.log(`\n[EMAIL:console] To: ${to}\nSubject: ${subject}\n${text}\n`);
  return { delivered: false, provider: 'console' };
};

export const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  const subject = 'Verify your ProjectAid email address';
  const text = [
    `Hi ${name},`,
    '',
    'Welcome to ProjectAid! Please confirm your email address to activate your account.',
    '',
    `Verify your email: ${verificationUrl}`,
    '',
    'This link expires in 24 hours. If you did not create an account, you can ignore this email.',
    '',
    '— ProjectAid Team'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
      <h2 style="color: #1e3a8a; margin-top: 0;">Confirm your email</h2>
      <p>Hi ${name},</p>
      <p>Welcome to <strong>ProjectAid</strong>! Please confirm your email address to activate your account.</p>
      <p style="text-align: center; margin: 28px 0;">
        <a href="${verificationUrl}" style="background-color: #16a34a; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">Verify my email</a>
      </p>
      <p style="color: #6b7280; font-size: 13px;">Or copy this link: <br/><a href="${verificationUrl}">${verificationUrl}</a></p>
      <p style="color: #6b7280; font-size: 13px;">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>
    </div>`;

  return deliver({ to, subject, html, text });
};
