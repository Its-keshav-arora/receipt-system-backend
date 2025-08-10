import Customer from "../models/customer.schema.js";
import Box from "../models/boxes.schema.js";
import XLSX from "xlsx";
import fs from "fs";
import path from "path";
import ExcelJS from "exceljs";

export const importCustomers = async (req, res) => {
  const userId = req.user._id;

  try {
    const { customers } = req.body;

    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({ message: "No customer data provided" });
    }

    const allBoxNumbers = new Set();
    customers.forEach((row) => {
      const box = (row.box ?? "").toString().trim();
      if (box) allBoxNumbers.add(box);
    });

    const existingBoxes = await Box.find({
      boxNumber: { $in: [...allBoxNumbers] },
    });

    const existingBoxSet = new Set(existingBoxes.map((b) => b.boxNumber));

    const allProcessed = [];
    let currentCustomer = null;

    for (const row of customers) {
      const name = (row.name ?? "").trim();
      const box = (row.box ?? "").toString().trim();
      const mobile = (row.mobile ?? "").toString().trim();
      const balance = parseFloat(row.balance ?? 0);
      const curr = parseFloat(row.curr ?? 0);
      const address = (row.address ?? "").trim();

      if (name) {
        if (currentCustomer) allProcessed.push(currentCustomer);

        currentCustomer = {
          userId,
          name,
          boxNumbers: [],
          mobileNumbers: new Set(),
          addressList: new Set(),
          previousBalance: 0,
          currentMonthPayment: 0,
        };
      }

      if (!currentCustomer) continue;

      const isBoxAlreadyRegistered = box && existingBoxSet.has(box);
      if (!isBoxAlreadyRegistered && box) {
        currentCustomer.boxNumbers.push(box);
      }

      if (mobile) currentCustomer.mobileNumbers.add(mobile);
      if (address) currentCustomer.addressList.add(address);
      currentCustomer.previousBalance += isNaN(balance) ? 0 : balance;
      currentCustomer.currentMonthPayment += isNaN(curr) ? 0 : curr;
    }

    if (currentCustomer) {
      allProcessed.push(currentCustomer);
    }

    // Prepare customer docs
    const customerDocs = allProcessed
      .filter((c) => c.boxNumbers.length > 0)
      .map((c) => ({
        userId: c.userId,
        name: c.name,
        mobile: [...c.mobileNumbers].join(", "),
        address: [...c.addressList].join(", "),
        previousBalance: c.previousBalance,
        currentMonthPayment: c.currentMonthPayment,
      }));

    // Insert customers and get their IDs
    const insertedCustomers = await Customer.insertMany(customerDocs);

    // Now prepare boxes with customerId
    const newBoxes = [];
    insertedCustomers.forEach((cust, i) => {
      const originalData = allProcessed[i];
      originalData.boxNumbers.forEach((boxNum) => {
        newBoxes.push({
          userId,
          customerId: cust._id,
          boxNumber: boxNum,
        });
      });
    });

    await Box.insertMany(newBoxes, { ordered: false }).catch(() => {});

    return res.status(200).json({
      message: "✅ Customers and their boxes imported (excluding existing boxes)",
      customersInserted: insertedCustomers.length,
      boxesInserted: newBoxes.length,
    });

  } catch (err) {
    console.error("Import Error:", err);
    return res.status(500).json({ message: "Server Error" });
  }
};


export const deleteAllData = async (req, res) => {
  try {
    const userId = req.user._id; // From token via middleware

    // Find all customers of this user
    const customers = await Customer.find({ userId });

    for (const customer of customers) {
      // Delete all boxes for this customer
      await Box.deleteMany({ customerId: customer._id });

      // Delete this customer
      await Customer.deleteOne({ _id: customer._id });
    }

    res.json({
      success: true,
      message: `Deleted ${customers.length} customers and all their boxes for this user.`,
    });
  } catch (error) {
    console.error("Delete customers & boxes error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete customers and boxes.",
    });
  }
};



export const searchCustomers = async (req, res) => {
  try {
    const { type, query } = req.query;

    if (!type || !query) {
      return res
        .status(400)
        .json({ message: "Search type and query are required." });
    }

    let filter = {};

    switch (type) {
      case "box":
        filter = { boxNumbers: { $regex: query, $options: "i" } };
        break;

      case "mobile":
        filter = { mobile: { $regex: query, $options: "i" } };
        break;

      case "name":
        filter = { name: { $regex: query, $options: "i" } };
        break;

      default:
        return res.status(400).json({ message: "Invalid search type." });
    }

    const customers = await Customer.find(filter).select(
      "name boxNumbers previousBalance currentMonthPayment mobile"
    );

    const formattedCustomers = customers.map((c) => ({
      _id: c._id,
      name: c.name,
      boxNumbers: c.boxNumbers,
      pendingPayment: c.previousBalance,
      currentMonthPayment: c.currentMonthPayment,
      mobile: c.mobile,
    }));

    res.json({ customers: formattedCustomers });
  } catch (err) {
    console.error(err);
    res
      .status(500)
      .json({ message: "Server error while searching customers." });
  }
};

