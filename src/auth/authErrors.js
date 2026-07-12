const DISMISSED_POPUP_CODES = [
  "auth/popup-closed-by-user",
  "auth/cancelled-popup-request",
  "auth/user-cancelled",
];

export function isDismissedPopupError(err) {
  return DISMISSED_POPUP_CODES.includes(err?.code);
}
