import nodemailer from 'nodemailer';

/**
 * Servicio de envío de correos electrónicos transaccionales
 * Diseñado con soporte para SMTP real y modo de desarrollo automático (logging en consola)
 */
export async function sendEmail({ to, subject, html, text }) {
  const hasSmtpConfig = process.env.EMAIL_USER && process.env.EMAIL_PASS;

  if (!hasSmtpConfig) {
    // MODO DE DESARROLLO / PRUEBAS LOCALES:
    // Imprime el enlace y el correo directamente en la consola con diseño visual destacado
    console.log('\n' + '='.repeat(70));
    console.log(`📨 [SIMULADOR DE EMAIL SEGURO - SERVICIO SOCIAL TRACKER]`);
    console.log(`Para: ${to}`);
    console.log(`Asunto: ${subject}`);
    console.log('-'.repeat(70));
    console.log(text || html);
    console.log('='.repeat(70) + '\n');
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST || 'smtp.gmail.com',
      port: Number(process.env.EMAIL_PORT) || 587,
      secure: process.env.EMAIL_PORT == 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: (process.env.EMAIL_PASS || '').replace(/\s+/g, '')
      }
    });

    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || `"Servicio Social Tracker" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
      html
    });

    console.log(`✅ Correo enviado a ${to}: MessageId: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error(`❌ Error al enviar correo a ${to}:`, error.message);
    // No interrumpir la ejecución si falla el envío externo
    return { success: false, error: error.message };
  }
}

/**
 * Plantilla de Correo para Verificación de Cuenta
 */
export async function sendVerificationEmail({ to, nombre, token, clientUrl }) {
  const verifyUrl = `${clientUrl}?verifyToken=${token}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fafafa; padding: 40px 30px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #a1a1aa;">SERVICIO SOCIAL TRACKER</span>
        <h1 style="color: #ffffff; font-size: 26px; margin: 10px 0;">Confirma tu Cuenta</h1>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8;">Hola <strong>${nombre}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa;">Gracias por registrarte en el sistema ejecutivo de control de servicio social. Para activar tu cuenta y comenzar a registrar tus horas de manera segura, por favor confirma tu correo electrónico:</p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${verifyUrl}" style="background: #ffffff; color: #09090b; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Verificar mi Correo</a>
      </div>
      <p style="font-size: 12px; color: #71717a; line-height: 1.5;">Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:<br><a href="${verifyUrl}" style="color: #a1a1aa;">${verifyUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #27272a; margin: 30px 0;">
      <p style="font-size: 11px; color: #52525b; text-align: center;">Si tú no creaste esta cuenta, puedes ignorar este mensaje.</p>
    </div>
  `;

  const text = `Hola ${nombre},\n\nConfirma tu cuenta en Servicio Social Tracker accediendo al siguiente enlace:\n${verifyUrl}\n\nSi no creaste esta cuenta, ignora este mensaje.`;

  return sendEmail({
    to,
    subject: 'Verifica tu cuenta · Servicio Social Tracker',
    html,
    text
  });
}

/**
 * Plantilla de Correo para Recuperación de Contraseña
 */
export async function sendPasswordResetEmail({ to, nombre, token, clientUrl }) {
  const resetUrl = `${clientUrl}?resetToken=${token}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #09090b; color: #fafafa; padding: 40px 30px; border-radius: 16px; border: 1px solid #27272a;">
      <div style="text-align: center; margin-bottom: 30px;">
        <span style="font-size: 11px; letter-spacing: 0.15em; text-transform: uppercase; color: #a1a1aa;">SEGURIDAD & ACCESO</span>
        <h1 style="color: #ffffff; font-size: 26px; margin: 10px 0;">Recuperación de Contraseña</h1>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #d4d4d8;">Hola <strong>${nombre}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #a1a1aa;">Recibimos una solicitud para restablecer la contraseña de tu cuenta en Servicio Social Tracker. Haz clic en el botón a continuación para definir una nueva clave:</p>
      <div style="text-align: center; margin: 35px 0;">
        <a href="${resetUrl}" style="background: #ffffff; color: #09090b; padding: 14px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block;">Restablecer Contraseña</a>
      </div>
      <p style="font-size: 13px; color: #eab308;">⚠️ Este enlace expirará en 1 hora por razones de seguridad.</p>
      <p style="font-size: 12px; color: #71717a; line-height: 1.5; margin-top: 15px;">Si el botón no funciona, copia y pega este enlace:<br><a href="${resetUrl}" style="color: #a1a1aa;">${resetUrl}</a></p>
      <hr style="border: none; border-top: 1px solid #27272a; margin: 30px 0;">
      <p style="font-size: 11px; color: #52525b; text-align: center;">Si no solicitaste este cambio, puedes ignorar este correo; tu contraseña actual continuará siendo segura.</p>
    </div>
  `;

  const text = `Hola ${nombre},\n\nPara restablecer tu contraseña en Servicio Social Tracker, accede a este enlace:\n${resetUrl}\n\nEste enlace expira en 1 hora.\nSi no solicitaste este cambio, ignora este mensaje.`;

  return sendEmail({
    to,
    subject: 'Restablecimiento de Contraseña · Servicio Social Tracker',
    html,
    text
  });
}
