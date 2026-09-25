import crypto from "crypto";
import { Response } from "express";
import ContentPurchase, { ContentItemType } from "../models/contentPurchase.model";
import ContentOrder from "../models/contentOrder.model";
import Pyq from "../models/pyq.model";
import Ebook from "../models/ebook.model";
import User from "../models/user.model";
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

const loadItem = (itemType: ContentItemType, itemId: string) =>
  itemType === "pyq" ? Pyq.findById(itemId) : Ebook.findById(itemId);

const purchasedIdsField = (itemType: ContentItemType): "purchasedPyqIds" | "purchasedEbookIds" =>
  itemType === "pyq" ? "purchasedPyqIds" : "purchasedEbookIds";

const itemNotFoundMessage = (itemType: ContentItemType) =>
  itemType === "pyq" ? "PYQ paper not found" : "E-book not found";

export const createContentOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const { itemType, itemId } = req.body as { itemType?: ContentItemType; itemId?: string };

    if (!itemType || (itemType !== "pyq" && itemType !== "ebook") || !itemId) {
      res.status(400).json({ message: "itemType and itemId are required" });
      return;
    }

    const item = await loadItem(itemType, itemId);
    if (!item) {
      res.status(404).json({ message: itemNotFoundMessage(itemType) });
      return;
    }

    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    const field = purchasedIdsField(itemType);
    const alreadyPurchased = (user[field] || []).some((id) => String(id) === String(itemId));
    if (alreadyPurchased) {
      res.status(400).json({ message: "You already own this item" });
      return;
    }

    const isCoaching = !!user.isCoachingStudent;
    const isPaidItem = item.accessType === "paid";
    const amount = !isPaidItem
      ? 0
      : isCoaching
      ? item.coachingPrice > 0
        ? item.coachingPrice
        : item.price
      : item.price;

    if (isPaidItem && amount <= 0) {
      res
        .status(400)
        .json({ message: "This item has no price configured. Please contact support." });
      return;
    }

    const amountInPaise = Math.round(amount * 100);
    const keyId = getRazorpayKeyId();

    if (!isPaidItem || !keyId) {
      const dummyOrder = await ContentOrder.create({
        user: userId,
        itemType,
        itemId: item._id,
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
        title: item.title,
        itemType,
        itemId,
      });
      return;
    }

    const razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `rcpt_${Date.now()}`,
      notes: { itemType, itemId: String(item._id), userId },
    });

    await ContentOrder.create({
      user: userId,
      itemType,
      itemId: item._id,
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
      title: item.title,
      itemType,
      itemId,
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to create Razorpay order", error });
  }
};

export const verifyContentPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      itemType,
      itemId,
    } = req.body as {
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
      itemType?: ContentItemType;
      itemId?: string;
    };

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ message: "Missing Razorpay verification details" });
      return;
    }

    const order = await ContentOrder.findOne({ razorpayOrderId: razorpay_order_id, user: userId });
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

    const targetItemType = itemType || order.itemType;
    const targetItemId = itemId || String(order.itemId);
    const user = await User.findById(userId);
    const item = await loadItem(targetItemType, targetItemId);

    if (user && item) {
      const isCoaching = !!user.isCoachingStudent;
      const amountPaid = order.amount;

      await ContentPurchase.findOneAndUpdate(
        { user: userId, itemType: targetItemType, itemId: targetItemId, status: "success" },
        {
          $setOnInsert: {
            user: userId,
            itemType: targetItemType,
            itemId: targetItemId,
            amountPaid,
            isCoachingStudent: isCoaching,
            paymentId: razorpay_payment_id,
            status: "success",
            createdAt: new Date(),
          },
        },
        { upsert: true, new: true }
      );

      const field = purchasedIdsField(targetItemType);
      if (!user[field]) user[field] = [];
      if (!user[field].some((id) => String(id) === String(targetItemId))) {
        user[field].push(item._id as any);
        await user.save();
      }
    }

    res.status(200).json({ success: true, message: "Payment verified successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Failed to verify payment", error });
  }
};

export const getMyContentPurchases = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId as string;
    const purchases = await ContentPurchase.find({ user: userId, status: "success" });
    res.status(200).json({
      purchasedPyqIds: purchases.filter((p) => p.itemType === "pyq").map((p) => String(p.itemId)),
      purchasedEbookIds: purchases
        .filter((p) => p.itemType === "ebook")
        .map((p) => String(p.itemId)),
    });
  } catch (error) {
    res.status(500).json({ message: "Failed to load purchases", error });
  }
};
