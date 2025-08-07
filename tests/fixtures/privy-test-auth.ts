// Legacy Privy Test Authentication Helper
// This file is maintained for backwards compatibility
// Use TestHelper from ../helpers/test-utils.ts for new tests

export interface PrivyTestAccount {
  email: string;
  phone: string;
  otp: string;
}

export const getPrivyTestAccount = (): PrivyTestAccount => {
  const email = process.env.PRIVY_TEST_EMAIL || "test-5929@privy.io";
  const phone = process.env.PRIVY_TEST_PHONE || "+1 555 555 3487";
  const otp = process.env.PRIVY_TEST_OTP || "123456";

  if (!process.env.PRIVY_TEST_EMAIL) {
    console.warn("⚠️ PRIVY_TEST_EMAIL not set, using default test email");
  }

  if (!process.env.PRIVY_TEST_OTP) {
    console.warn("⚠️ PRIVY_TEST_OTP not set, using default OTP");
  }

  return { email, phone, otp };
};

export const validateTestAccountSetup = (): boolean => {
  const account = getPrivyTestAccount();

  const isValid =
    account.email.includes("@privy.io") &&
    account.phone.startsWith("+1 555") &&
    account.otp.length >= 6;

  if (!isValid) {
    console.error("❌ Invalid Privy test account configuration");
    console.log("Expected format:");
    console.log("  PRIVY_TEST_EMAIL: test-XXXX@privy.io");
    console.log("  PRIVY_TEST_PHONE: +1 555 555 XXXX");
    console.log("  PRIVY_TEST_OTP: XXXXXX");
  }

  return isValid;
};
