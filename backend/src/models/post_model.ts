import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPost extends Document {
    title: string;
    content: string;
    userId: Types.ObjectId;
}

const postSchema = new Schema<IPost>({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    }
});

export default mongoose.model<IPost>("Posts", postSchema);
