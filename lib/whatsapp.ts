// lib/whatsapp.ts - WhatsApp notification utilities using Fonnte
// API Documentation: https://docs.fonnte.com/api-send-message/

const FONNTE_API_URL = 'https://api.fonnte.com/send';
const FONNTE_TOKEN = process.env.FONNTE_TOKEN;

interface DutyReminder {
  name: string;
  role: 'Imam' | 'Bilal';
  date: string;
  prayerTime: string;
  phone: string;
}

interface FonnteResponse {
  status: boolean;
  detail?: string;
  id?: string;
  process?: string;
  target?: string;
  reason?: string;
}

/**
 * Format phone number for Malaysia (remove leading 0, add 60)
 */
function formatPhoneNumber(phone: string): string {
  let formatted = phone.trim().replace(/[\s\-\(\)]/g, '');

  // Remove whatsapp: prefix if present (from old Twilio format)
  if (formatted.startsWith('whatsapp:')) {
    formatted = formatted.replace('whatsapp:', '');
  }

  // Remove + prefix
  if (formatted.startsWith('+')) {
    formatted = formatted.substring(1);
  }

  // If starts with 0, remove it (Fonnte will add countryCode)
  if (formatted.startsWith('0')) {
    formatted = formatted.substring(1);
  }

  // If already starts with 60, remove it (we'll use countryCode param)
  if (formatted.startsWith('60')) {
    formatted = formatted.substring(2);
  }

  return formatted;
}

/**
 * Send WhatsApp message using Fonnte API
 */
async function sendFonnteMessage(target: string, message: string): Promise<FonnteResponse> {
  if (!FONNTE_TOKEN) {
    console.error('Fonnte token not configured. Set FONNTE_TOKEN in environment variables.');
    return { status: false, reason: 'Fonnte token not configured' };
  }

  try {
    const response = await fetch(FONNTE_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': FONNTE_TOKEN,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        target: target,
        message: message,
        countryCode: '60' // Malaysia
      })
    });

    const result = await response.json() as FonnteResponse;

    if (result.status) {
      console.log(`Fonnte message sent successfully: ${result.id}`);
    } else {
      console.error(`Fonnte message failed: ${result.reason || result.detail}`);
    }

    return result;
  } catch (error: any) {
    console.error('Fonnte API error:', error.message);
    return { status: false, reason: error.message };
  }
}

/**
 * Send WhatsApp reminder to Imam or Bilal about their duty
 */
