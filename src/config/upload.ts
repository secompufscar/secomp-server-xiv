import multer from "multer";
import { httpConfig } from "./http";

const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export const activityImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: httpConfig.uploadMaxBytes,
    files: 1,
    fields: 10,
    fieldSize: 100_000,
  },
  fileFilter: (_request, file, callback) => {
    if (!acceptedImageTypes.has(file.mimetype.toLowerCase())) {
      return callback(new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname));
    }
    callback(null, true);
  },
});
