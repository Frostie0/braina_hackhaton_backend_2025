import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        default: () => uuidv4(),
        unique: true,
        immutable: true,
    },
    profile: {
        type: String,
        default: ''
    },
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        unique: true,
        required: true
    },
    password: {
        type: String,
        required: [true, 'password is required'],
        minLength: [6, 'password length should be greater than 6 characters']
    },
    userType: {
        type: String,
        default: 'student'
    },
    educationLevel: {
        type: String,
        default: 'highschool'
    },
    loginAttempts: {
        type: Number,
        default: 0
    },
    lockUntil: {
        type: Date,
        default: null
    },
    creditBuy: {
        type: Number,
        default: 0
    },
    creditOffer: {
        type: Number,
        default: 50
    },
    socketId: {
        type: String,
        default: null
    },
    connected: {
        type: Boolean,
        default: false
    },
    referralCode: {
        type: String,
    },
    referrerId: {
        type: String,
        default: null
    },
    referralBalance: {
        type: Number,
        default: 0
    },
    referredCount: {
        type: Number,
        default: 0
    },
    firstReferral: {
        type: Boolean,
        default: false
    },
}, { timestamps: true });

// Backfill automatique pour les anciens documents sans userId
userSchema.pre("save", function (next) {
    if (!this.userId) {
        this.userId = uuidv4();
    }
    next();
});

export const User = mongoose.model("User", userSchema);
export default User;
