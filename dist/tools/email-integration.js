// Email Integration Tool
import nodemailer from 'nodemailer';

export class EmailIntegrator {
  constructor(config = {}) {
    this.name = 'email_integrator';
    this.description = 'Sends emails and manages email communications';
    this.transporter = null;
    this.config = config;
  }

  async initialize() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: this.config.host || 'smtp.gmail.com',
        port: this.config.port || 587,
        secure: false,
        auth: {
          user: this.config.user,
          pass: this.config.password
        }
      });
      return true;
    } catch (error) {
      console.error('Failed to initialize email transporter:', error);
      return false;
    }
  }

  async sendEmail(to, subject, text, html) {
    if (!this.transporter) {
      throw new Error('Email transporter not initialized');
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from || this.config.user,
        to: to,
        subject: subject,
        text: text,
        html: html
      });
      return { success: true, messageId: info.messageId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

export default EmailIntegrator;