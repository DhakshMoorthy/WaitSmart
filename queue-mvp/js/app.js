import { register, init } from "./router.js";
import { renderHome } from "./pages/home.js";
import { renderDoctors } from "./pages/doctors.js";
import { renderBook } from "./pages/book.js";
import { renderToken } from "./pages/token.js";
import { renderAdminLogin } from "./pages/admin-login.js";

register("/", renderHome);
register("/doctors", renderDoctors);
register("/book", renderBook);
register("/token", renderToken);
register("/admin", renderAdminLogin);

init();
