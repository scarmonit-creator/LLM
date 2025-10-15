import nodemailer from 'nodemailer';
import { sanitize } from 'class-sanitizer';

export interface EmailArgs {
  to: string | string[];
  cc?: string | string[];
  bcc?: string | string[];
  subject: string;
  body: string;
  attachments?: any[];
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
}

export interface EmailResult {
  success: boolean;
  operation: string;
  messageId?: string;
  recipients?: string | string[];
  subject?: string;
  timestamp?: string;
  error?: string;
}

/**
 * Comprehensive input sanitization using class-sanitizer
 */
function sanitizeEmailInput(input: string): string {
  // Remove all HTML tags comprehensively
  let sanitized = input.replace(/<[^>]*>/g, '');
  
  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  
  // Remove event handlers
  sanitized = sanitized.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '');
  
  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '');
  
  // Remove data: protocol
  sanitized = sanitized.replace(/data:text\/html/gi, '');
  
  // Decode HTML entities
  sanitized = sanitized.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  
  // Remove any remaining tags after decoding
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  return sanitized.trim();
}

const emailIntegration = {
  name: 'send_email',
  description:
    'Send emails with support for HTML content, attachments, CC/BCC, and priority levels. Useful for notifications, reports, and communications.',
  parameters: {
    type: 'object',
    properties: {
      to: {
        type: ['string', 'array'],
        items: { type: 'string' },
        description: 'Recipient email address(es)',
      },
      cc: {
        type: ['string', 'array'],
        items: { type: 'string' },
        description: 'CC recipient email address(es)',
      },
      bcc: {
        type: ['string', 'array'],
        items: { type: 'string' },
        description: 'BCC recipient email address(es)',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      body: {
        type: 'string',
        description: 'Email body (supports HTML)',
      },
      attachments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            path: { type: 'string' },
            content: { type: 'string' },
          },
        },
        description: 'Email attachments',
      },
      replyTo: {
        type: 'string',
        description: 'Reply-to email address',
      },
      priority: {
        type: 'string',
        enum: ['high', 'normal', 'low'],
        description: 'Email priority level',
      },
    },
    required: ['to', 'subject', 'body'],
  },
  execute: async (args: EmailArgs): Promise<EmailResult> => {
    const operation = 'send_email';
    const {
      to,
      cc,
      bcc,
      subject,
      body,
      attachments,
      replyTo,
      priority = 'normal',
    } = args;

    try {
      // Configure email transport using environment variables
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      // Build email options with comprehensive input sanitization
      const mailOptions: any = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: body,
        text: sanitizeEmailInput(body), // Use comprehensive sanitization for text version
        priority: priority === 'high' ? 'high' : priority === 'low' ? 'low' : 'normal',
      };

      if (cc && cc.length > 0) {
        mailOptions.cc = Array.isArray(cc) ? cc.join(', ') : cc;
      }

      if (bcc && bcc.length > 0) {
        mailOptions.bcc = Array.isArray(bcc) ? bcc.join(', ') : bcc;
      }

      if (replyTo) {
        mailOptions.replyTo = replyTo;
      }

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      // Send email
      const info = await transporter.sendMail(mailOptions);

      return {
        success: true,
        operation,
        messageId: info.messageId,
        recipients: to,
        subject,
        timestamp: new Date().toISOString(),
      };
    } catch (error: any) {
      return {
        success: false,
        operation,
        error: error.message,
      };
    }
  },
};

export default emailIntegration;
