import { register, navigate, replace, init, getCurrentPage } from "./router.js";
import { hydrate, getAuth, subscribe } from "./auth.js";

import { renderLogin } from "./pages/login.js";
import { renderVerify } from "./pages/verify.js";
import { renderHome } from "./pages/home.js";
import { renderClinics } from "./pages/clinics.js";
import { renderDoctors } from "./pages/doctors.js";
import { renderSlots } from "./pages/slots.js";
import { renderBookConfirm } from "./pages/book-confirm.js";
import { renderTicket } from "./pages/ticket.js";
import { renderBookings } from "./pages/bookings.js";
import { renderProfile } from "./pages/profile.js";
import { renderDoctorQueue } from "./pages/doctor-queue.js";
import { renderDoctorSchedule } from "./pages/doctor-schedule.js";

// Register all routes
register("/login", renderLogin);
register("/verify", renderVerify);
register("/home", renderHome);
register("/clinics", renderClinics);
register("/doctors", renderDoctors);
register("/slots", renderSlots);
register("/book-confirm", renderBookConfirm);
register("/ticket", renderTicket);
register("/bookings", renderBookings);
register("/profile", renderProfile);
register("/doctor/queue", renderDoctorQueue);
register("/doctor/schedule", renderDoctorSchedule);

// Boot
hydrate();
init();

const auth = getAuth();
if (!auth.isAuthenticated) {
  if (!getCurrentPage()) replace("/login");
} else {
  if (!getCurrentPage()) {
    if (auth.user?.role === "doctor") {
      replace("/doctor/queue");
    } else {
      replace("/home");
    }
  }
}
