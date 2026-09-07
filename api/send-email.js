import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Configuración de cabeceras CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      // fallback
    }
  }

  const { to, subject, html, text, secret } = body || {};
  const expectedSecret = process.env.MAIL_RELAY_SECRET || 'sst_secure_relay_2026';

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'No autorizado para usar el relay' });
  }

  if (!to || !subject) {
    return res.status(400).json({ error: 'Faltan campos obligatorios (to, subject)' });
  }

  try {
    const emailUser = process.env.EMAIL_USER || 'alexismaddock14@gmail.com';
    const rawPass = process.env.EMAIL_PASS || 'zldzvuaualzcnvay';
    const emailPass = rawPass.replace(/\s+/g, '');

    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // SSL en puerto 465 (abierto y permitido en Vercel)
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Servicio Social Tracker" <${emailUser}>`,
      to,
      subject,
      text,
      html
    });

    console.log(`✅ [Vercel Relay] Correo enviado a ${to}:`, info.messageId);
    return res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error(`❌ [Vercel Relay] Error enviando correo a ${to}:`, error.message);
    return res.status(500).json({ success: false, error: error.message });
  }
}
