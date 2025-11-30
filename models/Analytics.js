import mongoose from "mongoose";

const analyticsSchema = new mongoose.Schema({
    userId: {
        type: String, // Using String to match User model's userId (uuid)
        required: true,
        ref: 'User'
    },
    quizId: {
        type: String,
        ref: 'Quiz'
    },
    subject: {
        type: String,
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    totalQuestions: {
        type: Number,
        required: true
    },
    timeSpent: {
        type: Number, // in seconds
        default: 0
    },
    completedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

export const Analytics = mongoose.model("Analytics", analyticsSchema);
export default Analytics;
