import { User } from "../models/User.js";
import bcrypt from "bcrypt";


export const registerController = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!name || !email || !password) {
            return res.status(400).json({ error: 'All fields are required' })
        }

        const user = await User.findOne({ email });

        if (user) {
            return res.status(400).json({ error: 'User already exists' })
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const newUser = await User.create({
            name,
            email,
            password: hashedPassword
        });


        res.status(200).json({
            newUser,
        });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        res.status(200).json({
            user,
        });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

export const getUserController = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findOne({ userId });

        console.log("Utilisateur trouvé:", user);

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.status(200).json({
            user,
            name: user.name
        });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

