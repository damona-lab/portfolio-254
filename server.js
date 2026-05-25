const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Nodemailer Transporter Configuration
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'otienodamon620@gmail.com',
        pass: 'ckpo cfwy hpub qwod'
    }
});

// Contact Form Route
app.post('/api/contact', (req, res) => {
    const { firstName, lastName, email, subject, message } = req.body;

    const mailOptions = {
        from: `"${firstName} ${lastName}" <otienodamon620@gmail.com>`,
        to: 'otienodamon620@gmail.com',
        replyTo: email,
        subject: `Portfolio Contact: ${subject || 'New Message'}`,
        text: `
      You have received a new message from your portfolio website.

      Name: ${firstName} ${lastName}
      Email: ${email}
      Subject: ${subject}

      Message:
      ${message}
    `
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.error('Error sending email:', error);
            return res.status(500).json({ success: false, error: 'Internal Server Error' });
        }
        res.status(200).json({ success: true, message: 'Email sent successfully!' });
    });
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});