/** Public, actionable messages only; never echo provider errors or credentials. */
export function customerAuthMessage(error: unknown): string {
  const code =
    error && typeof error === "object" && "code" in error
      ? error.code
      : undefined;
  switch (code) {
    case "AUTH_CONFIGURATION_MISSING":
      return "Customer sign-in is temporarily unavailable. Please contact GYVFT so we can restore access.";
    case "signup_disabled":
      return "New customer accounts are not enabled yet. Please contact GYVFT.";
    case "weak_password":
      return "Choose a stronger password with at least 12 characters.";
    case "invalid_credentials":
      return "We couldn’t sign you in. Check your email and password and try again.";
    case "email_not_confirmed":
      return "Please verify your email before signing in.";
    case "otp_expired":
      return "That verification code is invalid or has expired. Request a new code and try again.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Please wait a few minutes before trying again.";
    case "email_address_not_authorized":
      return "We couldn’t send your verification email. Please contact GYVFT.";
    default:
      return "We couldn’t complete that request. Please try again, or contact GYVFT if it continues.";
  }
}
