import { Exam } from "../models/Exam.js";
import getModel from "../config/ai.js";
import { v4 as uuidv4 } from 'uuid';

export const createExamController = async (req, res) => {
    try {
        const {
            data, // Extracted text
            level, // '9eme_bac' or 'nsa_bac'
            subject,
            userId
        } = req.body || {};

        if (!data || !Array.isArray(data) || data.length === 0) {
            return res.status(400).json({ error: 'Data array is required' });
        }
        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const model = getModel();
        const isNS4 = level === 'nsa_bac' || level === 'universitaire';
        const is9eme = level === '9eme_bac';

        let systemPrompt = "";

        if (isNS4) {
            systemPrompt = `
You are an expert exam creator for the Haitian Ministry of Education (MENFP).
Your task is to create a rigorous "EXAMEN DE FIN D'ÉTUDES SECONDAIRES" (Baccalauréat/NS4) based on the provided text.

**Style & Tone**:
- Formal, academic, rigorous.
- Use "Texte Modèle" format if applicable (a main reading text followed by questions).
- Questions should be analytical, requiring synthesis and commentary.
- Include a "Production Écrite" or "Dissertation" section if appropriate for the subject.

**Structure**:
1. **Header**: Define the exam name (e.g., "HISTOIRE-GÉOGRAPHIE") and series (e.g., "SVT").
2. **Sections**:
   - **Section 1**: "Texte Modèle" (The provided text, cleaned up).
   - **Section 2**: "Questions" (Analysis, Comprehension).
   - **Section 3**: "Dissertation" or "Production Écrite".

**Output JSON Format**:
{
    "title": "EXAMEN DE FIN D'ÉTUDES SECONDAIRES",
    "header": {
        "examName": "${subject.toUpperCase()}",
        "series": "SVT/SMP",
        "duration": "3 heures"
    },
    "sections": [
        {
            "title": "Texte Modèle",
            "text": "The full text content here...",
            "questions": []
        },
        {
            "title": "I- Analyse et Compréhension",
            "questions": [
                { "number": "1-", "text": "Question text...", "type": "essay", "points": 15 }
            ]
        }
    ]
}
`;
        } else {
            // 9ème Année
            systemPrompt = `
You are an expert exam creator for the Haitian Ministry of Education (MENFP).
Your task is to create an "EXAMEN DE 9ÈME ANNÉE FONDAMENTALE" based on the provided text.

**Style & Tone**:
- Formal but accessible for 9th grade.
- Structured exercises: Grammar, Vocabulary, Comprehension.
- Use Fill-in-the-blanks, Short Answers, and Matching.

**Structure**:
1. **Header**: "EXAMEN DE 9ÈME ANNÉE FONDAMENTALE".
2. **Sections**:
   - **Section 1**: "Compréhension de texte" (The text + questions).
   - **Section 2**: "Grammaire / Vocabulaire" (Exercises).
   - **Section 3**: "Production Écrite".

**Output JSON Format**:
{
    "title": "EXAMEN DE 9ÈME ANNÉE FONDAMENTALE",
    "header": {
        "examName": "${subject.toUpperCase()}",
        "duration": "2 heures"
    },
    "sections": [
        {
            "title": "I- Compréhension de texte",
            "text": "The text content...",
            "questions": [
                { "number": "1-", "text": "Question...", "type": "short_answer", "points": 5 }
            ]
        },
        {
            "title": "II- Grammaire",
            "questions": [
                { "number": "1-", "text": "Complete: Le chat ___ (manger).", "type": "fill_in_blank", "points": 5, "blanks": ["mange"] },
                { 
                    "number": "2-", 
                    "text": "Associez les éléments de la colonne A avec ceux de la colonne B", 
                    "type": "matching", 
                    "points": 10,
                    "pairs": [
                        { "left": "Le chat", "right": "miaule" },
                        { "left": "Le chien", "right": "aboie" }
                    ]
                }
            ]
        }
    ]
}
`;
        }

        const prompt = `
${systemPrompt}

**Input Data (Source Text)**:
${JSON.stringify(data)}

**IMPORTANT**:
- Return ONLY valid JSON.
- No markdown.
- Language: French (unless the subject is English/Spanish).
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const generatedContent = JSON.parse(text);

        const newExam = new Exam({
            examId: uuidv4(),
            userId,
            title: generatedContent.title,
            subject,
            level,
            header: generatedContent.header,
            sections: generatedContent.sections,
            isPublic: false
        });

        await newExam.save();

        res.status(201).json({ message: 'Exam created successfully', exam: newExam });

    } catch (error) {
        console.error("Erreur creation examen:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getExamController = async (req, res) => {
    try {
        const { examId } = req.params;
        const exam = await Exam.findOne({ examId });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });
        res.status(200).json({ exam });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const getUserExamsController = async (req, res) => {
    try {
        const { userId } = req.params;
        if (!userId) return res.status(400).json({ error: 'userId is required' });

        const exams = await Exam.find({ userId })
            .sort({ createdAt: -1 })
            .select('examId title subject level createdAt header');

        res.status(200).json({ exams, count: exams.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const correctExamController = async (req, res) => {
    try {
        const { examId, answers } = req.body;

        const exam = await Exam.findOne({ examId });
        if (!exam) return res.status(404).json({ error: 'Exam not found' });

        const model = getModel();

        // Construct the prompt with context
        const prompt = `
You are an expert teacher correcting a student's exam.
Subject: ${exam.subject}
Level: ${exam.level}

**Source Text / Context**:
${exam.sections.map(s => s.text ? `[SECTION: ${s.title}]\n${s.text}` : '').join('\n\n')}

**Questions & Student Answers**:
${exam.sections.flatMap((s, sIdx) =>
            s.questions.map((q, qIdx) => {
                const id = `${sIdx}-${qIdx}`;
                return `
[ID: ${id}]
Question (${q.points} pts): ${q.text}
Student Answer: "${answers[id] || "NO ANSWER"}"
Expected Type: ${q.type}
`;
            })
        ).join('\n')}

**Task**:
Grade each answer. Provide a score out of the question's points, a brief comment, and a correction if needed.
Also calculate the global score.

**Output JSON Format**:
{
    "globalScore": number,
    "maxScore": number,
    "feedback": {
        "0-0": { "score": number, "comment": "string", "correction": "string", "isCorrect": boolean },
        "0-1": ...
    }
}
IMPORTANT: Return ONLY valid JSON.
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const correction = JSON.parse(text);

        res.status(200).json(correction);

    } catch (error) {
        console.error("Correction error:", error);
        res.status(500).json({ error: error.message });
    }
};

export const deleteExamController = async (req, res) => {
    try {
        const { examId } = req.params;
        const deletedExam = await Exam.findOneAndDelete({ examId });

        if (!deletedExam) {
            return res.status(404).json({ error: 'Exam not found' });
        }

        res.status(200).json({ message: 'Exam deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
