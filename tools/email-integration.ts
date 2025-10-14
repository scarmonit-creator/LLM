import nodemailer from 'nodemailer';
import { Tool } from './types.js';

/**
 * Email Integration Tool - Full email automation capability
 * Enables autonomous email sending, replying, and workflow integration
 */
export const emailIntegration: Tool = {
  name: 'email_integration',
  description: 'Send emails, reply to messages, and automate email workflows',
  parameters: {
    type: 'object',
    properties: {
      operation: {
        type: 'string',
        enum: ['send', 'reply', 'forward'],
        description: 'Email operation to perform',
      },
      to: {
        type: 'array',
        items: { type: 'string' },
        description: 'Recipient email addresses',
      },
      cc: {
        type: 'array',
        items: { type: 'string' },
        description: 'CC email addresses',
      },
      bcc: {
        type: 'array',
        items: { type: 'string' },
        description: 'BCC email addresses',
      },
      subject: {
        type: 'string',
        description: 'Email subject line',
      },
      body: {
        type: 'string',
        description: 'Email body content (supports HTML)',
      },
      attachments: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            path: { type: 'string' },
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
    required: ['operation', 'to', 'subject', 'body'],
  },
  async execute(args: any): Promise<any> {
    const {
      operation,
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

      // Build email options
      const mailOptions: any = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject,
        html: body,
        text: body.replace(/<[^>]*>/g, ''), // Strip HTML for text version
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
