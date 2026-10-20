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

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = await User.create({
      name,
      email,
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

    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.emailVerified) {
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
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
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
      where: { verificationToken: hashToken(token) }
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
    // Keep the token fields on purpose: a second click on the same link then
    // hits the "already verified" branch above (idempotent UX) instead of
    // "invalid link". The raw token only exists in this user's own email, and
    // verification grants nothing extra — resend regenerates the hash anyway.
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

    // Generic response always — never reveal whether an account exists
    const genericResponse = {
      message: 'If that email is registered and unverified, a new verification link has been sent.'
    };

    const user = await User.findOne({ where: { email } });
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
    const user = await User.findByPk(req.user.id, {
      attributes: { exclude: ['password'] }
    });

    res.json({ user });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
