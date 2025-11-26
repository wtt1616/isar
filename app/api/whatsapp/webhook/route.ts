// app/api/whatsapp/webhook/route.ts
// Twilio WhatsApp Webhook - Receive incoming messages and process unavailability requests

import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { RowDataPacket } from 'mysql2';
import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioWhatsAppNumber = process.env.TWILIO_WHATSAPP_NUMBER || 'whatsapp:+14155238886';

let twilioClient: twilio.Twilio | null = null;
if (accountSid && authToken) {
  twilioClient = twilio(accountSid, authToken);
}

// Prayer times mapping
const PRAYER_TIMES = ['Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak'];
const PRAYER_ALIASES: { [key: string]: string } = {
  'subuh': 'Subuh',
  'zohor': 'Zohor',
  'zuhur': 'Zohor',
  'asar': 'Asar',
  'maghrib': 'Maghrib',
  'isyak': 'Isyak',
  'isya': 'Isyak',
};

// Format phone number to match database format (remove whatsapp: prefix and normalize)
function normalizePhoneNumber(phone: string): string[] {
  // Remove whatsapp: prefix
  let number = phone.replace('whatsapp:', '').trim();

  // Generate possible formats to match in database
  const formats: string[] = [];

  // Original format
  formats.push(number);

  // If starts with +60, also check 0 format
  if (number.startsWith('+60')) {
    formats.push('0' + number.substring(3));
    formats.push(number.substring(1)); // without +
  }

  // If starts with 60, also check 0 format
  if (number.startsWith('60') && !number.startsWith('+')) {
    formats.push('0' + number.substring(2));
    formats.push('+' + number);
  }

  // If starts with 0, also check +60 format
  if (number.startsWith('0')) {
    formats.push('+60' + number.substring(1));
    formats.push('60' + number.substring(1));
  }

  return formats;
}

// Parse date from various formats
function parseDate(dateStr: string): Date | null {
  // Try YYYY-MM-DD format
  let match = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    return new Date(parseInt(match[1]), parseInt(match[2]) - 1, parseInt(match[3]));
  }

  // Try DD/MM/YYYY format
  match = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  // Try DD-MM-YYYY format
  match = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (match) {
    return new Date(parseInt(match[3]), parseInt(match[2]) - 1, parseInt(match[1]));
  }

  return null;
}

// Format date for display
function formatDateMalay(date: Date): string {
  const days = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
  const months = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];

  return `${days[date.getDay()]}, ${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Send WhatsApp reply
async function sendReply(to: string, message: string): Promise<boolean> {
  if (!twilioClient) {
    console.error('Twilio client not initialized');
    return false;
  }

  try {
    await twilioClient.messages.create({
      from: twilioWhatsAppNumber,
      to: to,
      body: message
    });
    return true;
  } catch (error: any) {
    console.error('Error sending WhatsApp reply:', error.message);
    return false;
  }
}

// POST - Receive incoming WhatsApp messages from Twilio
export async function POST(request: NextRequest) {
  try {
    // Parse form data from Twilio
    const formData = await request.formData();
    const from = formData.get('From') as string; // whatsapp:+60123456789
    const body = (formData.get('Body') as string || '').trim();
    const messageSid = formData.get('MessageSid') as string;

    console.log(`[WhatsApp Webhook] Received message from ${from}: "${body}" (SID: ${messageSid})`);

    if (!from || !body) {
      return new NextResponse('OK', { status: 200 });
    }

    // Find user by phone number
    const phoneFormats = normalizePhoneNumber(from);
    const placeholders = phoneFormats.map(() => '?').join(' OR phone = ');

    const [users] = await pool.query<RowDataPacket[]>(
      `SELECT id, name, role, phone FROM users WHERE phone = ${placeholders} AND is_active = 1`,
      phoneFormats
    );

    if (users.length === 0) {
      console.log(`[WhatsApp Webhook] User not found for phone: ${from}`);
      await sendReply(from, `❌ Maaf, nombor telefon anda tidak berdaftar dalam sistem iSAR.

