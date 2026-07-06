process.on('uncaughtException', (err) => {
  console.error('[WhatsApp Bridge] Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[WhatsApp Bridge] Unhandled Rejection at:', promise, 'reason:', reason);
});

const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const pino = require('pino');

const app = express();
app.use(express.json());

const PORT = 3001;
let sock = null;

// Load environment variables from .env file
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envLines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of envLines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const firstEquals = trimmed.indexOf('=');
    if (firstEquals === -1) continue;
    const key = trimmed.substring(0, firstEquals).trim();
    let val = trimmed.substring(firstEquals + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    process.env[key] = val;
  }
}

// Read site URL from environment for inbound webhook forwarding
const CONVEX_SITE_URL = process.env.NEXT_PUBLIC_CONVEX_SITE_URL || 'http://localhost:3000';

async function connectToWhatsApp() {
  const authFolder = path.join(__dirname, '.baileys_auth');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false, // We print it manually using qrcode-terminal with small spacing
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) {
      console.log('\n--- SCAN THIS QR CODE WITH WHATSAPP TO CONNECT ---');
      qrcodeTerminal.generate(qr, { small: true });
      console.log('--------------------------------------------------\n');
    }

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('WhatsApp connection closed due to ', lastDisconnect?.error, ', reconnecting: ', shouldReconnect);
      if (shouldReconnect) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('WhatsApp connection opened successfully!');
    }
  });

  sock.ev.on('creds.update', saveCreds);

  // Listen to incoming messages for debugging or forwarding
  sock.ev.on('messages.upsert', async (m) => {
    if (m.type !== 'notify') return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue; // Skip own messages

      const from = msg.key.remoteJid; // e.g. "94771234567@s.whatsapp.net"
      const cleanFrom = from.split('@')[0];
      const messageText = msg.message?.conversation || 
                          msg.message?.extendedTextMessage?.text || 
                          '';

      const isDocument = !!msg.message?.documentMessage;
      const isImage = !!msg.message?.imageMessage;
      
      let fileData = null;
      let fileName = null;
      let mimeType = null;
      
      if (isDocument || isImage) {
        try {
          console.log(`[WhatsApp Incoming] Downloading media attachment...`);
          const buffer = await downloadMediaMessage(
            msg,
            'buffer',
            {},
            { 
              logger: pino({ level: 'silent' })
            }
          );
          fileData = buffer.toString('base64');
          
          if (isDocument) {
            fileName = msg.message.documentMessage.fileName || msg.message.documentMessage.title || 'document.pdf';
            mimeType = msg.message.documentMessage.mimetype || 'application/pdf';
          } else {
            fileName = `image_${Date.now()}.jpg`;
            mimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
          }
          console.log(`[WhatsApp Incoming] Media downloaded successfully: ${fileName} (${mimeType})`);
        } catch (downloadErr) {
          console.error('[WhatsApp Incoming] Error downloading media:', downloadErr.message);
        }
      }

      console.log(`[WhatsApp Incoming] Message from +${cleanFrom}. Text: "${messageText}". Has File: ${!!fileData}`);

      if (!messageText.trim() && !fileData) continue;

      try {
        console.log(`[WhatsApp Incoming] Forwarding to Convex local-whatsapp-inbound webhook...`);
        const bridgeUrl = CONVEX_SITE_URL.endsWith('/') ? CONVEX_SITE_URL : `${CONVEX_SITE_URL}/`;
        const cleanTo = sock.user.id.split('@')[0].split(':')[0];
        
        const res = await fetch(`${bridgeUrl}api/local-whatsapp-inbound`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: cleanFrom,
            text: messageText,
            file: fileData,
            fileName: fileName,
            mimeType: mimeType,
            to: cleanTo,
          }),
        });

        if (!res.ok) {
          console.error(`[WhatsApp Incoming] Convex returned error: ${res.status} ${res.statusText}`);
          continue;
        }

        const data = await res.json();
        if (data.reply) {
          console.log(`[WhatsApp Incoming] Generated LLM reply: "${data.reply}"`);
          console.log(`[WhatsApp Incoming] Sending reply back to +${cleanFrom}...`);
          await sock.sendMessage(from, { text: data.reply });
          console.log(`[WhatsApp Incoming] Reply sent successfully!`);
        }
      } catch (err) {
        console.error(`[WhatsApp Incoming] Error handling local webhook/LLM reply:`, err.message);
      }
    }
  });
}

// REST API for sending outbound messages
app.post('/send', async (req, res) => {
  const { to, message } = req.body;

  if (!sock) {
    return res.status(500).json({ success: false, error: 'WhatsApp client is not initialized' });
  }

  if (!to || !message) {
    return res.status(400).json({ success: false, error: 'Missing target phone number or message body' });
  }

  // Clean the target number: extract digits only
  const digits = to.replace(/[^0-9]/g, '');
  if (!digits) {
    return res.status(400).json({ success: false, error: 'Invalid phone number format' });
  }

  const jid = `${digits}@s.whatsapp.net`;

  try {
    console.log(`[WhatsApp Bridge] Sending message to +${digits}: "${message}"`);
    
    // Check if the number is on WhatsApp (optional but recommended)
    try {
      const [result] = await sock.onWhatsApp(jid);
      if (!result || !result.exists) {
        console.warn(`[WhatsApp Bridge] Warning: ${digits} does not seem to be a registered WhatsApp account.`);
      }
    } catch (verifyErr) {
      console.warn(`[WhatsApp Bridge] Failed to verify number status on WhatsApp:`, verifyErr.message);
    }

    const response = await sock.sendMessage(jid, { text: message });
    console.log('[WhatsApp Bridge] Message sent successfully! Response:', JSON.stringify(response));
    return res.status(200).json({ success: true, messageId: response?.key?.id, jid: response?.key?.remoteJid });
  } catch (err) {
    console.error('[WhatsApp Bridge] Error sending message:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`WhatsApp Local Bridge Express Server running on port ${PORT}`);
  connectToWhatsApp();
});
