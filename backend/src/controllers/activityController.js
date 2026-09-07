import Activity from '../models/Activity.js';

/**
 * Obtener todas las actividades del usuario autenticado (ordenadas por fecha descendente)
 */
export async function getActivities(req, res) {
  try {
    const activities = await Activity.find({ userId: req.user._id }).sort({ fecha: -1 });
    res.json(activities);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

/**
 * Crear una nueva actividad asociada exclusivamente al usuario autenticado
 */
export async function createActivity(req, res) {
  try {
    const activity = await Activity.create({
      ...req.body,
      userId: req.user._id
    });
    res.status(201).json(activity);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Actualizar una actividad asegurando que pertenezca al usuario autenticado
 */
export async function updateActivity(req, res) {
  try {
    const activity = await Activity.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    if (!activity) {
      return res.status(404).json({ error: 'Actividad no encontrada o no autorizada' });
    }
    res.json(activity);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

/**
 * Eliminar una actividad asegurando que pertenezca al usuario autenticado
 */
export async function deleteActivity(req, res) {
  try {
    const activity = await Activity.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!activity) {
      return res.status(404).json({ error: 'Actividad no encontrada o no autorizada' });
    }
    res.json({ message: 'Actividad eliminada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}