import { Router } from "express";
import { authMiddleware } from "../middlewares/authMiddleware";
import { adminMiddleware } from "../middlewares/adminMiddleware";
import activityImageController from "../controllers/activityImageController";
import { activityImageUpload } from "../config/upload";

const routes = Router();

routes.get('/list', activityImageController.list);
routes.get('/activityId/:activityId', activityImageController.findByActivityId);
routes.get('/:id', activityImageController.findById);
routes.put('/:id', authMiddleware, adminMiddleware, activityImageUpload.single("image"), activityImageController.updateById);
routes.post('/', authMiddleware, adminMiddleware, activityImageUpload.single("image"), activityImageController.create);
routes.delete('/:id', authMiddleware, adminMiddleware, activityImageController.delete);

export default routes;
