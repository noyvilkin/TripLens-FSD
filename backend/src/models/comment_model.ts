import mongoose, { Document, Model, Schema, Types } from "mongoose";

export interface IComment {
    content: string;
    userId: Types.ObjectId;
    postId: Types.ObjectId;
}

export interface ICommentDocument extends IComment, Document {}

const commentSchema: Schema<ICommentDocument> = new mongoose.Schema({
    content: {
        type: String,
        required: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "Users",
        required: true
    },
    postId: {
        type: Schema.Types.ObjectId,
        ref: "Posts",
        required: true
    }
});

const CommentModel: Model<ICommentDocument> = mongoose.model<ICommentDocument>("Comments", commentSchema);

export default CommentModel;

