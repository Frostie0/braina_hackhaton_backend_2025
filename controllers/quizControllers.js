import { Quiz } from "../models/Quiz.js";
import getModel from "../config/ai.js";
import { v4 as uuidv4 } from 'uuid';

export const getAllQuizUserController = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId || !String(userId).trim()) {
            return res.status(400).json({ error: 'userId est requis' });
        }

        const quizs = await Quiz.find({ 'players.id': String(userId).trim() });

        return res.status(200).json({ quizs, count: quizs.length });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getQuizController = async (req, res) => {
    try {
        const { quizId } = req.params;

        const quiz = await Quiz.findOne({ quizId: quizId });


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

export const createQuizController = async (req, res) => {
    try {
        const {
            data,
            difficulty,
            maxQuestions,
            language,
            format,
            userId,
            isPublic    // On garde celui-ci car c'est un choix de l'utilisateur
        } = req.body || {};

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'Data array is required and must not be empty' });
        }

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const model = getModel();

        const prompt = `
You are an expert educational content creator. Your task is to analyze the provided texts and generate a comprehensive learning package including a title, tags, summary, quiz questions, and flashcards.

## Input Data:
${JSON.stringify(data)}

## Parameters:
- Difficulty Level: ${difficulty || 'medium'}
- Number of Questions: ${maxQuestions || 5}
- Output Language: ${language || 'French'}
- Question Format: ${format || 'both'} (options: 'true_false', 'multiple_choice', or 'both')

## Instructions:

1. **Title**: Generate a clear, engaging title that represents the main topic of the content (maximum 100 characters).

2. **Tags**: Create 3-5 relevant tags/keywords that categorize the content (e.g., ["mathematics", "algebra", "equations"]).

3. **Summary**: Create a clear, comprehensive global summary that captures the main ideas and key concepts from all provided texts.

4. **Quiz Questions**: Generate exactly ${maxQuestions || 5} questions based on the question format:
   - If format is 'true_false': Create only true/false questions
   - If format is 'multiple_choice': Create only multiple-choice questions with 4 options each
   - If format is 'both': Create a mix of both question types
   - Ensure questions cover different aspects of the content
   - Vary difficulty appropriately for ${difficulty || 'medium'} level
   - Include detailed explanations for correct answers

5. **Flashcards**: Generate relevant flashcards covering key terms, concepts, and definitions from the texts.

## Output Requirements:
- Respond ONLY with valid JSON (no markdown, no code blocks, no additional text)
- Use ${language || 'French'} for all content (title, tags, summary, questions, flashcards)
- Ensure all fields are properly formatted

## Expected JSON Structure:
{
    "title": "An engaging title for this quiz",
    "tags": ["tag1", "tag2", "tag3"],
    "summary": "A comprehensive summary synthesizing the main ideas from all provided texts",
    "questions": [
        {
            "type": "true_false",
            "question": "Question statement",
            "correctAnswer": true,
            "explanation": "Detailed explanation of why this answer is correct"
        },
        {
            "type": "multiple_choice",
            "question": "Question text",
            "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
            "correctAnswer": "Option 1",
            "explanation": "Detailed explanation of why this answer is correct"
        }
    ],
    "flashcards": [
        {
            "term": "Key term or concept",
            "definition": "Clear and concise definition",
            "hint": "A helpful hint to remember this concept",
            "memoryTip": "A mnemonic or memory technique"
        }
    ]
}

IMPORTANT: Return ONLY the JSON object. Do not include any markdown formatting, code blocks, or explanatory text.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();

        // Clean up markdown code blocks if present
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const generatedContent = JSON.parse(text);

        const newQuiz = new Quiz({
            title: generatedContent.title || 'Generated Quiz',
            notes: generatedContent.summary,
            questions: generatedContent.questions,
            flashcards: generatedContent.flashcards,
            tags: generatedContent.tags || [],
            players: [{ id: userId }],
            isPublic: isPublic ?? false,
            quizId: uuidv4()
        });

        await newQuiz.save();

        res.status(201).json({ message: 'Quiz created successfully', quiz: newQuiz });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteQuizController = async (req, res) => {
    try {
        const { quizId } = req.params;
        const quiz = await Quiz.findOne({ quizId });

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        await quiz.remove();

        res.status(200).json({
            message: 'Quiz deleted successfully',
        });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

export const incrementPlayedCountController = async (req, res) => {
    try {
        const { quizId, userId } = req.body;

        if (!quizId || !userId) {
            return res.status(400).json({ error: 'quizId and userId are required' });
        }

        const quiz = await Quiz.findOne({ quizId });

        if (!quiz) {
            return res.status(404).json({ error: 'Quiz not found' });
        }

        const playerIndex = quiz.players.findIndex(p => p.id === userId);

        if (playerIndex !== -1) {
            quiz.players[playerIndex].played += 1;
        } else {
            quiz.players.push({ id: userId, played: 1 });
        }

        await quiz.save();

        res.status(200).json({ message: 'Played count incremented successfully', quiz });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};
