const express = require('express');
const path = require('path');
const { Resend } = require('resend');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;
const EMAIL_TO = process.env.EMAIL_TO || 'otienodamon620@gmail.com';
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Replace this with an address on a verified Resend domain before deploying.
const RESEND_FROM = process.env.RESEND_FROM || 'Portfolio Website <onboarding@resend.dev>';

class AppError extends Error {
    constructor(message, statusCode = 500, errors = undefined) {
        super(message);
        this.name = this.constructor.name;
        this.statusCode = statusCode;
        this.status = statusCode >= 500 ? 'error' : 'fail';
        this.errors = errors;
        this.isOperational = true;

        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message, errors = undefined) {
        super(message, 422, errors);
    }
}

const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};

// Middleware
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Keep browser assets separate from server code and environment configuration.
const publicDirectory = path.join(__dirname, '..', 'public');
app.use(express.static(publicDirectory));

// Render can use this endpoint to confirm the service is available.
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok' });
});

function getResendClient() {
    if (!RESEND_API_KEY) {
        throw new AppError('Email service is not configured.', 500);
    }

    return new Resend(RESEND_API_KEY);
}

function validateContactPayload(body) {
    const firstName = String(body.firstName || '').trim();
    const lastName = String(body.lastName || '').trim();
    const email = String(body.email || '').trim();
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    const errors = [];

    if (!firstName) {
        errors.push({ field: 'firstName', message: 'First name is required.' });
    }

    if (!lastName) {
        errors.push({ field: 'lastName', message: 'Last name is required.' });
    }

    if (!email) {
        errors.push({ field: 'email', message: 'Email is required.' });
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push({ field: 'email', message: 'Enter a valid email address.' });
    }

    if (!message) {
        errors.push({ field: 'message', message: 'Message is required.' });
    }

    if (errors.length > 0) {
        throw new ValidationError('Please correct the highlighted fields.', errors);
    }

    return { firstName, lastName, email, subject, message };
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizeError(error) {
    if (error instanceof AppError) {
        return error;
    }

    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
        return new AppError('Invalid JSON payload.', 400);
    }

    if (error.name === 'ValidationError') {
        return new ValidationError('Validation failed.', error.errors);
    }

    if (error.name === 'UnauthorizedError' || error.status === 401) {
        return new AppError('Authentication is required.', 401);
    }

    if (error.status === 403) {
        return new AppError('You do not have permission to perform this action.', 403);
    }

    if (error.status === 404) {
        return new AppError('Resource not found.', 404);
    }

    if (error.code === 'LIMIT_FILE_SIZE') {
        return new AppError('Uploaded file is too large.', 413);
    }

    if (error.name === 'MulterError') {
        return new AppError('File upload failed.', 400);
    }

    if (error.code === '23505' || error.code === 11000) {
        return new AppError('A record with these details already exists.', 409);
    }

    if (error.name === 'CastError' || error.code === '22P02') {
        return new AppError('Invalid resource identifier.', 400);
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        return new AppError('A required service is currently unavailable.', 503);
    }

    return new AppError('Internal Server Error.', 500);
}

function logError(error, req) {
    const statusCode = error.statusCode || error.status || 500;
    const logPayload = {
        statusCode,
        method: req.method,
        path: req.originalUrl,
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
    };

    console.error('Request error:', logPayload);
}

// Contact Form Route
app.post('/api/contact', asyncHandler(async (req, res) => {
    const { firstName, lastName, email, subject, message } = validateContactPayload(req.body);

    if (!RESEND_API_KEY || !EMAIL_TO) {
        throw new AppError('Email service is not configured.', 500);
    }

    const resend = getResendClient();
    const { data, error } = await resend.emails.send({
        from: RESEND_FROM,
        to: [EMAIL_TO],
        replyTo: email,
        subject: `Portfolio Contact: ${subject || 'New Message'}`,
        text: `
You have received a new message from your portfolio website.

Name: ${firstName} ${lastName}
Email: ${email}
Subject: ${subject || 'No subject'}

Message:
${message}
`,
        html: `
          <h2>New portfolio contact message</h2>
          <p><strong>Name:</strong> ${escapeHtml(`${firstName} ${lastName}`)}</p>
          <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
          <p><strong>Subject:</strong> ${escapeHtml(subject || 'No subject')}</p>
          <p><strong>Message:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
        `
    });

    if (error) {
        console.error('Resend delivery error:', error);
        throw new AppError('Unable to send your message right now. Please try again later.', 502);
    }

    console.log('Email sent:', data.id);
    res.status(200).json({ success: true, message: 'Email sent successfully!' });
}));

app.use('/api', (req, res, next) => {
    next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
});

app.use((req, res, next) => {
    next(new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404));
});

app.use((err, req, res, next) => {
    const normalizedError = normalizeError(err);
    const statusCode = normalizedError.statusCode || 500;
    const responseBody = {
        success: false,
        message: normalizedError.message
    };

    if (Array.isArray(normalizedError.errors) && normalizedError.errors.length > 0) {
        responseBody.errors = normalizedError.errors;
    }

    logError(err, req);
    res.status(statusCode).json(responseBody);
});

const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

module.exports = { app, server };
