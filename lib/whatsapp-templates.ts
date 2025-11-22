// lib/whatsapp-templates.ts - WhatsApp message templates for production

/**
 * WhatsApp Business requires approved message templates.
 * This file contains template configurations for production use.
 *
 * For sandbox testing, use the functions in whatsapp.ts
 * For production, use the functions here after templates are approved.
 */

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

let client: twilio.Twilio | null = null;

if (accountSid && authToken) {
  client = twilio(accountSid, authToken);
}

interface DutyReminder {
  name: string;
  role: 'Imam' | 'Bilal';
  date: string;
  prayerTime: string;
  phone: string;
}

/**
 * Format phone number for WhatsApp (Malaysia format)
 */
function formatPhoneNumber(phone: string): string {
  let whatsappNumber = phone.trim();

  // Add +60 for Malaysia if not present
  if (!whatsappNumber.startsWith('+')) {
    if (whatsappNumber.startsWith('0')) {
      whatsappNumber = '+60' + whatsappNumber.substring(1);
    } else if (!whatsappNumber.startsWith('60')) {
      whatsappNumber = '+60' + whatsappNumber;
    } else {
      whatsappNumber = '+' + whatsappNumber;
    }
  }

  return 'whatsapp:' + whatsappNumber;
}

/**
 * Send duty reminder using approved WhatsApp template (PRODUCTION)
 *
 * Template Name: prayer_duty_reminder
 * Template must be approved in Twilio Console before use
 */
export async function sendDutyReminderTemplate(reminder: DutyReminder): Promise<boolean> {
  if (!client) {
    console.error('Twilio client not initialized');
    return false;
  }

  const whatsappNumber = formatPhoneNumber(reminder.phone);

  // Format date nicely
  const date = new Date(reminder.date);
  const formattedDate = date.toLocaleDateString('en-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  try {
    // Using Content Template (newer method)
    const result = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: whatsappNumber,
      contentSid: process.env.TWILIO_PRAYER_REMINDER_TEMPLATE_SID, // Set this in .env after approval
      contentVariables: JSON.stringify({
        1: reminder.name,
        2: reminder.role,
        3: formattedDate,
        4: reminder.prayerTime
      })
    });

    console.log(`WhatsApp template reminder sent to ${reminder.name}: ${result.sid}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send WhatsApp template to ${reminder.name}:`, error.message);

    // Fallback to sandbox-style message if template fails
    console.log('Attempting fallback to standard message...');
    return sendDutyReminderFallback(reminder);
  }
}

/**
 * Fallback method - send as standard message (works in sandbox and within 24-hour window)
 */
async function sendDutyReminderFallback(reminder: DutyReminder): Promise<boolean> {
  if (!client) return false;

  const whatsappNumber = formatPhoneNumber(reminder.phone);

  const date = new Date(reminder.date);
  const formattedDate = date.toLocaleDateString('en-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const message = `🕌 *iSAR Prayer Duty Reminder*

السلام عليكم ورحمة الله وبركاته

Dear ${reminder.name},

This is a reminder that you have been assigned as *${reminder.role}* for:

📅 *Date:* ${formattedDate}
🕌 *Prayer:* ${reminder.prayerTime}

جزاك الله خيرا
May Allah reward you for your service.

_This is an automated reminder from iSAR System_`;

  try {
    const result = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: whatsappNumber,
      body: message
    });

    console.log(`Fallback WhatsApp sent to ${reminder.name}: ${result.sid}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send fallback WhatsApp:`, error.message);
    return false;
  }
}

/**
 * Send batch reminders using templates
 */
export async function sendBatchRemindersTemplate(reminders: DutyReminder[]): Promise<{
  sent: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const results = await Promise.allSettled(
    reminders.map(async (reminder) => ({
      name: reminder.name,
      success: await sendDutyReminderTemplate(reminder)
    }))
  );

  const processedResults = results.map((r, index) => {
    if (r.status === 'fulfilled') {
      return r.value;
    } else {
      return {
        name: reminders[index].name,
        success: false,
        error: r.reason?.message || 'Unknown error'
      };
    }
  });

  const sent = processedResults.filter(r => r.success).length;
  const failed = processedResults.length - sent;

  return { sent, failed, results: processedResults };
}

/**
 * Send test message using approved template (PRODUCTION)
 */
export async function sendTestMessageTemplate(phoneNumber: string, name: string): Promise<boolean> {
  if (!client) {
    console.error('Twilio client not initialized');
    return false;
  }

  const whatsappNumber = formatPhoneNumber(phoneNumber);

  try {
    // If template SID is configured, use it
    if (process.env.TWILIO_TEST_MESSAGE_TEMPLATE_SID) {
      const result = await client.messages.create({
        from: twilioWhatsAppNumber,
        to: whatsappNumber,
        contentSid: process.env.TWILIO_TEST_MESSAGE_TEMPLATE_SID,
        contentVariables: JSON.stringify({
          1: name
        })
      });

      console.log(`Test template message sent to ${name}: ${result.sid}`);
      return true;
    } else {
      // Fallback to standard message for sandbox/testing
      return sendTestMessageFallback(phoneNumber, name);
    }
  } catch (error: any) {
    console.error(`Failed to send test template:`, error.message);
    return sendTestMessageFallback(phoneNumber, name);
  }
}

/**
 * Fallback test message
 */
async function sendTestMessageFallback(phoneNumber: string, name: string): Promise<boolean> {
  if (!client) return false;

  const whatsappNumber = formatPhoneNumber(phoneNumber);

  const message = `🕌 *iSAR System Test*

السلام عليكم ${name},

This is a test message from the iSAR Prayer Schedule System.

If you receive this message, WhatsApp notifications are working correctly! ✅

جزاك الله خيرا`;

  try {
    const result = await client.messages.create({
      from: twilioWhatsAppNumber,
      to: whatsappNumber,
      body: message
    });

    console.log(`Test message sent to ${name}: ${result.sid}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send test message:`, error.message);
    return false;
  }
}

/**
 * Check if production templates are configured
 */
export function isProductionTemplateConfigured(): boolean {
  return !!(
    accountSid &&
    authToken &&
    process.env.TWILIO_PRAYER_REMINDER_TEMPLATE_SID
  );
}

/**
 * Get template configuration status
 */
export function getTemplateStatus(): {
  configured: boolean;
  accountConfigured: boolean;
  reminderTemplateConfigured: boolean;
  testTemplateConfigured: boolean;
} {
  return {
    configured: isProductionTemplateConfigured(),
    accountConfigured: !!(accountSid && authToken),
    reminderTemplateConfigured: !!process.env.TWILIO_PRAYER_REMINDER_TEMPLATE_SID,
    testTemplateConfigured: !!process.env.TWILIO_TEST_MESSAGE_TEMPLATE_SID
  };
}
