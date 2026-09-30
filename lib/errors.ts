interface CodedError {
  code: string;
  message: string;
}

function hasCode(err: unknown): err is CodedError {
  return typeof err === "object" && err !== null && typeof (err as CodedError).code === "string";
}

const MESSAGES: Record<string, string> = {
  "permission-denied": "You don't have permission to do that.",
  "not-found": "The record was not found.",
  unavailable: "The service is unavailable. Check your connection and try again.",
  "failed-precondition": "A database index is still building or missing. Try again in a few minutes.",
  "auth/invalid-credential": "Incorrect email or password.",
  "auth/wrong-password": "Incorrect email or password.",
  "auth/user-not-found": "Incorrect email or password.",
  "auth/invalid-email": "Enter a valid email address.",
  "auth/too-many-requests": "Too many attempts. Wait a few minutes and try again.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/weak-password": "The password is too weak (minimum 8 characters).",
  "auth/network-request-failed": "Network error. Check your connection and try again.",
};

/** User-facing message for Firebase and generic errors. */
export function friendlyError(err: unknown): string {
  if (hasCode(err)) {
    return MESSAGES[err.code] ?? err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
