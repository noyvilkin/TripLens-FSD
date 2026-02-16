import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPost extends Document {
    title: string;
    content: string; 
    images: string[];
    userId: Types.ObjectId;
    vector?: number[]; 
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
    // The vector field stores the [0.12, -0.04...] numerical data from Gemini
    vector: { 
        type: [Number], 
        default: [] 
    }
}, { timestamps: true });

export default mongoose.model<IPost>("Posts", postSchema);