import nodemailer from "nodemailer";

export const sendEmailOtp = async (email: string, otp: string): Promise<boolean> => {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const fromName = process.env.SMTP_FROM_NAME || "The Speed Education";
  const fromEmail = process.env.SMTP_FROM || user || "no-reply@speededucation.in";
  const from = `"${fromName}" <${fromEmail}>`;

  console.log(`[OTP SERVICE] Preparing Email OTP for ${email}: ${otp}`);

  if (!user || !pass) {
    console.warn(
      `[OTP SERVICE] SMTP credentials (SMTP_USER / SMTP_PASS) not set in .env. OTP printed to console: ${otp}`
    );
    return true;
  }

  try {
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });

    await transporter.sendMail({
      from,
      to: email,
      subject: `Your Verification Code for Speed Education - ${otp}`,
      text: `Your 6-digit OTP code for Speed Education verification is: ${otp}. This code is valid for 10 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px; background-color: #fafafa;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h2 style="color: #0A192F; margin: 0;">The Speed Education</h2>
            <p style="color: #666; font-size: 14px;">Verification Code</p>
          </div>
          <div style="background-color: #ffffff; padding: 20px; border-radius: 6px; text-align: center;">
            <p style="font-size: 15px; color: #333;">Use the following 6-digit OTP to complete your signup process:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #0A192F; margin: 20px 0; padding: 12px; background-color: #F1F5F9; border-radius: 6px;">
              ${otp}
            </div>
            <p style="font-size: 12px; color: #888;">This OTP is valid for 10 minutes. Please do not share it with anyone.</p>
          </div>
        </div>
      `,
    });
    console.log(`[OTP SERVICE] Email successfully sent to ${email}`);
    return true;
  } catch (err) {
    console.error(`[OTP SERVICE] Failed to send email via SMTP:`, err);
    console.log(`[OTP FALLBACK] Development fallback OTP for ${email}: ${otp}`);
    return true;
  }
};

export const sendSmsOtp = async (mobile: string, otp: string): Promise<boolean> => {
  const apiKey = process.env.SMS_API_KEY || "DUMMY_SMS_API_KEY";
  const senderId = process.env.SMS_SENDER_ID || "SPEEDE";
  const apiUrl = process.env.SMS_API_URL || "https://api.msg91.com/api/v5/otp";

  console.log(`[OTP SERVICE] Preparing SMS OTP for ${mobile}: ${otp}`);

  if (!process.env.SMS_API_KEY || process.env.SMS_API_KEY.includes("DUMMY")) {
    console.log(
      `[OTP SERVICE] SMS Gateway configured with dummy credentials (Key: ${apiKey}, Sender: ${senderId}). OTP printed to console: ${otp}`
    );
    return true;
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authkey: apiKey,
      },
      body: JSON.stringify({
        template_id: process.env.SMS_TEMPLATE_ID || "",
        mobile: `91${mobile}`,
        otp,
      }),
    });
    console.log(`[OTP SERVICE] SMS request sent to ${mobile}, response status: ${response.status}`);
    return true;
  } catch (err) {
    console.error(`[OTP SERVICE] Failed to send SMS:`, err);
    console.log(`[OTP FALLBACK] Development fallback OTP for ${mobile}: ${otp}`);
    return true;
  }
};
