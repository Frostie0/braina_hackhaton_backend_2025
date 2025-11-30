import Analytics from "../models/Analytics.js";
import User from "../models/User.js";

// Save a new exam result
export const saveExamResult = async (req, res) => {
    try {
        const { userId, quizId, subject, score, totalQuestions, timeSpent } = req.body;

        if (!userId || !subject || score === undefined || !totalQuestions) {
            return res.status(400).json({ message: "Missing required fields" });
        }

        const newResult = new Analytics({
            userId,
            quizId,
            subject,
            score,
            totalQuestions,
            timeSpent
        });

        await newResult.save();

        res.status(201).json({ message: "Exam result saved successfully", data: newResult });
    } catch (error) {
        console.error("Error saving exam result:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get user analytics stats
export const getUserStats = async (req, res) => {
    try {
        const { userId } = req.params;

        if (!userId) {
            return res.status(400).json({ message: "User ID is required" });
        }

        // Fetch all results for the user
        const results = await Analytics.find({ userId }).sort({ completedAt: -1 });

        if (!results.length) {
            return res.status(200).json({
                averageScore: 0,
                totalExams: 0,
                totalTime: '0h 0m',
                masteryScore: 0,
                scoreTrend: { value: 0, isPositive: true },
                examsTrend: { value: 0, isPositive: true },
                performanceData: [],
                subjectMastery: [],
                recentActivity: []
            });
        }

        // Calculate Global Stats
        const totalExams = results.length;
        const totalScore = results.reduce((acc, curr) => acc + (curr.score / curr.totalQuestions) * 20, 0); // Normalized to 20
        const averageScore = (totalScore / totalExams).toFixed(1);

        const totalSeconds = results.reduce((acc, curr) => acc + (curr.timeSpent || 0), 0);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const totalTime = `${hours}h ${minutes}m`;

        // Mastery Score (Simple calculation: avg percentage)
        const masteryScore = Math.round((totalScore / totalExams / 20) * 100);

        // Trends (comparing last 5 vs previous 5, simplified for now)
        // For now, hardcoding trends or calculating based on limited data
        const scoreTrend = { value: 0, isPositive: true }; // Placeholder logic
        const examsTrend = { value: 0, isPositive: true }; // Placeholder logic

        // Performance Data (Last 7 exams)
        const performanceData = results.slice(0, 7).reverse().map((r, i) => ({
            label: `Exam ${i + 1}`,
            value: Math.round((r.score / r.totalQuestions) * 20),
            date: new Date(r.completedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
        }));

        // Subject Mastery
        const subjectStats = {};
        results.forEach(r => {
            if (!subjectStats[r.subject]) {
                subjectStats[r.subject] = { totalScore: 0, count: 0 };
            }
            subjectStats[r.subject].totalScore += (r.score / r.totalQuestions) * 100; // Percentage
            subjectStats[r.subject].count += 1;
        });

        const subjectMastery = Object.keys(subjectStats).map(subject => ({
            subject,
            mastery: Math.round(subjectStats[subject].totalScore / subjectStats[subject].count),
            examsCount: subjectStats[subject].count
        }));

        // Recent Activity
        const recentActivity = results.slice(0, 5).map(r => ({
            subject: r.subject,
            date: r.completedAt,
            score: Math.round((r.score / r.totalQuestions) * 20)
        }));

        res.status(200).json({
            averageScore,
            totalExams,
            totalTime,
            masteryScore,
            scoreTrend,
            examsTrend,
            performanceData,
            subjectMastery,
            recentActivity
        });

    } catch (error) {
        console.error("Error fetching user stats:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};
