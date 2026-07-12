import { register, init, getCurrentPath, replace, subscribe as routeSubscribe } from "./router.js";
import { hydrate, getAuth } from "./auth.js";
import { renderHome } from "./pages/home.js";
import { renderDoctors } from "./pages/doctors.js";
import { renderBook } from "./pages/book.js";
import { renderToken } from "./pages/token.js";
import { renderAdminLogin } from "./pages/admin-login.js";
import { renderLogin } from "./pages/login.js";
import { renderVerify } from "./pages/verify.js";

const PUBLIC_PATHS = ["/login", "/verify", "/admin"];

function guardRoute(path) {
  const { isAuthenticated, isLoading } = getAuth();
  if (isLoading) return;
  if (!isAuthenticated && !PUBLIC_PATHS.includes(path)) {
    replace("/login");
  }
}

hydrate();

register("/login", renderLogin);
register("/verify", renderVerify);
register("/", renderHome);
register("/doctors", renderDoctors);
register("/book", renderBook);
register("/token", renderToken);
register("/admin", renderAdminLogin);

routeSubscribe(guardRoute);
guardRoute(getCurrentPath());

init();
