import { Router } from "express";

import usersRoutes from "./users";
import activitiesRoutes from "./activities";
import adminRoutes from "./admin";
import usersAtActivitiesRoutes from "./usersAtActivities";
import categoriesRoutes from "./categories";
import activityImageRoutes from "./activityImage"
import checkInRoutes from "./checkIn"
import notificationsRoutes from "./notifications"
import eventRoutes from "./event";
import userEventRoutes from "./userEvent";
import sponsorRoutes from "./sponsor";
import tagRoutes from "./tag";
import appVersionRoutes from "./appVersion";
import appVersionMiddleware from "../middlewares/appVersionMiddleware";

const routes = Router()

routes.use(appVersionMiddleware);
routes.use('/app', appVersionRoutes);
routes.use('/activities', activitiesRoutes);
routes.use("/activityImages",activityImageRoutes);
routes.use('/users', usersRoutes);
routes.use('/categories', categoriesRoutes);
routes.use('/userAtActivities', usersAtActivitiesRoutes);
routes.use('/notifications', notificationsRoutes);
routes.use('/admin', adminRoutes);
routes.use("/checkIn", checkInRoutes);
routes.use("/event", eventRoutes);
routes.use("/userEvent", userEventRoutes);
routes.use("/sponsors", sponsorRoutes);
routes.use("/tags", tagRoutes);

export default routes;
