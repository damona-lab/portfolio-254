const express = require('express');
const path = require('path');
const nodemailer = require('nodemailer');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const EMAIL_TO = process.env.EMAIL_TO || EMAIL_USER;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the project root
app.use(express.static(path.join(__dirname)));

function getTransporter() {
    if (!EMAIL_USER || !EMAIL_PASS) {
        throw new Error('EMAIL_USER and EMAIL_PASS environment variables are required to send contact emails.');
    }

    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: EMAIL_USER,
            pass: EMAIL_PASS
        }
    });
}

// Contact Form Route
app.post('/api/contact', (req, res) => {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const email = String(req.body.email || '').trim();
    const subject = String(req.body.subject || '').trim();
    const message = String(req.body.message || '').trim();

    if (!firstName || !lastName || !email || !message) {
        return res.status(400).json({ success: false, error: 'Missing required fields.' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, error: 'Invalid email address.' });
    }

    if (!EMAIL_USER || !EMAIL_PASS || !EMAIL_TO) {
        return res.status(500).json({ success: false, error: 'Email environment variables are not configured.' });
    }

    try {
        const transporter = getTransporter();
        const mailOptions = {
            from: `"Portfolio Website" <${EMAIL_USER}>`,
            to: EMAIL_TO,
            replyTo: email,
            subject: `Portfolio Contact: ${subject || 'New Message'}`,
            text: `
You have received a new message from your portfolio website.

Name: ${firstName} ${lastName}
Email: ${email}
Subject: ${subject || 'No subject'}

Message:
${message}
`
        };

        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.error('Error sending email:', error);
                return res.status(500).json({ success: false, error: 'Failed to send email.' });
            }

            console.log('Email sent:', info.messageId);
            res.status(200).json({ success: true, message: 'Email sent successfully!' });
        });
    } catch (error) {
        console.error(error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Fallback for client-side routes and direct HTML page requests
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ success: false, error: 'Invalid JSON payload.' });
    }

    console.error(err);
    res.status(500).json({ success: false, error: 'Internal Server Error.' });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
