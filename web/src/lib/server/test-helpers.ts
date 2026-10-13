import { requestOtp, verifyOtp } from "./auth";

/** Signs up a new student through the real OTP flow. */
export function signUpStudent(phone: string, name = "Test Student") {
  const { challengeId } = requestOtp(phone);
  return verifyOtp(challengeId, "123456", name).user;
}