export async function sendDutyReminder(reminder: DutyReminder): Promise<boolean> {
  const phoneNumber = formatPhoneNumber(reminder.phone);

  // Format date nicely
  const date = new Date(reminder.date);
  const formattedDate = date.toLocaleDateString('ms-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Create personalized message
  const message = `🕌 *Peringatan Tugas iSAR*

السلام عليكم ورحمة الله وبركاته

Salam sejahtera ${reminder.name},

Ini adalah peringatan bahawa anda telah ditugaskan sebagai *${reminder.role}* untuk:

📅 *Tarikh:* ${formattedDate}
🕌 *Waktu Solat:* ${reminder.prayerTime}

جزاك الله خيرا
Semoga Allah memberkati anda atas khidmat yang diberikan.

_Peringatan automatik dari Sistem iSAR_`;

  const result = await sendFonnteMessage(phoneNumber, message);

  if (result.status) {
    console.log(`WhatsApp reminder sent to ${reminder.name} (${reminder.phone})`);
    return true;
  } else {
    console.error(`Failed to send WhatsApp to ${reminder.name} (${reminder.phone}):`, result.reason);
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
    reminders.map(async (reminder) => {
      const success = await sendDutyReminder(reminder);
      return {
        name: reminder.name,
        success
      };
    })
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
  const formatted = formatPhoneNumber(phoneNumber);

  const message = `🕌 *Ujian Sistem iSAR*

السلام عليكم ${name},

Ini adalah mesej ujian dari Sistem Jadual Solat iSAR.

Jika anda menerima mesej ini, notifikasi WhatsApp berfungsi dengan baik! ✅

جزاك الله خيرا`;

  const result = await sendFonnteMessage(formatted, message);

  if (result.status) {
    console.log(`Test message sent to ${name}`);
    return true;
  } else {
    console.error(`Failed to send test message:`, result.reason);
    return false;
  }
}

/**
 * Send custom WhatsApp message
 */
export async function sendCustomMessage(phoneNumber: string, message: string): Promise<boolean> {
  const formatted = formatPhoneNumber(phoneNumber);
  const result = await sendFonnteMessage(formatted, message);
  return result.status;
}

/**
 * Interface for Permohonan Majlis data
 */
interface PermohonanMajlisData {
  id: number;
  nama_pemohon: string;
  no_kad_pengenalan: string;
  alamat: string;
  no_telefon_rumah?: string;
  no_handphone: string;
  tajuk_majlis: string;
  tarikh_majlis: string;
  hari_majlis: string;
  masa_majlis: string;
  waktu_majlis: string;
  jumlah_jemputan: number;
  peralatan: string[];
  peralatan_lain?: string;
}

const PERALATAN_LABELS: Record<string, string> = {
  'meja_makan': 'Meja Makan',
  'kerusi_makan': 'Kerusi Makan',
  'pa_system': 'PA System',
  'pinggan': 'Pinggan',
  'gelas': 'Gelas',
  'perkhidmatan_katering': 'Perkhidmatan Katering'
};

/**
 * Send WhatsApp confirmation to applicant when permohonan majlis is submitted
 */
export async function sendPermohonanMajlisConfirmation(data: PermohonanMajlisData): Promise<boolean> {
  const phoneNumber = formatPhoneNumber(data.no_handphone);

  // Format date nicely
  const date = new Date(data.tarikh_majlis);
  const formattedDate = date.toLocaleDateString('ms-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Format peralatan list
  const peralatanList = data.peralatan
    .map(p => PERALATAN_LABELS[p] || p)
    .join(', ');

  const message = `🕌 *SURAU AR-RAUDHAH*
*Permohonan Majlis Diterima*

السلام عليكم ورحمة الله وبركاته

Yth. *${data.nama_pemohon}*,

Permohonan anda untuk mengadakan majlis di Surau Ar-Raudhah telah *BERJAYA DITERIMA* dan sedang diproses.

━━━━━━━━━━━━━━━━━━
📋 *SALINAN PERMOHONAN*
━━━━━━━━━━━━━━━━━━

*No. Rujukan:* PM-${String(data.id).padStart(4, '0')}

👤 *MAKLUMAT PEMOHON*
• Nama: ${data.nama_pemohon}
• No. KP: ${data.no_kad_pengenalan}
• Alamat: ${data.alamat}
• No. HP: ${data.no_handphone}${data.no_telefon_rumah ? `\n• No. Rumah: ${data.no_telefon_rumah}` : ''}

📅 *MAKLUMAT MAJLIS*
• Tajuk: ${data.tajuk_majlis}
• Tarikh: ${formattedDate}
• Hari: ${data.hari_majlis}
• Masa: ${data.masa_majlis}
• Waktu: ${data.waktu_majlis.charAt(0).toUpperCase() + data.waktu_majlis.slice(1)}
• Jemputan: ${data.jumlah_jemputan} orang

🔧 *PERALATAN*
${peralatanList || 'Tiada'}${data.peralatan_lain ? `\n• Lain-lain: ${data.peralatan_lain}` : ''}

━━━━━━━━━━━━━━━━━━

Pihak pengurusan Surau Ar-Raudhah akan menghubungi anda melalui WhatsApp untuk memaklumkan status kelulusan permohonan.

📞 *Sebarang pertanyaan:*
• Pengerusi: 013-645 3396
• Setiausaha: 012-670 9502
• Siak: 012-974 3858

جزاك الله خيرا
_Sistem iSAR - Surau Ar-Raudhah_`;

  const result = await sendFonnteMessage(phoneNumber, message);

  if (result.status) {
    console.log(`[Permohonan Majlis] Confirmation sent to ${data.nama_pemohon} (${data.no_handphone})`);
    return true;
  } else {
    console.error(`[Permohonan Majlis] Failed to send confirmation to ${data.nama_pemohon}:`, result.reason);
    return false;
  }
}

/**
 * Send WhatsApp notification when permohonan status is updated
 */
export async function sendPermohonanStatusUpdate(
  data: PermohonanMajlisData,
  status: 'approved' | 'rejected',
  rejectionReason?: string
): Promise<boolean> {
  const phoneNumber = formatPhoneNumber(data.no_handphone);

  // Format date nicely
  const date = new Date(data.tarikh_majlis);
  const formattedDate = date.toLocaleDateString('ms-MY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  let message: string;

  if (status === 'approved') {
    message = `🕌 *SURAU AR-RAUDHAH*
*Permohonan Majlis DILULUSKAN*

السلام عليكم ورحمة الله وبركاته

Yth. *${data.nama_pemohon}*,

Alhamdulillah, permohonan anda untuk mengadakan majlis di Surau Ar-Raudhah telah *DILULUSKAN* ✅

━━━━━━━━━━━━━━━━━━
📋 *BUTIRAN MAJLIS*
━━━━━━━━━━━━━━━━━━

*No. Rujukan:* PM-${String(data.id).padStart(4, '0')}
*Tajuk:* ${data.tajuk_majlis}
*Tarikh:* ${formattedDate}
*Masa:* ${data.masa_majlis}
*Jemputan:* ${data.jumlah_jemputan} orang

━━━━━━━━━━━━━━━━━━

⚠️ *PERINGATAN PENTING:*
• Sila pastikan kebersihan surau dijaga selepas majlis
• Kemudahan surau perlu dikembalikan ke keadaan asal
• Dilarang merokok di kawasan surau

📞 *Sebarang pertanyaan:*
• Pengerusi: 013-645 3396
• Setiausaha: 012-670 9502

Terima kasih atas kerjasama anda.

جزاك الله خيرا
_Sistem iSAR - Surau Ar-Raudhah_`;
  } else {
    message = `🕌 *SURAU AR-RAUDHAH*
*Permohonan Majlis TIDAK DILULUSKAN*

السلام عليكم ورحمة الله وبركاته

Yth. *${data.nama_pemohon}*,

Dengan hormatnya dimaklumkan bahawa permohonan anda untuk mengadakan majlis di Surau Ar-Raudhah *TIDAK DAPAT DILULUSKAN* ❌

━━━━━━━━━━━━━━━━━━

*No. Rujukan:* PM-${String(data.id).padStart(4, '0')}
*Tajuk:* ${data.tajuk_majlis}
*Tarikh:* ${formattedDate}

*Sebab Penolakan:*
${rejectionReason || 'Tidak dinyatakan'}

━━━━━━━━━━━━━━━━━━

Anda boleh menghubungi pihak pengurusan untuk maklumat lanjut atau membuat permohonan baru pada tarikh lain.

📞 *Pertanyaan:*
• Pengerusi: 013-645 3396
• Setiausaha: 012-670 9502

Mohon maaf atas sebarang kesulitan.

جزاك الله خيرا
_Sistem iSAR - Surau Ar-Raudhah_`;
  }

  const result = await sendFonnteMessage(phoneNumber, message);

  if (result.status) {
    console.log(`[Permohonan Majlis] Status update (${status}) sent to ${data.nama_pemohon}`);
    return true;
  } else {
    console.error(`[Permohonan Majlis] Failed to send status update to ${data.nama_pemohon}:`, result.reason);
    return false;
  }
}

/**
 * Check if WhatsApp (Fonnte) is configured
 */
export function isWhatsAppConfigured(): boolean {
  return !!FONNTE_TOKEN;
}

/**
 * Get configuration status for debugging
 */
export function getWhatsAppStatus(): { configured: boolean; provider: string } {
  return {
    configured: !!FONNTE_TOKEN,
    provider: 'Fonnte'
  };
}
