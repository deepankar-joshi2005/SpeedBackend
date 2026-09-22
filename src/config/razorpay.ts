import Razorpay from "razorpay";

const getKeyId = (): string => process.env.RAZORPAY_KEY_ID || "";
const getKeySecret = (): string => process.env.RAZORPAY_KEY_SECRET || "";

let client: Razorpay | undefined;

function getClient(): Razorpay {
  if (!client) {
    const keyId = getKeyId();
    const keySecret = getKeySecret();
    if (!keyId || !keySecret) {
      console.warn(
        "[razorpay] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing in Backend/.env"
      );
    }
    client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return client;
}

export const razorpay = new Proxy({} as Razorpay, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});

export const getRazorpayKeyId = getKeyId;
export const getRazorpayKeySecret = getKeySecret;
