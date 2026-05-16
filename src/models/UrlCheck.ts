import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { URL_CHECK_STATUSES } from "../shared/domain";

const urlCheckSchema = new Schema(
  {
    batchId: {
      type: Schema.Types.ObjectId,
      ref: "Batch",
      required: true,
      index: true,
    },
    url: { type: String, required: true },
    order: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: URL_CHECK_STATUSES,
      required: true,
      default: "queued",
      index: true,
    },
    statusCode: { type: Number, default: null },
    responseTimeMs: { type: Number, default: null },
    title: { type: String, default: null },
    error: { type: String, default: null },
    finishedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

urlCheckSchema.index({ batchId: 1, order: 1 });

export type UrlCheckDoc = InferSchemaType<typeof urlCheckSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type UrlCheckModel = Model<UrlCheckDoc>;

export const UrlCheck: UrlCheckModel =
  mongoose.models.UrlCheck ??
  mongoose.model<UrlCheckDoc>("UrlCheck", urlCheckSchema);
