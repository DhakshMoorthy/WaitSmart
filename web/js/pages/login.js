import { post, wakeApi } from "../api.js";
import { navigate } from "../router.js";

export function renderLogin(root) {
  // Start API wake during phone entry — Render free tier spins down when idle.
  wakeApi();

  root.innerHTML = `
    <div class="auth-page">
      <div class="auth-logo">
        <h1>WaitSmart</h1>
        <p>Skip the wait, not the care</p>
      </div>

      <div>
        <h2>Welcome</h2>
        <p class="text-muted mt-4 mb-24">Enter your phone number to get started</p>

        <div class="form-group">
          <label>Phone Number</label>
          <div class="input-with-prefix">
            <span class="input-prefix">+91</span>
            <input type="tel" id="phone-input" placeholder="9876543210" maxlength="10" autocomplete="tel">
          </div>
          <p class="error-text" id="phone-error" style="display:none"></p>
        </div>

        <button class="btn btn-primary btn-lg" id="send-otp-btn" disabled>
          Send OTP
        </button>

        <p class="text-xs text-muted text-center mt-20">
          By continuing, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  `;

  const phoneInput = root.querySelector("#phone-input");
  const btn = root.querySelector("#send-otp-btn");
  const errorEl = root.querySelector("#phone-error");

  phoneInput.addEventListener("input", () => {
    const val = phoneInput.value.replace(/\D/g, "");
    phoneInput.value = val;
    btn.disabled = val.length < 10;
    errorEl.style.display = "none";
  });

  btn.addEventListener("click", async () => {
    const cleaned = phoneInput.value.replace(/\s/g, "");
    if (cleaned.length < 10) {
      errorEl.textContent = "Enter a valid 10-digit number";
      errorEl.style.display = "block";
      return;
    }

    const fullPhone = cleaned.startsWith("+91") ? cleaned : `+91${cleaned}`;
    btn.disabled = true;
    btn.textContent = "Sending...";

    try {
      const data = await post("/auth/otp/send", { phone: fullPhone });
      navigate("/verify", { phone: fullPhone, devOtp: data.devOtp || "" });
    } catch (err) {
      errorEl.textContent = err.message || "Failed to send OTP";
      errorEl.style.display = "block";
    } finally {
      btn.disabled = false;
      btn.textContent = "Send OTP";
    }
  });

  phoneInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !btn.disabled) btn.click();
  });

  phoneInput.focus();
}
