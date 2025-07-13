import express from "express";
const router = express.Router();
import { loginUser, signupUser } from '../controller/auth.controller.js';

// Routes
router.post('/login', loginUser);
router.post('/signup', signupUser);

export default router;