Sila hubungi Head Imam untuk mendaftarkan nombor telefon anda.`);
      return new NextResponse('OK', { status: 200 });
    }

    const user = users[0];
    console.log(`[WhatsApp Webhook] User identified: ${user.name} (ID: ${user.id}, Role: ${user.role})`);

    // Check if user is imam or bilal
    if (!['imam', 'bilal'].includes(user.role)) {
      await sendReply(from, `❌ Maaf, fungsi ini hanya untuk Imam dan Bilal sahaja.`);
      return new NextResponse('OK', { status: 200 });
    }

    // Parse message
    const upperBody = body.toUpperCase();

    // Check for CUTI/TIDAK HADIR command
    if (upperBody.startsWith('CUTI') || upperBody.startsWith('TIDAK HADIR') || upperBody.startsWith('TIDAKHADIR')) {
      // Extract date and prayer time
      // Format: CUTI 2024-12-01 Subuh
      // Format: CUTI 2024-12-01 semua
      // Format: CUTI 01/12/2024 Maghrib

      const parts = body.split(/\s+/).filter(p => p.length > 0);

      if (parts.length < 2) {
        await sendReply(from, `❌ Format tidak betul.

📝 *Format yang betul:*
CUTI [tarikh] [waktu solat]

📅 *Contoh:*
• CUTI 2024-12-01 Subuh
• CUTI 01/12/2024 Maghrib
• CUTI 2024-12-01 semua

💡 *Waktu solat:* Subuh, Zohor, Asar, Maghrib, Isyak
💡 *Guna "semua"* untuk semua waktu solat`);
        return new NextResponse('OK', { status: 200 });
      }

      // Find date in the message
      let dateStr = '';
      let prayerStr = '';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        // Check if it looks like a date
        if (part.match(/^\d{4}-\d{1,2}-\d{1,2}$/) || part.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
          dateStr = part;
        } else if (part.toLowerCase() !== 'cuti' && part.toLowerCase() !== 'tidak' && part.toLowerCase() !== 'hadir') {
          prayerStr = part;
        }
      }

      if (!dateStr) {
        await sendReply(from, `❌ Tarikh tidak dijumpai dalam mesej.

📝 *Format yang betul:*
CUTI [tarikh] [waktu solat]

📅 *Format tarikh:*
• 2024-12-01
• 01/12/2024
• 01-12-2024`);
        return new NextResponse('OK', { status: 200 });
      }

      const date = parseDate(dateStr);
      if (!date || isNaN(date.getTime())) {
        await sendReply(from, `❌ Format tarikh tidak sah: ${dateStr}

📅 *Format tarikh yang diterima:*
• 2024-12-01
• 01/12/2024
• 01-12-2024`);
        return new NextResponse('OK', { status: 200 });
      }

      // Determine prayer times to mark as unavailable
      let prayerTimes: string[] = [];

      if (!prayerStr || prayerStr.toLowerCase() === 'semua' || prayerStr.toLowerCase() === 'all') {
        prayerTimes = [...PRAYER_TIMES];
      } else {
        const normalizedPrayer = PRAYER_ALIASES[prayerStr.toLowerCase()];
        if (normalizedPrayer) {
          prayerTimes = [normalizedPrayer];
        } else if (PRAYER_TIMES.includes(prayerStr)) {
          prayerTimes = [prayerStr];
        } else {
          await sendReply(from, `❌ Waktu solat tidak sah: ${prayerStr}

💡 *Waktu solat yang diterima:*
Subuh, Zohor, Asar, Maghrib, Isyak

