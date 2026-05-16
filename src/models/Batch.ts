import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { BATCH_STATUSES } from "../shared/domain";

const batchSchema = new Schema(
  {
    status: {
      type: String,
      enum: BATCH_STATUSES,
      required: true,
      default: "queued",
      index: true,
    },
    totalUrls: { type: Number, required: true, min: 0 },
    finishedCount: { type: Number, required: true, default: 0, min: 0 },
    completedOk: { type: Number, required: true, default: 0, min: 0 },
    failedCount: { type: Number, required: true, default: 0, min: 0 },
    cancelledCount: { type: Number, required: true, default: 0, min: 0 },
  },
  { timestamps: true },
);

export type BatchDoc = InferSchemaType<typeof batchSchema> & {
  _id: mongoose.Types.ObjectId;
};

export type BatchModel = Model<BatchDoc>;

export const Batch: BatchModel =
  mongoose.models.Batch ?? mongoose.model<BatchDoc>("Batch", batchSchema);
