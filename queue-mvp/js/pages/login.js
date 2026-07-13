import { post, wakeApi } from "../api.js";
import { navigate } from "../router.js";
import { renderShell } from "../layout.js";

export function renderLogin(root) {
  // Start API wake during phone entry — Render free tier spins down when idle.
  wakeApi();

  renderShell(root, {
    showHeader: false,
    content: `
      <div class="auth-page">
        <div class="auth-hero">
          <span class="hero-badge">WaitSmart</span>
          <h1 class="auth-title">Sign in to continue</h1>
          <p class="auth-sub">Enter your phone number to get a one-time code.</p>
        </div>
        <div class="page-content">
          <div class="login-card auth-card">
            <form id="login-form" class="login-form">
              <div class="form-group">
                <label class="field-label" for="phone">PHONE NUMBER</label>
                <div class="phone-row">
                  <span class="phone-prefix">+91</span>
                  <input type="tel" id="phone" class="input" placeholder="9876543210" maxlength="10" autocomplete="tel" required />
                </div>
              </div>
              <p class="error-msg" id="error-msg" style="display:none;"></p>
              <button type="submit" class="btn btn-primary btn-lg btn-block" id="send-btn" disabled>Send OTP</button>
            </form>
          </div>
        </div>
      </div>
    `,
  });

  const phoneInput = root.querySelector("#phone");
  const sendBtn = root.querySelector("#send-btn");
  const errorEl = root.querySelector("#error-msg");
  const form = root.querySelector("#login-form");

  phoneInput.addEventListener("input", () => {
    const val = phoneInput.value.replace(/\D/g, "");
    phoneInput.value = val;
    sendBtn.disabled = val.length < 10;
    errorEl.style.display = "none";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const cleaned = phoneInput.value.replace(/\s/g, "");
    if (cleaned.length < 10) {
      errorEl.textContent = "Enter a valid 10-digit number";
      errorEl.style.display = "block";
      return;
    }

    const fullPhone = `+91${cleaned}`;
    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";

    try {
      const data = await post("/auth/otp/send", { phone: fullPhone });
      navigate("/verify", { phone: fullPhone, devOtp: data.devOtp || "" });
    } catch (err) {
      errorEl.textContent = err.message || "Failed to send OTP";
      errorEl.style.display = "block";
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send OTP";
    }
  });

  phoneInput.focus();
}
