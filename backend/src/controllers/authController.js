import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { sendVerificationEmail, sendPasswordResetEmail } from '../utils/sendEmail.js';

// Generar Token JWT firmado
function generateToken(id) {
  return jwt.sign(
    { id },
    process.env.JWT_SECRET || 'una_clave_larga_y_random_12345',
    { expiresIn: '30d' }
  );
}

/**
 * @route   POST /api/auth/register
 * @desc    Registrar un nuevo usuario con contraseña hasheada y token de verificación
 */
export async function register(req, res) {
  try {
    const { nombre, email, password } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ error: 'Todos los campos son obligatorios' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe contener al menos 6 caracteres' });
    }

    const emailNorm = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: emailNorm });
    if (existingUser) {
      return res.status(400).json({ error: 'Este correo electrónico ya está registrado' });
    }

    // Generar token seguro para verificación de correo (válido por 24h)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      nombre: nombre.trim(),
      email: emailNorm,
      password, // El pre-save hook de Mongoose aplica bcrypt con 12 rondas de salt
      verificationToken,
      verificationTokenExpires
    });

    const token = generateToken(user._id);
    const clientUrl = req.headers.origin || 'http://127.0.0.1:5500';

    // Enviar correo de verificación de forma asíncrona
    sendVerificationEmail({
      to: user.email,
      nombre: user.nombre,
      token: verificationToken,
      clientUrl
    }).catch((err) => console.error('Error al enviar correo de bienvenida:', err));

    const isSimulated = !process.env.EMAIL_USER;
    const devVerificationLink = isSimulated ? `${clientUrl}?verifyToken=${verificationToken}` : undefined;

    res.status(201).json({
      message: isSimulated
        ? 'Cuenta creada con éxito. (Modo Local: el enlace de verificación se generó en la consola del backend).'
        : 'Cuenta creada con éxito. Se envió un correo de verificación.',
      token,
      devVerificationLink,
      user: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        isVerified: user.isVerified,
        metaHoras: user.metaHoras
      }
    });
  } catch (error) {
    console.error('Error en register:', error);
    res.status(500).json({ error: 'Error al registrar el usuario: ' + error.message });
  }
}

/**
 * @route   POST /api/auth/login
 * @desc    Autenticar usuario y obtener JWT
 */
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Por favor ingresa correo y contraseña' });
    }

    const emailNorm = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas (correo o contraseña incorrectos)' });
    }

    // Comparar contraseña con el hash seguro en base de datos
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas (correo o contraseña incorrectos)' });
    }

    const token = generateToken(user._id);

    res.json({
      message: 'Inicio de sesión exitoso',
      token,
      user: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        isVerified: user.isVerified,
        metaHoras: user.metaHoras
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error al iniciar sesión: ' + error.message });
  }
}

/**
 * @route   GET /api/auth/verify-email/:token
 * @desc    Confirmar correo electrónico mediante token
 */
export async function verifyEmail(req, res) {
  try {
    const { token } = req.params;

    const user = await User.findOne({
      verificationToken: token,
      verificationTokenExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'El enlace de verificación es inválido o ya ha expirado' });
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    const authToken = generateToken(user._id);

    res.json({
      success: true,
      message: '¡Correo electrónico verificado exitosamente! Tu cuenta está plenamente activa.',
      token: authToken,
      user: {
        _id: user._id,
        nombre: user.nombre,
        email: user.email,
        isVerified: true,
        metaHoras: user.metaHoras
      }
    });
  } catch (error) {
    console.error('Error en verifyEmail:', error);
    res.status(500).json({ error: 'Error al verificar correo: ' + error.message });
  }
}

/**
 * @route   POST /api/auth/forgot-password
 * @desc    Solicitar restablecimiento de contraseña
 */
export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Por favor ingresa tu correo electrónico' });
    }

    const emailNorm = email.toLowerCase().trim();
    const user = await User.findOne({ email: emailNorm });

    // Por seguridad, responder de forma neutra para no divulgar si un correo existe
    if (!user) {
      return res.json({
        message: 'Si el correo electrónico está registrado, recibirás un enlace de restablecimiento.'
      });
    }

    // Generar token de reseteo con vigencia de 1 hora
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);
    await user.save();

    const clientUrl = req.headers.origin || 'http://127.0.0.1:5500';

    sendPasswordResetEmail({
      to: user.email,
      nombre: user.nombre,
      token: resetToken,
      clientUrl
    }).catch((err) => console.error('Error al enviar correo de recuperación:', err));

    res.json({
      message: 'Si el correo electrónico está registrado, recibirás un enlace de restablecimiento.'
    });
  } catch (error) {
    console.error('Error en forgotPassword:', error);
    res.status(500).json({ error: 'Error al procesar la solicitud: ' + error.message });
  }
}

/**
 * @route   POST /api/auth/reset-password/:token
 * @desc    Restablecer contraseña usando token
 */
export async function resetPassword(req, res) {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'El enlace de recuperación es inválido o ha expirado' });
    }

    // Asignar nueva contraseña (el pre-save hook la hasheará con salt)
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: 'Tu contraseña ha sido actualizada exitosamente. Ya puedes iniciar sesión con tu nueva clave.'
    });
  } catch (error) {
    console.error('Error en resetPassword:', error);
    res.status(500).json({ error: 'Error al restablecer contraseña: ' + error.message });
  }
}

/**
 * @route   GET /api/auth/me
 * @desc    Obtener datos del usuario autenticado actual
 */
export async function getMe(req, res) {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * @route   POST /api/auth/resend-verification
 * @desc    Reenviar correo de verificación para el usuario autenticado
 */
export async function resendVerification(req, res) {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    if (user.isVerified) {
      return res.status(400).json({ message: 'Tu cuenta ya está verificada.' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    user.verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    const clientUrl = req.headers.origin || 'http://127.0.0.1:5500';

    await sendVerificationEmail({
      to: user.email,
      nombre: user.nombre,
      token: verificationToken,
      clientUrl
    });

    const isSimulated = !process.env.EMAIL_USER;
    const devVerificationLink = isSimulated ? `${clientUrl}?verifyToken=${verificationToken}` : undefined;

    res.json({
      success: true,
      message: isSimulated
        ? 'Enlace de verificación generado en la consola del servidor (Modo Local).'
        : 'Correo de verificación reenviado exitosamente. Revisa tu bandeja de entrada o spam.',
      devVerificationLink
    });
  } catch (error) {
    console.error('Error en resendVerification:', error);
    res.status(500).json({ error: 'Error al reenviar verificación: ' + error.message });
  }
}
