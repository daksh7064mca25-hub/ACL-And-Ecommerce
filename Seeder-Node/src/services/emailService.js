const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT || 587;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    return nodemailer.createTransport({
      host,
      port: Number(port),
      secure: Number(port) === 465,
      auth: {
        user,
        pass,
      },
    });
  }

  return nodemailer.createTransport({
    host: host || 'smtp.ethereal.email',
    port: Number(port),
    auth: {
      user: user || '',
      pass: pass || '',
    },
  });
};

/**
 * Sends an email verification link to the newly registered customer.
 * 
 * @param {Object} options
 * @param {string} options.to - Recipient email address
 * @param {string} options.name - Recipient user name
 * @param {string} options.verificationToken - The unique verification token
 * @returns {Promise<Object>}
 */
const sendVerificationEmail = async ({ to, name, verificationToken }) => {
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 5000}`;
  const verificationUrl = `${baseUrl}/api/auth/verify-email?token=${verificationToken}`;

  const fromEmail = process.env.EMAIL_FROM || '"Customer Support" <no-reply@example.com>';

  const mailOptions = {
    from: fromEmail,
    to,
    subject: 'Please verify your email address',
    text: `Hello ${name},\n\nThank you for signing up! Please verify your email by clicking the link below:\n\n${verificationUrl}\n\nThis verification link will expire in 24 hours.\n\nIf you did not create this account, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <h2 style="color: #2b6cb0;">Welcome to our Platform, ${name}!</h2>
        <p>Thank you for signing up as a Customer. To activate your account, please verify your email address by clicking the button below:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${verificationUrl}" style="background-color: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
            Verify Email Address
          </a>
        </div>
        <p>Or copy and paste this URL into your browser:</p>
        <p style="word-break: break-all; color: #4a5568;"><a href="${verificationUrl}">${verificationUrl}</a></p>
        <p style="font-size: 13px; color: #718096; margin-top: 30px;">
          Note: This verification link will expire in 24 hours.<br>
          If you did not create an account, you can safely ignore this email.
        </p>
      </div>
    `,
  };

  // Always log the verification URL to console for easy testing & demo in development
  console.log(`[EmailService] Verification URL for ${to}:`);
  console.log(` -> ${verificationUrl}\n`);

  try {
    const transporter = createTransporter();
    
    // Only attempt actual transmission if SMTP credentials or test host is set
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] Verification email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, verificationUrl };
    } else {
      console.log('[EmailService] SMTP credentials not provided in .env. Email link printed to console for local testing.');
      return { success: true, simulated: true, verificationUrl };
    }
  } catch (error) {
    console.error(`[EmailService] Error sending email: ${error.message}`);
    // Log verification link so testing isn't blocked by external SMTP failure
    return { success: false, error: error.message, verificationUrl };
  }
};

/**
 * Sends a promotional HTML email to a list of customer recipients.
 * 
 * @param {Object} options
 * @param {string[]} options.recipients - List of customer email addresses
 * @param {string} options.html - HTML email content
 * @param {string} [options.subject] - Optional email subject line
 * @returns {Promise<Object>}
 */
const sendPromotionEmail = async ({ recipients, html, subject = 'Special Promotional Offer' }) => {
  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return { success: false, error: 'No recipients specified' };
  }

  const fromEmail = process.env.EMAIL_FROM || '"Admin Promotions" <no-reply@example.com>';

  const mailOptions = {
    from: fromEmail,
    to: recipients,
    subject: subject || 'Special Promotional Offer',
    html: html,
  };

  console.log(`[EmailService] Preparing promotional email to ${recipients.length} customer(s): ${recipients.join(', ')}`);

  try {
    const transporter = createTransporter();

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const info = await transporter.sendMail(mailOptions);
      console.log(`[EmailService] Promotion email sent: ${info.messageId}`);
      return { success: true, messageId: info.messageId, recipientCount: recipients.length };
    } else {
      console.log('[EmailService] SMTP credentials not provided in .env. Promotional email simulated for testing.');
      return { success: true, simulated: true, recipientCount: recipients.length };
    }
  } catch (error) {
    console.error(`[EmailService] Error sending promotional email: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPromotionEmail,
};

