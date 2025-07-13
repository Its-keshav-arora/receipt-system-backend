// models/Receipt.js
import mongoose from 'mongoose';

const receiptSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  customerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },

  amountPaid: { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },

  paymentMethod: { type: String, enum: ['GPay', 'PhonePe', 'Paytm', 'Cash', 'Other'] },

  month: { type: String, required: true },
});

export default mongoose.model('Receipt', receiptSchema);