💡 *Atau guna "semua"* untuk semua waktu solat`);
          return new NextResponse('OK', { status: 200 });
        }
      }

      // Format date for database (YYYY-MM-DD)
      const dbDate = date.toISOString().split('T')[0];

      // Insert unavailability records
      const insertedTimes: string[] = [];
      const alreadyExistsTimes: string[] = [];

      for (const prayerTime of prayerTimes) {
        try {
          // Check if already exists
          const [existing] = await pool.query<RowDataPacket[]>(
            'SELECT id FROM availability WHERE user_id = ? AND date = ? AND prayer_time = ?',
            [user.id, dbDate, prayerTime]
          );

          if (existing.length > 0) {
            // Update existing record
            await pool.execute(
              'UPDATE availability SET is_available = 0, reason = ? WHERE user_id = ? AND date = ? AND prayer_time = ?',
              ['Melalui WhatsApp', user.id, dbDate, prayerTime]
            );
            insertedTimes.push(prayerTime);
          } else {
            // Insert new record
            await pool.execute(
              'INSERT INTO availability (user_id, date, prayer_time, is_available, reason) VALUES (?, ?, ?, 0, ?)',
              [user.id, dbDate, prayerTime, 'Melalui WhatsApp']
            );
            insertedTimes.push(prayerTime);
          }
        } catch (error: any) {
          console.error(`Error inserting unavailability for ${prayerTime}:`, error.message);
        }
      }

      // Send confirmation
      if (insertedTimes.length > 0) {
        const confirmMessage = `✅ *Cuti Berjaya Direkodkan*

👤 *Nama:* ${user.name}
📅 *Tarikh:* ${formatDateMalay(date)}
🕌 *Waktu:* ${insertedTimes.join(', ')}

Head Imam telah dimaklumkan.

_Terima kasih kerana memberitahu lebih awal._`;

        await sendReply(from, confirmMessage);
        console.log(`[WhatsApp Webhook] Unavailability recorded for ${user.name}: ${dbDate} - ${insertedTimes.join(', ')}`);
      } else {
        await sendReply(from, `❌ Gagal merekodkan cuti. Sila cuba lagi atau hubungi Head Imam.`);
      }

      return new NextResponse('OK', { status: 200 });
    }

    // Check for SENARAI/LIST command - show upcoming unavailability
    if (upperBody.startsWith('SENARAI') || upperBody.startsWith('LIST') || upperBody === 'STATUS') {
      const today = new Date().toISOString().split('T')[0];

      const [records] = await pool.query<RowDataPacket[]>(
        `SELECT date, prayer_time FROM availability
         WHERE user_id = ? AND date >= ? AND is_available = 0
         ORDER BY date ASC, FIELD(prayer_time, 'Subuh', 'Zohor', 'Asar', 'Maghrib', 'Isyak')
         LIMIT 20`,
        [user.id, today]
      );

      if (records.length === 0) {
        await sendReply(from, `📋 *Senarai Cuti Anda*

Tiada rekod cuti yang akan datang.

💡 Untuk rekod cuti baru, hantar:
CUTI [tarikh] [waktu solat]`);
      } else {
        let listMessage = `📋 *Senarai Cuti Anda*\n\n`;

        let currentDate = '';
        for (const record of records) {
          const recordDate = new Date(record.date);
          const dateStr = formatDateMalay(recordDate);

          if (dateStr !== currentDate) {
            if (currentDate) listMessage += '\n';
            listMessage += `📅 *${dateStr}*\n`;
            currentDate = dateStr;
          }
          listMessage += `   • ${record.prayer_time}\n`;
        }

        listMessage += `\n💡 Untuk rekod cuti baru, hantar:
CUTI [tarikh] [waktu solat]`;

        await sendReply(from, listMessage);
      }

      return new NextResponse('OK', { status: 200 });
    }

    // Check for BATAL/CANCEL command
    if (upperBody.startsWith('BATAL') || upperBody.startsWith('CANCEL')) {
      const parts = body.split(/\s+/).filter(p => p.length > 0);

      if (parts.length < 2) {
        await sendReply(from, `❌ Format tidak betul.

📝 *Format yang betul:*
BATAL [tarikh] [waktu solat]

