import { Resend } from 'resend';
import config from '../config/index.js';
import logger from '../utils/logger.js';

let resendClient = null;

// Initialize email client based on provider
if (config.email.provider === 'resend' && config.email.resendApiKey) {
  resendClient = new Resend(config.email.resendApiKey);
}

/**
 * Send OTP email
 */
export const sendOTPEmail = async (email, otp) => {
  const subject = 'Your CKAD Practice Platform Login Code';
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
        .code { 
          font-size: 32px; 
          font-weight: bold; 
          letter-spacing: 8px; 
          color: #2563eb;
          background: #f1f5f9;
          padding: 20px 40px;
          border-radius: 8px;
          text-align: center;
          margin: 30px 0;
        }
        .footer { color: #64748b; font-size: 14px; margin-top: 40px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🎯 CKAD Practice Platform</h1>
        <p>Hello,</p>
        <p>Use the following code to log in to your account:</p>
        <div class="code">${otp}</div>
        <p>This code will expire in <strong>10 minutes</strong>.</p>
        <p>If you didn't request this code, you can safely ignore this email.</p>
        <div class="footer">
          <p>— The CKAD Practice Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
CKAD Practice Platform - Login Code

Your login code is: ${otp}

This code will expire in 10 minutes.

If you didn't request this code, you can safely ignore this email.
  `;

  return sendEmail(email, subject, html, text);
};

/**
 * Generic send email function
 */
export const sendEmail = async (to, subject, html, text) => {
  if (config.env === 'development' && !resendClient) {
    // In development without email configured, just log
    logger.info('Email would be sent (dev mode)', { to, subject });
    logger.info('Email content:', { text });
    return { success: true, messageId: 'dev-mode' };
  }

  if (config.email.provider === 'resend' && resendClient) {
    try {
      const result = await resendClient.emails.send({
        from: config.email.from,
        to,
        subject,
        html,
        text,
      });

      logger.info('Email sent via Resend', { to, messageId: result.id });
      return { success: true, messageId: result.id };
    } catch (error) {
      logger.error('Failed to send email via Resend', { 
        error: error.message, 
        to 
      });
      throw new Error('Failed to send email');
    }
  }

  // Fallback: log email in development
  if (config.env === 'development') {
    logger.info('Email (no provider configured)', { to, subject, text });
    return { success: true, messageId: 'no-provider' };
  }

  throw new Error('No email provider configured');
};

export default { sendOTPEmail, sendEmail };

