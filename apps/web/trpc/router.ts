import { createCallerFactory, router } from "./init";
import { appointmentsRouter } from "./routers/appointments";
import { bookingRouter } from "./routers/booking";
import { meRouter } from "./routers/me";
import { scheduleRouter } from "./routers/schedule";

export const appRouter = router({
  booking: bookingRouter,
  appointments: appointmentsRouter,
  me: meRouter,
  schedule: scheduleRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
