import { Schema, model, type InferSchemaType } from "mongoose";

// B-05 fix: Only one registration of "User" model (index.ts was re-registering it causing OverwriteModelError)
// B-06 fix: Field is named `passwordHash` to match auth.ts usage (was `password` in schema but `passwordHash` in code)
export const userSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    fullName: { type: String, required: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// Add displayName virtual here (moved from index.ts to avoid double model registration)
userSchema.virtual("displayName").get(function () {
  return this.fullName || this.email;
});

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: import("mongoose").Types.ObjectId };
export const User = model("User", userSchema);
