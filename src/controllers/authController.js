import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { validationResult } from 'express-validator';
import { User } from '../models/index.js';
import { sendVerificationEmail } from '../utils/emailService.js';

const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d'
  });
};

const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Only the SHA-256 hash is stored; the raw token exists solely in the email link
const hashToken = (rawToken) =>
  crypto.createHash('sha256').update(rawToken).digest('hex');

// Creates a fresh verification token for a user and emails it.
// Returns { devVerificationUrl } when the email was only logged (console/fallback)
// outside production, so local development stays fully usable.
const issueVerification = async (user) => {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.verificationToken = hashToken(rawToken);
  user.verificationTokenExpires = new Date(Date.now() + VERIFICATION_TTL_MS);
  await user.save();

  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
  const verificationUrl = `${frontendUrl}/verify-email?token=${rawToken}`;

  const result = await sendVerificationEmail({
    to: user.email,
    name: user.name,
    verificationUrl
  });

  const exposeLinkInDev = !result.delivered && process.env.NODE_ENV !== 'production';
  return { verificationUrl, exposeLinkInDev };
};

export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email: normalizedEmail,
      password,
      role: 'student',
      emailVerified: false
    });

    // Send verification email; registration succeeds even if delivery fails
    const { verificationUrl, exposeLinkInDev } = await issueVerification(user);

    res.status(201).json({
      message: 'Registration successful. Please check your email to verify your account.',
      verificationRequired: true,
      ...(exposeLinkInDev ? { verificationUrl } : {})
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};

export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Only block sign in if email is unverified AND a verification token exists (or user registered under the verification workflow)
    if (user.emailVerified === false && user.verificationToken) {
      return res.status(403).json({
        message: 'Please verify your email before signing in. Check your inbox for the verification link.',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    const token = generateToken(user.id);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        profileImage: user.profileImage
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Login error stack:', error.stack);
    res.status(500).json({ message: 'Server error during login' });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token } = req.body;
    const user = await User.findOne({
      verificationToken: hashToken(token)
    });

    if (!user) {
      return res.status(400).json({
        message: 'Invalid verification link. Request a new one below.',
        code: 'INVALID_TOKEN'
      });
    }

    if (user.emailVerified) {
      // Already confirmed (e.g. link clicked twice) — treat as success
      return res.json({ message: 'Email already verified. You can sign in.' });
    }

    if (!user.verificationTokenExpires || user.verificationTokenExpires < new Date()) {
      return res.status(400).json({
        message: 'This verification link has expired. Request a new one below.',
        code: 'TOKEN_EXPIRED'
      });
    }

    user.emailVerified = true;
    await user.save();

    res.json({ message: 'Email verified successfully. You can now sign in.' });
  } catch (error) {
    console.error('Verify email error:', error);
    res.status(500).json({ message: 'Server error verifying email' });
  }
};

export const resendVerification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;
    const normalizedEmail = String(email || '').trim().toLowerCase();

    const genericResponse = {
      message: 'If that email is registered and unverified, a new verification link has been sent.'
    };

    const user = await User.findOne({ email: normalizedEmail });
    if (user && !user.emailVerified) {
      const { verificationUrl, exposeLinkInDev } = await issueVerification(user);
      if (exposeLinkInDev) {
        return res.json({ ...genericResponse, verificationUrl });
      }
    }

    res.json(genericResponse);
  } catch (error) {
    console.error('Resend verification error:', error);
    res.status(500).json({ message: 'Server error resending verification email' });
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await User.findByIdOrLegacy(req.user.id).select('-password');
    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
