import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const getModel = () => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    return model;
};

export default getModel;
