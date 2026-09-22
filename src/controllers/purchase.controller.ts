import crypto from "crypto";
import { Response } from "express";
import Purchase from "../models/purchase.model";
import TestSeries from "../models/testSeries.model";
import User from "../models/user.model";
import Order from "../models/order.model";
import { AuthRequest } from "../middleware/auth.middleware";
import { razorpay, getRazorpayKeyId, getRazorpayKeySecret } from "../config/razorpay";

function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = getRazorpayKeySecret();
  if (!secret) return false;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuf = Buffer.from(expected, "utf8");
  const actualBuf = Buffer.from(signature, "utf8");
  if (expectedBuf.length !== actualBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}

export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { testSeriesId } = req.body as { testSeriesId?: string };

    if (!testSeriesId) {
      res.status(400).json({ message: "testSeriesId is required" });
      return;
    }

    const series = await TestSeries.findById(testSeriesId);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Check if already owned
    const alreadyPurchased = (user.purchasedSeries || []).some(
      (id) => String(id) === String(testSeriesId)
    );
    if (alreadyPurchased) {
      res.status(400).json({ message: "You already own this test series" });
      return;
    }

    const isCoaching = !!user.isCoachingStudent;
    const isPaidSeries = series.accessType === "paid" || !!series.isPaid;
    const amount = !isPaidSeries
      ? 0
      : isCoaching
      ? (series.coachingPrice > 0 ? series.coachingPrice : series.price)
      : series.price;

    const amountInPaise = Math.round(amount * 100);
    const keyId = getRazorpayKeyId();

    if (!keyId || amountInPaise === 0) {
      // Fallback for free or dev mode
      const dummyOrder = await Order.create({
        user: userId,
        series: series._id,
        razorpayOrderId: `order_dev_${Date.now()}`,
        amount,
        currency: "INR",
        status: "created",
      });
      res.status(200).json({
        orderId: dummyOrder.razorpayOrderId,
        amount: amountInPaise,
        currency: "INR",
        keyId: keyId || "rzp_test_dev",
        title: series.title,
        testSeriesId,
      });
      return;
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { testSeriesId: String(series._id), userId },
    });

    await Order.create({
      user: userId,
      series: series._id,
      razorpayOrderId: razorpayOrder.id,
      amount,
      currency: "INR",
      status: "created",
    });

    res.status(201).json({
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId,
      title: series.title,
      testSeriesId,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create Razorpay order", error });
  }
};

export const verifyPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, testSeriesId } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      testSeriesId?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ message: "Missing Razorpay verification details" });
      return;
    }

    const order = await Order.findOne({ razorpayOrderId: razorpay_order_id, user: userId });
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      order.status = "failed";
      await order.save();
      res.status(400).json({ message: "Invalid payment signature" });
      return;
    }

    order.status = "paid";
    await order.save();

    const targetSeriesId = testSeriesId || String(order.series);
    const user = await User.findById(userId);
    const series = await TestSeries.findById(targetSeriesId);

    if (user && series) {
      const isCoaching = !!user.isCoachingStudent;
      const amountPaid = order.amount;

      await Purchase.findOneAndUpdate(
        { user: userId, testSeries: targetSeriesId, status: "success" },
        {
          $setOnInsert: {
            user: userId,
            testSeries: targetSeriesId,
            amountPaid,
            isCoachingStudent: isCoaching,
            paymentId: razorpay_payment_id,
            status: "success",
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      if (!user.purchasedSeries) user.purchasedSeries = [];
      if (!user.purchasedSeries.some((id) => String(id) === String(targetSeriesId))) {
        user.purchasedSeries.push(series._id as any);
        await user.save();
      }
    }

    res.status(200).json({
      success: true,
      message: "Payment verified successfully!",
      purchasedSeries: user?.purchasedSeries,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify payment", error });
  }
};

export const buySeries = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { testSeriesId } = req.body as { testSeriesId?: string };

    if (!testSeriesId) {
      res.status(400).json({ message: "testSeriesId is required" });
      return;
    }

    const series = await TestSeries.findById(testSeriesId);
    if (!series) {
      res.status(404).json({ message: "Test series not found" });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const existing = await Purchase.findOne({ user: userId, testSeries: testSeriesId, status: "success" });
    if (existing) {
      res.status(200).json({
        message: "You already own this test series.",
        purchase: existing,
        purchasedSeries: user.purchasedSeries || [testSeriesId],
      });
      return;
    }

    const isCoaching = !!user.isCoachingStudent;
    const isPaidSeries = series.accessType === "paid" || !!series.isPaid;
    const amountPaid = !isPaidSeries
      ? 0
      : isCoaching
      ? (series.coachingPrice > 0 ? series.coachingPrice : series.price)
      : series.price;

    const paymentId = `PAY_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    const purchase = await Purchase.create({
      user: userId,
      testSeries: testSeriesId,
      amountPaid,
      isCoachingStudent: isCoaching,
      paymentId,
      status: "success",
      createdAt: new Date(),
    });

    if (!user.purchasedSeries) user.purchasedSeries = [];
    if (!user.purchasedSeries.some((id) => String(id) === String(testSeriesId))) {
      user.purchasedSeries.push(series._id as any);
      await user.save();
    }

    res.status(200).json({
      message: "Test series unlocked successfully!",
      purchase,
      purchasedSeries: user.purchasedSeries,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to process purchase", error });
  }
};

export const getMyPurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const purchases = await Purchase.find({ user: userId, status: "success" });
    const purchasedSeriesIds = purchases.map((p) => String(p.testSeries));
    res.status(200).json({ purchasedSeriesIds });
  } catch (error) {
    res.status(500).json({ message: "Failed to load purchases", error });
  }
};

export const getRevenueSummary = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const purchases = await Purchase.find({ status: "success" }).populate("testSeries", "title");

    let totalRevenue = 0;
    let coachingRevenue = 0;
    let outsiderRevenue = 0;
    const seriesRevenueMap = new Map<string, { title: string; count: number; total: number }>();

    for (const p of purchases) {
      const amount = p.amountPaid || 0;
      totalRevenue += amount;
      if (p.isCoachingStudent) {
        coachingRevenue += amount;
      } else {
        outsiderRevenue += amount;
      }

      const sId = String(p.testSeries?._id || p.testSeries);
      const title = (p.testSeries as any)?.title || "Test Series";
      const existing = seriesRevenueMap.get(sId) || { title, count: 0, total: 0 };
      existing.count += 1;
      existing.total += amount;
      seriesRevenueMap.set(sId, existing);
    }

    const seriesBreakdown = Array.from(seriesRevenueMap.values()).sort((a, b) => b.total - a.total);

    res.status(200).json({
      totalRevenue,
      totalSalesCount: purchases.length,
      coachingRevenue,
      outsiderRevenue,
      seriesBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to calculate revenue summary", error });
  }
};
