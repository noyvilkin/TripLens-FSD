import mongoose, { Schema, Document } from "mongoose";

export const DEFAULT_PROFILE_PIC = "data:image/svg+xml;utf8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%20200%20200%22%3E%0A%20%20%20%20%20%20%3Cdefs%3E%0A%20%20%20%20%20%20%20%20%3ClinearGradient%20id%3D%22g%22%20x1%3D%220%22%20y1%3D%220%22%20x2%3D%221%22%20y2%3D%221%22%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cstop%20offset%3D%220%25%22%20stop-color%3D%22%23667eea%22%2F%3E%0A%20%20%20%20%20%20%20%20%20%20%3Cstop%20offset%3D%22100%25%22%20stop-color%3D%22%23764ba2%22%2F%3E%0A%20%20%20%20%20%20%20%20%3C%2FlinearGradient%3E%0A%20%20%20%20%20%20%3C%2Fdefs%3E%0A%20%20%20%20%20%20%3Crect%20width%3D%22200%22%20height%3D%22200%22%20rx%3D%22100%22%20fill%3D%22url(%23g)%22%2F%3E%0A%20%20%20%20%20%20%3Ccircle%20cx%3D%22100%22%20cy%3D%2280%22%20r%3D%2236%22%20fill%3D%22rgba(255%2C255%2C255%2C0.9)%22%2F%3E%0A%20%20%20%20%20%20%3Cpath%20d%3D%22M40%20170c12-30%2044-50%2060-50s48%2020%2060%2050%22%20fill%3D%22rgba(255%2C255%2C255%2C0.9)%22%2F%3E%0A%20%20%20%20%3C%2Fsvg%3E";

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
        default: DEFAULT_PROFILE_PIC
    },
    refreshToken: {
        type: [String],
        default: []
    }
}, { versionKey: false, timestamps: true });

export default mongoose.model<IUser>("Users", userSchema);