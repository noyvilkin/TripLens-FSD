import mongoose, { Schema, Document } from "mongoose";

export interface IUser extends Document {
    username: string;
    email: string;
    password: string;
    profilePic?: string;
    refreshToken: string[];
    createdAt?: Date;
    updatedAt?: Date;
}

const userSchema = new Schema<IUser>({
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        minlength: 3,
        maxlength: 30
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
}, { versionKey: false, timestamps: true });

export default mongoose.model<IUser>("Users", userSchema);