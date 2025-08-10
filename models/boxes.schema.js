import mongoose from 'mongoose';

const boxSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
  boxNumber: { type: String, required: true, unique: true },
});

export default mongoose.model("Box", boxSchema);
