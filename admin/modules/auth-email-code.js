/**
 * Kinésica Admin - Flujo de Acceso por Código de 6 Dígitos al Mail
 * Permite solicitar, verificar y reenviar códigos de un solo uso por correo electrónico.
 */

import { api } from "./api.js?v=77";
import { setGateMessage } from "./auth-utils.js";

export function setupEmailCodeFlow({
  loginForm,
  emailCodeForm,
  emailCodeStepRequest,
  emailCodeStepVerify,
  emailCodeRequestError,
  emailCodeVerifyError,
  emailCodeSentNote,
  loginCodeSentNote,
  loginErrorEl,
  btnLoginSendEmailCode,
  btnSendEmailCode,
  btnVerifyEmailCode,
  btnResendEmailCode,
  onSuccess,
  onUserAuthed,
  hideGate,
}) {
  if (btnLoginSendEmailCode) {
    btnLoginSendEmailCode.addEventListener("click", async () => {
      const username = loginForm?.elements?.username?.value?.trim() || "";
      if (!username) {
        setGateMessage(loginErrorEl, "Ingresá tu usuario arriba para enviarte el código.", false);
        loginForm?.elements?.username?.focus();
        return;
      }
      if (loginErrorEl) loginErrorEl.hidden = true;
      btnLoginSendEmailCode.disabled = true;
      btnLoginSendEmailCode.textContent = "Enviando código...";
      try {
        const data = await api("login-code.php", {
          method: "POST",
          body: JSON.stringify({ action: "send", username }),
        });
        if (loginCodeSentNote) {
          setGateMessage(
            loginCodeSentNote,
            data.message || `Código enviado a ${data.emailMasked || "tu correo"}. Ingresalo arriba y tocá Entrar.`,
            true
          );
        }
        btnLoginSendEmailCode.textContent = "Reenviar código al mail";
        const codeInput = loginForm?.elements?.code;
        if (codeInput) {
          codeInput.value = "";
          codeInput.focus();
        }
      } catch (err) {
        setGateMessage(loginErrorEl, err.message, false);
        btnLoginSendEmailCode.textContent = "¿No tenés la app? Enviame un código al mail";
      } finally {
        btnLoginSendEmailCode.disabled = false;
      }
    });
  }

  const handleSendEmailCode = async () => {
    if (!emailCodeForm) return;
    const username = emailCodeForm.elements.username?.value?.trim() || "";
    if (!username) {
      setGateMessage(emailCodeRequestError, "Ingresá tu usuario o correo.", false);
      return;
    }
    if (emailCodeRequestError) emailCodeRequestError.hidden = true;
    if (btnSendEmailCode) {
      btnSendEmailCode.disabled = true;
      btnSendEmailCode.textContent = "Enviando código...";
    }
    try {
      const data = await api("login-code.php", {
        method: "POST",
        body: JSON.stringify({ action: "send", username }),
      });
      emailCodeForm.dataset.user = data.username || username;
      if (emailCodeStepRequest) emailCodeStepRequest.hidden = true;
      if (emailCodeStepVerify) emailCodeStepVerify.hidden = false;
      if (emailCodeSentNote) {
        setGateMessage(
          emailCodeSentNote,
          data.message || `Código enviado a ${data.emailMasked || "tu correo"}.`,
          true
        );
      }
      if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
      const codeInput = emailCodeForm.elements.code;
      if (codeInput) {
        codeInput.value = "";
        codeInput.focus();
      }
    } catch (err) {
      setGateMessage(emailCodeRequestError, err.message, false);
    } finally {
      if (btnSendEmailCode) {
        btnSendEmailCode.disabled = false;
        btnSendEmailCode.textContent = "Enviar código al mail";
      }
    }
  };

  const handleVerifyEmailCode = async () => {
    if (!emailCodeForm) return;
    const username = emailCodeForm.dataset.user || emailCodeForm.elements.username?.value?.trim() || "";
    const password = emailCodeForm.elements.email_code_password?.value || "";
    const code = emailCodeForm.elements.code?.value?.trim() || "";
    if (!password) {
      setGateMessage(emailCodeVerifyError, "Ingresá tu contraseña.", false);
      emailCodeForm.elements.email_code_password?.focus();
      return;
    }
    if (!code || code.length < 6) {
      setGateMessage(emailCodeVerifyError, "Ingresá los 6 dígitos del código.", false);
      emailCodeForm.elements.code?.focus();
      return;
    }
    if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
    if (btnVerifyEmailCode) {
      btnVerifyEmailCode.disabled = true;
      btnVerifyEmailCode.textContent = "Verificando...";
    }
    try {
      const data = await api("login-code.php", {
        method: "POST",
        body: JSON.stringify({ action: "verify", username, password, code }),
      });
      onUserAuthed({ username: data.username || username, name: data.name, role: data.role });
      hideGate();
      if (typeof onSuccess === "function") await onSuccess();
    } catch (err) {
      if (err.auth) return;
      setGateMessage(emailCodeVerifyError, err.message, false);
    } finally {
      if (btnVerifyEmailCode) {
        btnVerifyEmailCode.disabled = false;
        btnVerifyEmailCode.textContent = "Confirmar y entrar";
      }
    }
  };

  btnSendEmailCode?.addEventListener("click", (e) => {
    e.preventDefault();
    handleSendEmailCode();
  });

  btnVerifyEmailCode?.addEventListener("click", (e) => {
    e.preventDefault();
    handleVerifyEmailCode();
  });

  btnResendEmailCode?.addEventListener("click", async (e) => {
    e.preventDefault();
    const username = emailCodeForm?.dataset?.user || emailCodeForm?.elements?.username?.value?.trim() || "";
    if (!username) return;
    btnResendEmailCode.disabled = true;
    btnResendEmailCode.textContent = "Reenviando...";
    try {
      const data = await api("login-code.php", {
        method: "POST",
        body: JSON.stringify({ action: "send", username }),
      });
      setGateMessage(emailCodeSentNote, `Nuevo código enviado a ${data.emailMasked || "tu correo"}.`, true);
      if (emailCodeVerifyError) emailCodeVerifyError.hidden = true;
      const codeInput = emailCodeForm?.elements?.code;
      if (codeInput) {
        codeInput.value = "";
        codeInput.focus();
      }
    } catch (err) {
      setGateMessage(emailCodeVerifyError, err.message, false);
    } finally {
      btnResendEmailCode.disabled = false;
      btnResendEmailCode.textContent = "Reenviar código";
    }
  });

  emailCodeForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    if (emailCodeStepVerify && !emailCodeStepVerify.hidden) {
      handleVerifyEmailCode();
    } else {
      handleSendEmailCode();
    }
  });
}
