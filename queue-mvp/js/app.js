import { register, init, navigate, replace } from "./router.js";
import { renderHome } from "./pages/home.js";
import { renderClinics } from "./pages/clinics.js";
import { renderDoctors } from "./pages/doctors.js";
import { renderBook } from "./pages/book.js";
import { renderToken } from "./pages/token.js";
import { renderAdmin } from "./pages/admin.js";

register("/", renderHome);
register("/clinics", renderClinics);
register("/doctors", renderDoctors);
register("/book", renderBook);
register("/token", renderToken);
register("/admin", renderAdmin);

init();

const hash = window.location.hash.slice(1);
if (!hash || hash === "/") {
  replace("/");
}
