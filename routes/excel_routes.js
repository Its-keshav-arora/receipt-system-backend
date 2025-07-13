import express from "express";
const router = express.Router();
import { importCustomers, searchCustomers, getCustomer, printReceipt, editCustomer, deleteCustomer, createCustomer, exportCustomer } from "../controller/customer.controller.js";
import getUser from "../utils/authVerify.js";

// Routes
router.post("/import", getUser, importCustomers);
router.get("/customer/search", searchCustomers);
router.post("/receipt", printReceipt);
router.delete("/customer/delete/:id", deleteCustomer);
router.post("/customer/create", getUser, createCustomer);
router.get("/customer/export", getUser, exportCustomer);
router.get("/customer/:id", getCustomer);
router.put("/customer/:id", editCustomer);

export default router;
