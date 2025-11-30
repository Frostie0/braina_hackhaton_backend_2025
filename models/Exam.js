import mongoose from "mongoose";

const questionSchema = new mongoose.Schema({
    number: { type: String, required: true }, // e.g. "1-", "A-"
    text: { type: String, required: true },
    type: {
        type: String,
        enum: ['essay', 'short_answer', 'fill_in_blank', 'multiple_choice', 'matching'],
        required: true
    },
    points: { type: Number, default: 0 },
    options: [String], // For MCQ
    blanks: [String], // For fill_in_blank answers (optional, for grading)
    correctAnswer: String, // For short_answer/MCQ
    pairs: [{ // For matching questions
        left: String,
        right: String
    }]
}, { _id: false });

const sectionSchema = new mongoose.Schema({
    title: { type: String, required: true },
    text: { type: String, default: '' }, // Reading passage
    questions: [questionSchema]
}, { _id: false });

const examSchema = new mongoose.Schema({
    examId: { type: String, required: true, unique: true },
    userId: { type: String, required: true },
    title: { type: String, required: true }, // e.g. "EXAMEN DE FIN D'ÉTUDES SECONDAIRES"
    subject: { type: String, required: true },
    level: { type: String, required: true }, // '9eme_bac', 'nsa_bac'
    header: {
        ministry: { type: String, default: "MINISTÈRE DE L'ÉDUCATION NATIONALE ET DE LA FORMATION PROFESSIONNELLE (MENFP)" },
        examName: { type: String, default: "" },
        duration: { type: String, default: "Durée de l'épreuve : 2 heures" },
        series: { type: String, default: "" } // Only for NS4
    },
    sections: [sectionSchema],
    isPublic: { type: Boolean, default: false }
}, { timestamps: true });

export const Exam = mongoose.model("Exam", examSchema);
export default Exam;
