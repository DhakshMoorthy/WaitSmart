import { post } from "../api.js";
import { setTokens, setUser } from "../auth.js";
import { navigate, replace, getParams } from "../router.js";

export function renderVerify(root) {
  const { phone, devOtp } = getParams();

  root.innerHTML = `
    <div class="auth-page">
      <div class="text-center mb-24">
        <h2>Verify OTP</h2>
        <p class="text-muted mt-8">
          Enter the 6-digit code sent to<br>
          <strong>${phone}</strong>
        </p>
      </div>

      ${devOtp ? `
        <div class="alert alert-dev mb-24">
          <div>Dev mode — no SMS. Your OTP:</div>
          <div class="otp-display">${devOtp}</div>
        </div>
      ` : ""}

      <div class="otp-container" id="otp-container">
        ${Array(6).fill(0).map((_, i) => `<input type="text" inputmode="numeric" maxlength="1" class="otp-input" data-idx="${i}">`).join("")}
      </div>

      <p class="error-text text-center" id="verify-error" style="display:none"></p>

      <button class="btn btn-primary btn-lg mt-16" id="verify-btn" disabled>
        Verify
      </button>

      <p class="text-center mt-20">
        <button class="btn btn-ghost btn-sm" id="resend-btn" disabled>
          Resend in <span id="countdown">30</span>s
        </button>
      </p>
    </div>
  `;

  const inputs = root.querySelectorAll(".otp-input");
  const verifyBtn = root.querySelector("#verify-btn");
  const errorEl = root.querySelector("#verify-error");
  const resendBtn = root.querySelector("#resend-btn");
  const countdownEl = root.querySelector("#countdown");
  let countdown = 30;

  const timer = setInterval(() => {
    countdown--;
    countdownEl.textContent = countdown;
    if (countdown <= 0) {
      clearInterval(timer);
      resendBtn.disabled = false;
      resendBtn.innerHTML = "Resend OTP";
    }
  }, 1000);

  function getOtp() {
    return Array.from(inputs).map((i) => i.value).join("");
  }

  function checkComplete() {
    const otp = getOtp();
    verifyBtn.disabled = otp.length < 6;
    if (otp.length === 6) doVerify(otp);
  }

  inputs.forEach((input, idx) => {
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/\D/g, "");
      e.target.value = val.slice(-1);
      if (val && idx < 5) inputs[idx + 1].focus();
      e.target.classList.toggle("filled", !!val);
      checkComplete();
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace" && !input.value && idx > 0) {
        inputs[idx - 1].focus();
        inputs[idx - 1].value = "";
        inputs[idx - 1].classList.remove("filled");
      }
    });

    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const paste = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
      paste.split("").forEach((char, i) => {
        if (inputs[i]) {
          inputs[i].value = char;
          inputs[i].classList.add("filled");
        }
      });
      if (paste.length > 0) inputs[Math.min(paste.length, 5)].focus();
      checkComplete();
    });
  });

  inputs[0].focus();

  async function doVerify(otp) {
    errorEl.style.display = "none";
    verifyBtn.disabled = true;
    verifyBtn.textContent = "Verifying...";

    try {
      const data = await post("/auth/otp/verify", { phone, otp });
      const { accessToken, refreshToken, user } = data;
      setTokens(accessToken, refreshToken);
      setUser({
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone || phone,
        role: user.role,
        tenantId: user.tenantId || null,
        doctorId: user.doctorId || null,
      });

      if (user.role === "doctor") {
        replace("/doctor/queue");
      } else {
        replace("/home");
      }
    } catch (err) {
      errorEl.textContent = err.message || "Invalid OTP";
      errorEl.style.display = "block";
      inputs.forEach((i) => { i.value = ""; i.classList.remove("filled"); });
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
        const devBanner = root.querySelector(".alert-dev");
        if (devBanner) {
          devBanner.querySelector(".otp-display").textContent = data.devOtp;
        }
      }
      inputs.forEach((i) => { i.value = ""; i.classList.remove("filled"); });
      countdown = 30;
      countdownEl.textContent = "30";
      resendBtn.disabled = true;
      resendBtn.innerHTML = `Resend in <span id="countdown">30</span>s`;
    } catch {
      errorEl.textContent = "Failed to resend OTP";
      errorEl.style.display = "block";
    }
  });
}
