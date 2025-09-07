import express from "express";
const router = express.Router();
import { importCustomers, searchCustomers, deleteAllData, getCustomer, printReceipt, editCustomer, deleteCustomer, createCustomer, exportCustomer } from "../controller/customer.controller.js";
import getUser from "../utils/authVerify.js";
import { getFlatPaymentHistory, exportFlatPaymentHistory } from "../controller/customer.controller.js";

// Routes
router.post("/import", getUser, importCustomers);
router.get("/customer/search", getUser, searchCustomers);
router.post("/receipt", printReceipt);
router.delete("/customer/delete/:id", deleteCustomer);
router.post("/customer/create", getUser, createCustomer);
router.get("/customer/export", getUser, exportCustomer);
router.get('/customer/history', getUser, getFlatPaymentHistory);
router.get('/customer/history/export', getUser, exportFlatPaymentHistory);
router.get("/customer/:id", getCustomer);
router.put("/customer/:id", editCustomer);
router.delete("/customer/deleteAll", getUser, deleteAllData);

export default router;
