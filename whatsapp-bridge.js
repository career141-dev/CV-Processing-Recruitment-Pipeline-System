const express = require('express');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const qrcodeTerminal = require('qrcode-terminal');
const path = require('path');
const fs = require('fs');

const pino = require('pino');

const app = express();
app.use(express.json());

const PORT = 3001;
let sock = null;

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

      console.log(`[WhatsApp Incoming] Message from +${cleanFrom}: ${messageText}`);

      // Optional: Forward inbound text messages or attachments to Convex Webhook
      // Note: Meta Cloud API webhook signature verification is enabled in metaWhatsappAgent,
      // so if you want to forward, you would need to either mock it or configure signature bypass.
      // For now, we will log it locally.
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
    const [result] = await sock.onWhatsApp(jid);
    if (!result || !result.exists) {
      console.warn(`[WhatsApp Bridge] Warning: ${digits} does not seem to be a registered WhatsApp account.`);
    }

    await sock.sendMessage(jid, { text: message });
    return res.status(200).json({ success: true });
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
