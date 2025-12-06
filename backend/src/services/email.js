import config from '../config/index.js';
import logger from '../utils/logger.js';

// Lazy import Resend to avoid react-email dependency issues at startup
// Only import if email is actually configured
let resendClient = null;
let resendAvailable = false;

// Check if resend is configured and available
const isResendAvailable = () => {
  return config.email.provider === 'resend' && config.email.resendApiKey;
};

// Only import Resend when actually needed (avoids loading react-email/react-dom)
const getResendClient = async () => {
  if (!isResendAvailable()) {
    return null;
  }
  
  if (!resendClient && !resendAvailable) {
    try {
      // Dynamic import to avoid loading react-email if not needed
      const resendModule = await import('resend');
      const Resend = resendModule.Resend;
      resendClient = new Resend(config.email.resendApiKey);
      resendAvailable = true;
      logger.info('Resend client initialized');
    } catch (error) {
      logger.error('Failed to load Resend', { error: error.message });
      resendAvailable = false;
      return null;
    }
  }
  return resendClient;
};

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
  // If no email provider configured, just log in dev mode
  if (!isResendAvailable()) {
    if (config.env === 'development') {
      logger.info('Email would be sent (no provider configured)', { to, subject });
      logger.info('Email content:', { text });
      return { success: true, messageId: 'dev-mode' };
    }
    logger.warn('Email not sent - no provider configured', { to, subject });
    return { success: false, message: 'No email provider configured' };
  }

  // Try to use Resend
  try {
    const client = await getResendClient();
    if (!client) {
      logger.warn('Resend client not available, logging email instead', { to, subject });
      if (config.env === 'development') {
        logger.info('Email content:', { text });
      }
      return { success: false, message: 'Email provider not available' };
    }
    
    const result = await client.emails.send({
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
    // Don't throw - just return failure
    return { success: false, message: error.message };
  }
};

export default { sendOTPEmail, sendEmail };



