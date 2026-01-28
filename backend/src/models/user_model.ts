import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    profilePic?: string;
    refreshToken: string[];
}

const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    password: {
        type: String,
        required: false
    },
    profilePic: {
        type: String,
        default: "" // TODO: Path to the file stored locally on your server
    },
    refreshToken: {
        type: [String],
        default: []
    }
}, { versionKey: false });

export default mongoose.model<IUser>("Users", userSchema);