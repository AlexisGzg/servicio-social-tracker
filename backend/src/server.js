import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './config/db.js';
import activityRoutes from './routes/activityRoutes.js';
import authRoutes from './routes/authRoutes.js';

dotenv.config();

const app = express();

app.use(cors({
  origin: (origin, callback) => {
    // Permitir solicitudes sin origen (curl, mobile) o entornos de desarrollo y Vercel
    if (
      !origin ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/.test(origin) ||
      /\.vercel\.app$/.test(origin) ||
      (process.env.CLIENT_URL && origin === process.env.CLIENT_URL)
    ) {
      callback(null, true);
    } else {
      callback(new Error('Bloqueado por CORS: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/activities', activityRoutes);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor corriendo correctamente' });
});

const PORT = process.env.PORT || 4000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
  });
});

export default app;