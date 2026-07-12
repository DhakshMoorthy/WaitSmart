import { post } from "../api.js";
import { setTokens, setUser } from "../auth.js";
import { navigate, replace, getParams } from "../router.js";
import { renderShell, escapeHtml } from "../layout.js";

export function renderVerify(root) {
  const { phone, devOtp } = getParams();

  if (!phone) {
    replace("/login");
    return;
  }

  renderShell(root, {
    showBack: true,
    showAdminLink: false,
    content: `
      <div class="page-content auth-page">
        <div class="auth-hero compact">
          <h1 class="auth-title">Verify OTP</h1>
          <p class="auth-sub">Code sent to <strong>${escapeHtml(phone)}</strong></p>
        </div>

        ${devOtp ? `
          <div class="alert alert-info mb-16">
            <div>Dev mode — your OTP:</div>
            <div class="otp-dev-display">${escapeHtml(devOtp)}</div>
          </div>
        ` : ""}

        <div class="otp-row" id="otp-row">
          ${Array(6).fill(0).map((_, i) => `<input type="text" inputmode="numeric" maxlength="1" class="otp-cell" data-idx="${i}" />`).join("")}
        </div>

        <p class="error-msg text-center" id="error-msg" style="display:none;"></p>

        <button class="btn btn-primary btn-lg btn-block mt-16" id="verify-btn" disabled>Verify</button>

        <p class="text-center mt-16">
          <button class="btn btn-ghost btn-sm" id="resend-btn" disabled>
            Resend in <span id="countdown">30</span>s
          </button>
        </p>
      </div>
    `,
  });

  const inputs = root.querySelectorAll(".otp-cell");
  const verifyBtn = root.querySelector("#verify-btn");
  const errorEl = root.querySelector("#error-msg");
  const resendBtn = root.querySelector("#resend-btn");
  const countdownEl = root.querySelector("#countdown");
  let countdown = 30;

  const timer = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(timer);
      resendBtn.disabled = false;
      resendBtn.textContent = "Resend OTP";
    }
  }, 1000);

  function getOtp() {
    return Array.from(inputs).map((i) => i.value).join("");
  }

  function checkComplete() {
    verifyBtn.disabled = getOtp().length < 6;
  }

  inputs.forEach((input, idx) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val.slice(-1);
      if (val && idx < 5) inputs[idx + 1].focus();
      checkComplete();
      if (getOtp().length === 6) doVerify(getOtp());
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = "";
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const paste = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      paste.split("").forEach((char, i) => {
        if (inputs[i]) inputs[i].value = char;
      });
      if (paste.length > 0) inputs[Math.min(paste.length, 5)].focus();
      checkComplete();
      if (paste.length === 6) doVerify(paste);
    });
  });

  inputs[0].focus();

  async function doVerify(otp) {
    errorEl.style.display = "none";
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying…";

    try {
      const data = await post("/auth/otp/verify", { phone, otp });
      setTokens(data.accessToken, data.refreshToken);
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        phone: data.user.phone || phone,
        role: data.user.role,
        tenantId: data.user.tenantId || null,
        doctorId: data.user.doctorId || null,
      });

      if (data.user.role === "doctor") {
        replace("/admin");
      } else {
        replace("/");
      }
    } catch (err) {
      errorEl.textContent = err.message || "Invalid OTP";
      errorEl.style.display = "block";
      inputs.forEach((i) => { i.value = ""; });
      inputs[0].focus();
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "Verify";
    }
  }

  verifyBtn.addEventListener("click", () => {
    const otp = getOtp();
    if (otp.length === 6) doVerify(otp);
  });

  resendBtn.addEventListener("click", async () => {
    try {
      const data = await post("/auth/otp/send", { phone });
      if (data.devOtp) {
        const banner = root.querySelector(".alert-info");
        if (banner) {
          const display = banner.querySelector(".otp-dev-display");
          if (display) display.textContent = data.devOtp;
        }
      }
      inputs.forEach((i) => { i.value = ""; });
      countdown = 30;
      resendBtn.disabled = true;
      resendBtn.innerHTML = `Resend in <span id="countdown">30</span>s`;
    } catch {
      errorEl.textContent = "Failed to resend OTP";
      errorEl.style.display = "block";
    }
  });
}
