/**
 * n8n Order Notification Service
 * Reusable backend service for dispatching verified order event webhooks to n8n.
 * 
 * Configured via environment variables:
 * - N8N_ORDER_WEBHOOK_URL: Target webhook URL in n8n
 * - N8N_ORDER_WEBHOOK_SECRET: Secret for Header Auth (x-experto-webhook-secret)
 */

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Formats a minimal JSON payload containing verified order details.
 * Uses only existing Order model fields.
 *
 * @param {string} eventName - Verified event name (e.g., 'checkout.session.completed')
 * @param {Object} order - Order document or object
 * @returns {Object} Minimal payload for n8n workflow
 */
const formatOrderPayload = (eventName, order) => {
  if (!order) return null;

  const orderId = order._id ? order._id.toString() : (order.orderId || '');
  const customerName = order.customerName ? order.customerName.trim() : '';
  const customerEmail = order.customerEmail ? order.customerEmail.toLowerCase().trim() : '';
  const totalAmount =
    typeof order.totalAmount === 'number'
      ? order.totalAmount
      : Number(order.totalAmount || 0);
  const currency = order.currency ? order.currency.toLowerCase().trim() : 'inr';
  const orderStatus = order.orderStatus || 'confirmed';
  const paymentStatus = order.paymentStatus || 'paid';
  const createdAt = order.createdAt || new Date();

  return {
    event: eventName,
    orderId,
    customerName,
    customerEmail,
    totalAmount,
    currency,
    orderStatus,
    paymentStatus,
    createdAt,
  };
};

/**
 * Dispatches an order event notification to the configured n8n webhook.
 * - Secure: Injects Header Auth `x-experto-webhook-secret`
 * - Non-blocking: Network failure or timeout does not throw or halt order processing
 * - Safe: Does not log the secret value or sensitive tokens
 * - Timeout handling: Aborts request after specified timeout (default 5000ms)
 *
 * @param {string} eventName - Verified order event (e.g., 'checkout.session.completed')
 * @param {Object} order - Order document
 * @param {Object} [options] - Optional overrides for testing or timeout tuning
 * @param {string} [options.webhookUrl] - Override URL
 * @param {string} [options.webhookSecret] - Override Secret
 * @param {number} [options.timeoutMs] - Request timeout in ms (default: 5000)
 * @returns {Promise<{ success: boolean, skipped?: boolean, status?: number, error?: string }>}
 */
const sendOrderNotification = async (eventName, order, options = {}) => {
  try {
    const webhookUrl = options.webhookUrl || process.env.N8N_ORDER_WEBHOOK_URL;
    const webhookSecret = options.webhookSecret || process.env.N8N_ORDER_WEBHOOK_SECRET;
    const timeoutMs = Number(options.timeoutMs) || DEFAULT_TIMEOUT_MS;

    if (!webhookUrl || typeof webhookUrl !== 'string' || webhookUrl.trim() === '') {
      console.log('[n8n Service] N8N_ORDER_WEBHOOK_URL is not configured. Webhook dispatch skipped.');
      return { success: false, skipped: true, reason: 'N8N_ORDER_WEBHOOK_URL not configured' };
    }

    if (!order) {
      console.warn('[n8n Service Warning] No order provided. Webhook dispatch aborted.');
      return { success: false, error: 'Order is required' };
    }

    const payload = formatOrderPayload(eventName, order);
    const orderId = payload.orderId || 'unknown';

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'ExpertoStore-Backend/1.0',
    };

    // Header Auth: x-experto-webhook-secret
    if (webhookSecret && typeof webhookSecret === 'string' && webhookSecret.trim() !== '') {
      headers['x-experto-webhook-secret'] = webhookSecret.trim();
    }

    // Safe endpoint display for logging (origin + pathname only, omitting any query secrets)
    let safeEndpoint = 'configured endpoint';
    try {
      const parsedUrl = new URL(webhookUrl.trim());
      safeEndpoint = `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch {
      safeEndpoint = 'configured n8n webhook';
    }

    console.log(`[n8n Service] Dispatching '${eventName}' for Order ${orderId} to ${safeEndpoint}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(webhookUrl.trim(), {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        console.log(`[n8n Service] Webhook delivered successfully for Order ${orderId} (HTTP ${response.status})`);
        return { success: true, status: response.status };
      } else {
        const errorText = await response.text().catch(() => '');
        console.warn(`[n8n Service Warning] Webhook response not OK for Order ${orderId}: HTTP ${response.status} ${response.statusText}`);
        return {
          success: false,
          status: response.status,
          error: `HTTP ${response.status}: ${response.statusText || errorText || 'Failed'}`,
        };
      }
    } catch (requestError) {
      clearTimeout(timeoutId);

      if (requestError.name === 'AbortError') {
        console.warn(`[n8n Service Warning] Webhook request timed out after ${timeoutMs}ms for Order ${orderId}`);
        return { success: false, error: `Request timed out after ${timeoutMs}ms` };
      }

      console.warn(`[n8n Service Warning] Webhook network error for Order ${orderId}: ${requestError.message}`);
      return { success: false, error: requestError.message };
    }
  } catch (error) {
    console.error('[n8n Service Error] Unexpected error in sendOrderNotification:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendOrderNotification,
  formatOrderPayload,
};