export const getCustomer = async (req, res) => {
  const { id } = req.params;

  try {
    const customer = await Customer.findById(id);
    // console.log("This is customer : ");

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.json({ customer });
  } catch (err) {
    console.error("Error fetching customer:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

export const printReceipt = async (req, res) => {
  const { customerId, amountPaid, paymentMethod } = req.body;
  try {
    const customer = await Customer.findById(customerId);
    // console.log(customer);
    if (!customer)
      return res.status(404).json({ message: "Customer not found" });

    const newBalance =
      customer.previousBalance + customer.currentMonthPayment - amountPaid;

    const now = new Date();
    const date = now.toLocaleDateString();
    const time = now.toLocaleTimeString();

    customer.previousBalance = newBalance;
    customer.currentMonthPayment = 0;

    customer.history.push({
      date,
      time,
      amount: amountPaid,
      method: paymentMethod,
    });

    await customer.save();

    res
      .status(200)
      .json({ message: "Payment recorded", newBalance, date, time });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};

export const editCustomer = async (req, res) => {
  const { _id } = req.body;
  try {
    const customer = await Customer.findByIdAndUpdate(
      _id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!customer)
      return res.status(404).json({ message: "customer not found" });
    res.json("customer updated", customer);
  } catch (err) {
    console.log(err);
  }
};

export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  try {
    const deletedCustomer = await Customer.findByIdAndDelete(id);
    if (!deletedCustomer)
      return res.status(404).json({ message: "Customer not foudn" });
    res.status(200).json({ message: "Customer deleted Successfully" });
  } catch (err) {
    // console.log("Err deleting customer : ", err);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

export const createCustomer = async (req, res) => {
  const { name, mobile, address, currentMonthPayment, boxNumbers } = req.body;

  if (!name || !mobile) {
    return res.status(400).json({ message: "Name and Mobile are required" });
  }

  try {
    const newCustomer = new Customer({
      userId: req.user._id,
      name,
      mobile,
      address,
      currentMonthPayment: Number(currentMonthPayment) || 0,
      previousBalance: 0,
      boxNumbers: boxNumbers || [],
      history: [],
    });

    await newCustomer.save();

    res.status(201).json({
      message: "Customer created successfully",
      customer: newCustomer,
    });
  } catch (err) {
    console.error("Create customer error:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const exportCustomer = async (req, res) => {
  try {
    // console.log("This is user id : ", req.user._id);
    const userId = req.user._id;

    const customers = await Customer.find({ userId });

    const sortedCustomers = customers
      .map((c) => ({
        name: c.name,
        boxNumbers: c.boxNumbers.join(", "),
        mobile: c.mobile,
        address: c.address || "",
        previousBalance: c.previousBalance || 0,
        currentMonthPayment: c.currentMonthPayment || 0,
        totalOutstanding:
          (c.previousBalance || 0) + (c.currentMonthPayment || 0),
      }))
      .sort((a, b) => b.totalOutstanding - a.totalOutstanding);

    // CSV Header
    const headers = [
      "Name",
      "Box Numbers",
      "Mobile",
      "Address",
      "Previous Balance",
      "This Month",
      "Total Outstanding",
    ];

    // CSV Rows
    const rows = sortedCustomers.map((c) =>
      [
        c.name,
        `"${c.boxNumbers}"`, // quote it to avoid comma-splitting
        c.mobile,
        `"${c.address}"`,
        c.previousBalance,
        c.currentMonthPayment,
        c.totalOutstanding,
      ].join(",")
    );

    const csvContent = [headers.join(","), ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=CustomerReport.csv"
    );

    res.send(csvContent);
  } catch (err) {
    console.error("CSV export error:", err);
    res.status(500).json({ message: "Failed to export customer data" });
  }
};

const getUserPaymentsWithinDateRange = async (userId, from, to) => {
  const customers = await Customer.find({ userId });

  const payments = [];

  customers.forEach((customer) => {
    customer.history.forEach((entry) => {
      const entryDate = new Date(entry.date);
      if (entryDate >= new Date(from) && entryDate <= new Date(to)) {
        payments.push({
          name: customer.name,
          mobile: customer.mobile,
          amount: entry.amount,
          method: entry.method,
          date: entry.date,
          time: entry.time,
        });
      }
    });
  });

  return payments;
};

export const getFlatPaymentHistory = async (req, res) => {
  const userId = req.user.id;
  // console.log("this is user : ", userId);
  const { from, to } = req.query;
  // console.log("from : ",from , " & to : ", to);

  if (!from || !to) {
    return res
      .status(400)
      .json({ message: "Both from and to dates are required" });
  }

  try {
    const payments = await getUserPaymentsWithinDateRange(userId, from, to);
    // console.log(payments);
    res.json({ payments });
  } catch (err) {
    console.error("Error fetching payments:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const exportFlatPaymentHistory = async (req, res) => {
  const userId = req.user.id;
  const { from, to } = req.query;

  if (!from || !to) {
    return res
      .status(400)
      .json({ message: "Both from and to dates are required" });
  }

  try {
    const payments = await getUserPaymentsWithinDateRange(userId, from, to);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Payments");

    sheet.columns = [
      { header: "Name", key: "name", width: 20 },
      { header: "Mobile", key: "mobile", width: 15 },
      { header: "Amount", key: "amount", width: 10 },
      { header: "Method", key: "method", width: 15 },
      { header: "Date", key: "date", width: 15 },
      { header: "Time", key: "time", width: 10 },
    ];

    sheet.addRows(payments);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=payment_history.xlsx"
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error("Export error:", err);
    res.status(500).json({ message: "Failed to export payment history" });
  }
};
