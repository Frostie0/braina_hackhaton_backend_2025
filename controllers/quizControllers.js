import { Quiz } from "../models/Quiz.js";

export const getQuizController = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await Quiz.findOne({ quizId });


        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        res.status(200).json({
            quiz,
        });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};
