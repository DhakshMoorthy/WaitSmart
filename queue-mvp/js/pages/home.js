import { navigate } from "../router.js";
import { usingFirebase } from "../db.js";

export function renderHome(root) {
  root.innerHTML = `
    <div class="page hero-page">
      <div class="hero">
        <div class="hero-badge">Skip the wait</div>
        <h1>Book a token,<br>track your turn live.</h1>
        <p class="hero-sub">Real-time queue updates. No login, no hassle — just walk in when it's your turn.</p>
        <div class="hero-pills">
          <span class="pill">9 AM – 2 PM</span>
          <span class="pill">4 PM – 6 PM</span>
        </div>
      </div>

      <div class="page-content">
        <button class="btn btn-primary btn-lg btn-block" id="get-token-btn">
          Get Token Now
        </button>
        <button class="btn btn-outline btn-block mt-12" id="admin-btn">
          Doctor / Admin Dashboard
        </button>
        ${!usingFirebase ? `<p class="demo-note">Demo mode — data stored locally in your browser</p>` : ""}
      </div>
    </div>
  `;

  root.querySelector("#get-token-btn").addEventListener("click", () => navigate("/clinics"));
  root.querySelector("#admin-btn").addEventListener("click", () => navigate("/admin"));
}
