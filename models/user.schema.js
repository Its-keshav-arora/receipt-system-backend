// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  name : {type : String, required : true},
  mobile : {type : String, default : "9217092170"},
  role: { type: String, enum: ['superadmin', 'user'], default: 'user' },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model('User', userSchema);