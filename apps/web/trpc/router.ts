import { createCallerFactory, router } from "./init";
import { adminRouter } from "./routers/admin";
import { appointmentsRouter } from "./routers/appointments";
import { bookingRouter } from "./routers/booking";
import { calendarRouter } from "./routers/calendar";
import { meRouter } from "./routers/me";
import { photosRouter } from "./routers/photos";
import { clientsRouter } from "./routers/clients";
import { scheduleRouter } from "./routers/schedule";
import { servicesRouter } from "./routers/services";
import { settingsRouter } from "./routers/settings";
import { teamRouter } from "./routers/team";
import { websiteRouter } from "./routers/website";

export const appRouter = router({
  booking: bookingRouter,
  appointments: appointmentsRouter,
  me: meRouter,
  schedule: scheduleRouter,
  settings: settingsRouter,
  services: servicesRouter,
  team: teamRouter,
  clients: clientsRouter,
  website: websiteRouter,
  calendar: calendarRouter,
  photos: photosRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
