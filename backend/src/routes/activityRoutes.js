import express from 'express';
import {
  getActivities,
  createActivity,
  updateActivity,
  deleteActivity
} from '../controllers/activityController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Todas las rutas de actividades requieren autenticación JWT
router.use(protect);

router.get('/', getActivities);
router.post('/', createActivity);
router.put('/:id', updateActivity);
router.delete('/:id', deleteActivity);

export default router;