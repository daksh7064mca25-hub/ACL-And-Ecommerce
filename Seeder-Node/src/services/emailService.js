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

const escapeHtml = (str) => {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const formatCurrency = (amount, currency = 'inr') => {
  const curr = (currency || 'inr').toLowerCase();
  const num = Number(amount) || 0;
  if (curr === 'usd') {
    return `$${num.toFixed(2)}`;
  } else if (curr === 'inr') {
    return `₹${num.toFixed(2)}`;
  } else if (curr === 'eur') {
    return `€${num.toFixed(2)}`;
  } else if (curr === 'gbp') {
    return `£${num.toFixed(2)}`;
  }
  return `${curr.toUpperCase()} ${num.toFixed(2)}`;
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
        <h2 style="color: #2b6cb0;">Welcome to our Platform, ${escapeHtml(name)}!</h2>
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

/**
 * Sends a Payment Successful confirmation email to the customer.
 * 
 * @param {Object} order - Mongoose Order document or plain Order object
 * @returns {Promise<Object>}
 */
const sendPaymentSuccessEmail = async (order) => {
  if (!order || !order.customerEmail) {
    return { success: false, error: 'Order or customer email is missing' };
  }

  const customerName = order.customerName ? order.customerName.trim() : 'Customer';
  const orderId = order._id ? order._id.toString() : 'N/A';
  const formattedDate = order.updatedAt
    ? new Date(order.updatedAt).toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : new Date().toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

  const formattedTotal = formatCurrency(order.totalAmount, order.currency);
  const fromEmail = process.env.EMAIL_FROM || '"ExpertoStore" <no-reply@example.com>';
  const subject = `Payment Successful - Order #${orderId}`;

  // Build items rows for HTML
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px; font-weight: 500;">
          ${escapeHtml(item.title)}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; text-align: right;">
          ${formatCurrency(item.priceAtPurchase, order.currency)}
        </td>
        <td style="padding: 12px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">
          ${formatCurrency(item.priceAtPurchase * item.quantity, order.currency)}
        </td>
      </tr>`
    )
    .join('');

  // Build items text for plain-text fallback
  const itemsText = (order.items || [])
    .map(
      (item) =>
        `- ${item.title} × ${item.quantity} @ ${formatCurrency(item.priceAtPurchase, order.currency)} = ${formatCurrency(item.priceAtPurchase * item.quantity, order.currency)}`
    )
    .join('\n');

  // Plain-text Fallback
  const plainText = `Payment Successful\n\nHello ${customerName},\n\nThank you for your purchase! Your payment was successfully completed.\n\nOrder Details:\n- Order ID: #${orderId}\n- Payment Status: PAID\n- Payment Date: ${formattedDate}\n\nItems:\n${itemsText}\n\nTotal Paid: ${formattedTotal}\n\nYour order has been successfully confirmed.\n\nRegards,\nExpertoStore`;

  // HTML Template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Successful - Order #${escapeHtml(orderId)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center;">
                  <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 8px;">
                    EXPERTO<span style="color: #38bdf8;">STORE</span>
                  </div>
                  <div style="display: inline-block; background-color: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 9999px; padding: 6px 16px; margin-top: 10px;">
                    <span style="color: #34d399; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">✓ Payment Successful</span>
                  </div>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 30px;">
                  <p style="font-size: 16px; color: #0f172a; margin-top: 0; margin-bottom: 12px; font-weight: 600;">
                    Hello ${escapeHtml(customerName)},
                  </p>
                  <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                    Thank you for your purchase! Your payment was successfully completed, and your order has been confirmed.
                  </p>

                  <!-- Order Meta Box -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; padding: 16px;">
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #64748b;">Order ID:</td>
                      <td style="padding: 6px 12px; font-size: 13px; color: #0f172a; font-weight: 600; text-align: right;">#${escapeHtml(orderId)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #64748b;">Payment Status:</td>
                      <td style="padding: 6px 12px; font-size: 13px; text-align: right;">
                        <span style="background-color: #dcfce7; color: #15803d; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 12px;">PAID</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #64748b;">Payment Date:</td>
                      <td style="padding: 6px 12px; font-size: 13px; color: #0f172a; text-align: right;">${escapeHtml(formattedDate)}</td>
                    </tr>
                  </table>

                  <!-- Items Table -->
                  <div style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                    Order Details
                  </div>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 20px;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Item</th>
                        <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Qty</th>
                        <th style="padding: 10px 14px; text-align: right; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Price</th>
                        <th style="padding: 10px 14px; text-align: right; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>

                  <!-- Total Summary -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 16px; margin-bottom: 28px;">
                    <tr>
                      <td align="right" style="padding: 8px 14px; font-size: 16px; color: #0f172a; font-weight: 700;">
                        Total Paid: <span style="color: #059669; font-size: 18px; margin-left: 8px;">${escapeHtml(formattedTotal)}</span>
                      </td>
                    </tr>
                  </table>

                  <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin: 0;">
                    Your order has been successfully confirmed. If you have any questions or need assistance, feel free to reply directly to this email.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="font-size: 14px; color: #0f172a; font-weight: 600; margin: 0 0 4px 0;">Regards,</p>
                  <p style="font-size: 14px; color: #3b82f6; font-weight: 700; margin: 0 0 12px 0;">ExpertoStore</p>
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    This is an automated payment confirmation for your order #${escapeHtml(orderId)}.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  console.log(`[EmailService] Preparing Payment Success email for Order #${orderId} to: ${order.customerEmail}`);

  try {
    const transporter = createTransporter();

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const info = await transporter.sendMail({
        from: fromEmail,
        to: order.customerEmail,
        subject,
        text: plainText,
        html: htmlContent,
      });
      console.log(`[EmailService] Payment Success email dispatched: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } else {
      console.log('[EmailService] SMTP credentials not provided in .env. Payment Success email simulated.');
      return { success: true, simulated: true };
    }
  } catch (error) {
    console.error(`[EmailService] Error sending Payment Success email: ${error.message}`);
    return { success: false, error: error.message };
  }
};

/**
 * Sends a Payment Failed notification email to the customer.
 * 
 * @param {Object} order - Mongoose Order document or plain Order object
 * @param {string} [failureReason] - Safe, customer-friendly failure reason
 * @returns {Promise<Object>}
 */
const sendPaymentFailedEmail = async (order, failureReason) => {
  if (!order || !order.customerEmail) {
    return { success: false, error: 'Order or customer email is missing' };
  }

  const customerName = order.customerName ? order.customerName.trim() : 'Customer';
  const orderId = order._id ? order._id.toString() : 'N/A';
  const safeReason = failureReason && typeof failureReason === 'string'
    ? failureReason
    : 'The card was declined or the payment session expired.';

  const formattedTotal = formatCurrency(order.totalAmount, order.currency);
  const fromEmail = process.env.EMAIL_FROM || '"ExpertoStore" <no-reply@example.com>';
  const subject = `Payment Failed - Order #${orderId}`;

  // Build items rows for HTML
  const itemsHtml = (order.items || [])
    .map(
      (item) => `
      <tr>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #1e293b; font-size: 14px; font-weight: 500;">
          ${escapeHtml(item.title)}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #64748b; font-size: 14px; text-align: center;">
          ${item.quantity}
        </td>
        <td style="padding: 10px 14px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-size: 14px; font-weight: 600; text-align: right;">
          ${formatCurrency(item.priceAtPurchase * item.quantity, order.currency)}
        </td>
      </tr>`
    )
    .join('');

  // Plain-text items
  const itemsText = (order.items || [])
    .map((item) => `- ${item.title} × ${item.quantity}`)
    .join('\n');

  // Plain-text Fallback
  const plainText = `Payment Failed\n\nHello ${customerName},\n\nUnfortunately, your payment could not be completed.\n\nOrder Details:\n- Order ID: #${orderId}\n- Amount: ${formattedTotal}\n- Payment Status: FAILED\n- Reason: ${safeReason}\n\nItems:\n${itemsText}\n\nPlease return to the checkout page and try again.\n\nRegards,\nExpertoStore`;

  // HTML Template
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Payment Failed - Order #${escapeHtml(orderId)}</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #334155;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed; background-color: #f8fafc; padding: 30px 10px;">
        <tr>
          <td align="center">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 30px; text-align: center;">
                  <div style="font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff; margin-bottom: 8px;">
                    EXPERTO<span style="color: #38bdf8;">STORE</span>
                  </div>
                  <div style="display: inline-block; background-color: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 9999px; padding: 6px 16px; margin-top: 10px;">
                    <span style="color: #f87171; font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">✕ Payment Unsuccessful</span>
                  </div>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 30px;">
                  <p style="font-size: 16px; color: #0f172a; margin-top: 0; margin-bottom: 12px; font-weight: 600;">
                    Hello ${escapeHtml(customerName)},
                  </p>
                  <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
                    Unfortunately, your payment could not be completed for order <strong>#${escapeHtml(orderId)}</strong>.
                  </p>

                  <!-- Order Meta Box -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; margin-bottom: 24px; padding: 16px;">
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #991b1b;">Order ID:</td>
                      <td style="padding: 6px 12px; font-size: 13px; color: #7f1d1d; font-weight: 600; text-align: right;">#${escapeHtml(orderId)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #991b1b;">Amount:</td>
                      <td style="padding: 6px 12px; font-size: 13px; color: #7f1d1d; font-weight: 600; text-align: right;">${escapeHtml(formattedTotal)}</td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #991b1b;">Payment Status:</td>
                      <td style="padding: 6px 12px; font-size: 13px; text-align: right;">
                        <span style="background-color: #fee2e2; color: #b91c1c; font-weight: 700; padding: 2px 8px; border-radius: 4px; font-size: 12px;">FAILED</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 6px 12px; font-size: 13px; color: #991b1b;">Reason:</td>
                      <td style="padding: 6px 12px; font-size: 13px; color: #b91c1c; font-weight: 500; text-align: right;">${escapeHtml(safeReason)}</td>
                    </tr>
                  </table>

                  <!-- Items Table -->
                  <div style="font-size: 14px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px;">
                    Order Details
                  </div>
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; margin-bottom: 24px;">
                    <thead>
                      <tr style="background-color: #f1f5f9;">
                        <th style="padding: 10px 14px; text-align: left; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Item</th>
                        <th style="padding: 10px 14px; text-align: center; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Qty</th>
                        <th style="padding: 10px 14px; text-align: right; font-size: 12px; color: #475569; font-weight: 600; text-transform: uppercase; border-bottom: 2px solid #e2e8f0;">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemsHtml}
                    </tbody>
                  </table>

                  <!-- Retry Note -->
                  <div style="background-color: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin-bottom: 24px; text-align: center;">
                    <p style="font-size: 14px; color: #0369a1; font-weight: 600; margin: 0 0 6px 0;">
                      Ready to complete your order?
                    </p>
                    <p style="font-size: 13px; color: #0c4a6e; margin: 0;">
                      Please return to the checkout page and try again with your card or another payment method.
                    </p>
                  </div>

                  <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0;">
                    Note: No funds were captured for this failed transaction. If you continue to experience issues, please contact your bank or support team.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 24px 30px; border-top: 1px solid #e2e8f0; text-align: center;">
                  <p style="font-size: 14px; color: #0f172a; font-weight: 600; margin: 0 0 4px 0;">Regards,</p>
                  <p style="font-size: 14px; color: #3b82f6; font-weight: 700; margin: 0 0 12px 0;">ExpertoStore</p>
                  <p style="font-size: 12px; color: #94a3b8; margin: 0;">
                    This is an automated notification regarding your payment attempt for order #${escapeHtml(orderId)}.
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  console.log(`[EmailService] Preparing Payment Failed email for Order #${orderId} to: ${order.customerEmail}`);

  try {
    const transporter = createTransporter();

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const info = await transporter.sendMail({
        from: fromEmail,
        to: order.customerEmail,
        subject,
        text: plainText,
        html: htmlContent,
      });
      console.log(`[EmailService] Payment Failed email dispatched: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } else {
      console.log('[EmailService] SMTP credentials not provided in .env. Payment Failed email simulated.');
      return { success: true, simulated: true };
    }
  } catch (error) {
    console.error(`[EmailService] Error sending Payment Failed email: ${error.message}`);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendVerificationEmail,
  sendPromotionEmail,
  sendPaymentSuccessEmail,
  sendPaymentFailedEmail,
};
