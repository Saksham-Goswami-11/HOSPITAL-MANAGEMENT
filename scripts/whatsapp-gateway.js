const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const express = require('express');
const app = express();
const port = 3001;

app.use(express.json());

// Initialize WhatsApp Client
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox'],
    }
});

client.on('qr', (qr) => {
    console.log('--- SCAN THIS QR CODE WITH YOUR WHATSAPP ---');
    qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
    console.log('WhatsApp Client is READY!');
});

client.on('authenticated', () => {
    console.log('AUTHENTICATED');
});

client.on('auth_failure', msg => {
    console.error('AUTHENTICATION FAILURE', msg);
});

// Endpoint to send message
app.post('/send', async (req, res) => {
    const { number, message } = req.json();

    if (!number || !message) {
        return res.status(400).send({ error: 'Number and message are required' });
    }

    try {
        // Format number: suffix @c.us (and ensure it doesn't have suffix already)
        const chatId = number.includes('@c.us') ? number : `${number}@c.us`;
        
        console.log(`Attempting to send message to: ${chatId}`);
        await client.sendMessage(chatId, message);
        
        res.send({ success: true, message: 'Sent' });
    } catch (error) {
        console.error('Failed to send message:', error);
        res.status(500).send({ error: 'Failed to send message', details: error.message });
    }
});

client.initialize();

app.listen(port, () => {
    console.log(`WhatsApp Gateway listening at http://localhost:${port}`);
    console.log(`Target this URL using Ngrok to link with Supabase.`);
});
