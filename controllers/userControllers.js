import { User } from "../models/User.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET || 'secret_key_braina_2025', {
        expiresIn: '30d',
    });
};

const generateRefreshToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'refresh_secret_key_braina_2025', {
        expiresIn: '60d',
    });
};

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

        const access_token = generateToken(newUser._id);
        const refresh_token = generateRefreshToken(newUser._id);

        res.status(200).json({
            newUser,
            access_token,
            refresh_token
        });

    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};

export const loginController = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log("Email:", email);
        console.log("Password:", password);

        const user = await User.findOne({ email });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Invalid password' });
        }

        const access_token = generateToken(user._id);
        const refresh_token = generateRefreshToken(user._id);

        res.status(200).json({
            user,
            access_token,
            refresh_token
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

export const getMeController = async (req, res) => {
    try {
        const user = await User.findById(req.user._id).select('-password');
        res.status(200).json({
            data: user
        });
    } catch (error) {
        console.error("Erreur:", error);
        res.status(500).json({ error: error.message });
    }
};
