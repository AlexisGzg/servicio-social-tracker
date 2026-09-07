import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * Middleware para proteger rutas mediante JSON Web Token (JWT)
 */
export async function protect(req, res, next) {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];

      // Verificar firma del token
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'una_clave_larga_y_random_12345'
      );

      // Obtener el usuario autenticado sin incluir el hash de la contraseña
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({ error: 'Usuario no encontrado o dado de baja' });
      }

      return next();
    } catch (error) {
      console.error('Error de autenticación JWT:', error.message);
      return res.status(401).json({ error: 'No autorizado, sesión expirada o token inválido' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Acceso denegado. No se proporcionó token de sesión' });
  }
}