📅 *Contoh:*
• BATAL 2024-12-01 Subuh
• BATAL 2024-12-01 semua`);
        return new NextResponse('OK', { status: 200 });
      }

      // Find date in the message
      let dateStr = '';
      let prayerStr = '';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (part.match(/^\d{4}-\d{1,2}-\d{1,2}$/) || part.match(/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/)) {
          dateStr = part;
        } else if (part.toLowerCase() !== 'batal' && part.toLowerCase() !== 'cancel') {
          prayerStr = part;
        }
      }

      if (!dateStr) {
        await sendReply(from, `❌ Tarikh tidak dijumpai dalam mesej.`);
        return new NextResponse('OK', { status: 200 });
      }

      const date = parseDate(dateStr);
      if (!date || isNaN(date.getTime())) {
        await sendReply(from, `❌ Format tarikh tidak sah: ${dateStr}`);
        return new NextResponse('OK', { status: 200 });
      }

      const dbDate = date.toISOString().split('T')[0];

      // Determine prayer times to cancel
      let prayerTimes: string[] = [];

      if (!prayerStr || prayerStr.toLowerCase() === 'semua' || prayerStr.toLowerCase() === 'all') {
        prayerTimes = [...PRAYER_TIMES];
      } else {
        const normalizedPrayer = PRAYER_ALIASES[prayerStr.toLowerCase()];
        if (normalizedPrayer) {
          prayerTimes = [normalizedPrayer];
        } else if (PRAYER_TIMES.includes(prayerStr)) {
          prayerTimes = [prayerStr];
        } else {
          await sendReply(from, `❌ Waktu solat tidak sah: ${prayerStr}`);
          return new NextResponse('OK', { status: 200 });
        }
      }

      // Delete or update unavailability records
      const cancelledTimes: string[] = [];

      for (const prayerTime of prayerTimes) {
        try {
          const [result] = await pool.execute(
            'DELETE FROM availability WHERE user_id = ? AND date = ? AND prayer_time = ? AND is_available = 0',
            [user.id, dbDate, prayerTime]
          );

          if ((result as any).affectedRows > 0) {
            cancelledTimes.push(prayerTime);
          }
        } catch (error: any) {
          console.error(`Error cancelling unavailability for ${prayerTime}:`, error.message);
        }
      }

      if (cancelledTimes.length > 0) {
        await sendReply(from, `✅ *Cuti Berjaya Dibatalkan*

📅 *Tarikh:* ${formatDateMalay(date)}
🕌 *Waktu:* ${cancelledTimes.join(', ')}

Anda kini tersedia untuk bertugas.`);
      } else {
        await sendReply(from, `ℹ️ Tiada rekod cuti ditemui untuk tarikh dan waktu tersebut.`);
      }

      return new NextResponse('OK', { status: 200 });
    }

    // Default help message
    await sendReply(from, `🕌 *iSAR WhatsApp Bot*

Assalamualaikum ${user.name}! 👋

📝 *Arahan yang tersedia:*

1️⃣ *Rekod Cuti:*
   CUTI [tarikh] [waktu]
   Contoh: CUTI 2024-12-01 Subuh

2️⃣ *Batal Cuti:*
   BATAL [tarikh] [waktu]
   Contoh: BATAL 2024-12-01 Subuh

3️⃣ *Senarai Cuti:*
   SENARAI

💡 *Waktu solat:* Subuh, Zohor, Asar, Maghrib, Isyak
💡 *Guna "semua"* untuk semua waktu

📅 *Format tarikh:*
   • 2024-12-01
   • 01/12/2024`);

    return new NextResponse('OK', { status: 200 });

  } catch (error: any) {
    console.error('[WhatsApp Webhook] Error:', error);
    return new NextResponse('OK', { status: 200 }); // Always return 200 to Twilio
  }
}

// GET - Verify webhook (for testing)
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    message: 'iSAR WhatsApp Webhook is active',
    commands: [
      'CUTI [tarikh] [waktu] - Rekod cuti',
      'BATAL [tarikh] [waktu] - Batal cuti',
      'SENARAI - Lihat senarai cuti',
    ]
  });
}
