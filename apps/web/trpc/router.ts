import { createCallerFactory, router } from "./init";
import { appointmentsRouter } from "./routers/appointments";
import { bookingRouter } from "./routers/booking";
import { meRouter } from "./routers/me";

export const appRouter = router({
  booking: bookingRouter,
  appointments: appointmentsRouter,
  me: meRouter,
});

export type AppRouter = typeof appRouter;

export const createCaller = createCallerFactory(appRouter);
