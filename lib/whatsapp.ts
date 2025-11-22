// lib/whatsapp.ts - WhatsApp notification utilities using Twilio

import twilio from 'twilio';

// Initialize Twilio client
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

let client: twilio.Twilio | null = null;

// Only initialize if credentials are present
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
 * Send WhatsApp reminder to Imam or Bilal about their duty
 */
export async function sendDutyReminder(reminder: DutyReminder): Promise<boolean> {
  if (!client) {
    console.error('Twilio client not initialized. Check TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN');
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

  // Create personalized message
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

    console.log(`WhatsApp reminder sent to ${reminder.name} (${reminder.phone}): ${result.sid}`);
    return true;
  } catch (error: any) {
    console.error(`Failed to send WhatsApp to ${reminder.name} (${reminder.phone}):`, error.message);
    return false;
  }
}

/**
 * Send batch reminders to multiple people
 */
export async function sendBatchReminders(reminders: DutyReminder[]): Promise<{
  sent: number;
  failed: number;
  results: Array<{ name: string; success: boolean; error?: string }>;
}> {
  const results = await Promise.allSettled(
    reminders.map(async (reminder) => ({
      name: reminder.name,
      success: await sendDutyReminder(reminder)
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
 * Test WhatsApp connection by sending a test message
 */
export async function sendTestMessage(phoneNumber: string, name: string): Promise<boolean> {
  if (!client) {
    console.error('Twilio client not initialized');
    return false;
  }

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
 * Check if WhatsApp is configured
 */
export function isWhatsAppConfigured(): boolean {
  return !!(accountSid && authToken);
}
