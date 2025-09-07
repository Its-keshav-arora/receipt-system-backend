// models/Customer.js
import mongoose from "mongoose";

const paymentHistorySchema = new mongoose.Schema({
  date: String,
  time: String,
  amount: Number,
  balance : Number,
  method: String,
});

const customerSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

  name: { type: String, required: true },
  mobile: { type: String, required: true },
  address: { type: String },

  boxNumbers: [{ type: String }],
  previousBalance: { type: Number, default: 0 },
  currentMonthPayment: { type: Number, default: 0 },

  createdAt: { type: Date, default: Date.now },
  history: [paymentHistorySchema],
});

export default mongoose.model("Customer", customerSchema);
