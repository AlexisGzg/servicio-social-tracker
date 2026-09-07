import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
  {
    fecha: {
      type: Date,
      required: true
    },
    horas: {
      type: Number,
      required: true,
      min: 0
    },
    descripcion: {
      type: String,
      required: true,
      trim: true
    },
    lugar: {
      type: String,
      trim: true
    },
    evidenciaUrl: {
      type: String,
      trim: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    }
  },
  { timestamps: true }
);

export default mongoose.model('Activity', activitySchema);