/** Referencias DOM del gate de autenticación. */

const qs = (sel) => (typeof document !== "undefined" ? document.querySelector(sel) : null);

export const viewGate = qs("#view-gate");
export const loginForm = qs("#login-form");
export const enrollForm = qs("#enroll-form");
export const forgotForm = qs("#forgot-form");
export const resetForm = qs("#reset-form");
export const emailCodeForm = qs("#email-code-form");
export const logoutBtn = qs("#btn-logout");

export const enrollAccountEl = qs("#enroll-account");
export const enrollSecretEl = qs("#enroll-secret");

export const loginErrorEl = qs("#login-error");
export const loginCodeSentNote = qs("#login-code-sent-note");
export const btnLoginSendEmailCode = qs("#btn-login-send-email-code");
export const enrollErrorEl = qs("#enroll-error");
export const forgotErrorEl = qs("#forgot-error");
export const resetErrorEl = qs("#reset-error");
export const emailCodeRequestError = qs("#email-code-request-error");
export const emailCodeVerifyError = qs("#email-code-verify-error");
export const emailCodeSentNote = qs("#email-code-sent-note");

export const btnForgot = qs("#btn-forgot");
export const btnForgotBack = qs("#btn-forgot-back");
export const btnEmailCode = qs("#btn-email-code");
export const btnEmailCodeBack = qs("#btn-email-code-back");
export const btnSendEmailCode = qs("#btn-send-email-code");
export const btnVerifyEmailCode = qs("#btn-verify-email-code");
export const btnResendEmailCode = qs("#btn-resend-email-code");
export const emailCodeStepRequest = qs("#email-code-step-request");
export const emailCodeStepVerify = qs("#email-code-step-verify");
