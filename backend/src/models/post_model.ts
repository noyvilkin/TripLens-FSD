import mongoose, { Schema, Document, Types } from "mongoose";

export interface IPost extends Document {
    title: string;
    content: string; 
    image?: string;  
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
    image: { 
        type: String, 
        required: false // Optional, or true if every trip must have a photo
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