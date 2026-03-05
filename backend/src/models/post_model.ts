import mongoose, { Schema, Document, Types } from "mongoose";

export interface IComment {
    userId: string;
    username: string;
    text: string;
    createdAt: Date;
}

export interface IPost extends Document {
    title: string;
    content: string; 
    images: string[];
    userId: Types.ObjectId;
    vector?: number[];
    likes: string[];
    comments: IComment[];
}

const commentSchema = new Schema<IComment>({
    userId: { type: String, required: true },
    username: { type: String, required: true },
    text: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: false });

const postSchema = new Schema<IPost>({
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true
    },
    images: {
        type: [String],
        required: true,
        validate: {
            validator: (value: string[]) => Array.isArray(value) && value.length > 0,
            message: "At least one image is required"
        }
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    vector: { 
        type: [Number], 
        default: [] 
    },
    likes: {
        type: [String],
        default: []
    },
    comments: {
        type: [commentSchema],
        default: []
    }
}, { timestamps: true });

export default mongoose.model<IPost>("Posts", postSchema);