import mongoose from "mongoose";

// Sous-schéma pour les questions
const questionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['multiple_choice', 'true_false'],
        required: true,
    },
    question: {
        type: String,
        required: true,
    },
    options: {
        type: [String],
        default: [],
    },
    correctAnswer: {
        type: mongoose.Schema.Types.Mixed,
        required: true,
    },
    explanation: {
        type: String,
        default: '',
    }
}, { _id: true });

// Sous-schéma pour les flashcards
const flashcardSchema = new mongoose.Schema({
    term: {
        type: String,
        required: true,
    },
    definition: {
        type: String,
        required: true,
    },
    hint: {
        type: String,
        default: '',
    },
    memoryTip: {
        type: String,
        default: '',
    }
}, { _id: true });

// Modèle principal
const quizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    notes: {
        type: String,
        default: '',
    },
    questions: [questionSchema],
    flashcards: [flashcardSchema],
    tags: [String],
    players: [
        {
            id: {
                type: String,
                default: '',
            },
            played: {
                type: Number,
                default: 0,
            },
            correctAnswers: {
                type: [String],
                default: []
            }
        }],
    isPublic: {
        type: Boolean,
        default: false,
    },
    quizId: {
        type: String,
        required: true,
        unique: true
    }
}, { timestamps: true });

export const Quiz = mongoose.model("Quiz", quizSchema);
export default Quiz;
