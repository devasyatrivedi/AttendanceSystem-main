const nodemailer = require('nodemailer');

/**
 * Sends an absence warning email to a single student.
 * All Nodemailer config is unchanged from the original teacherController.js.
 */
const sendAbsenceEmail = async ({ studentName, email, subjectName, date, percentage, needed }) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: `⚠️ Attendance Warning – ${subjectName}`,
    text:
      `Dear ${studentName},\n\n` +
      `You were marked ABSENT in ${subjectName} on ${date}.\n` +
      `Your current attendance: ${percentage.toFixed(2)}%\n` +
      `Required attendance: 75%\n` +
      `You need ${needed} more lectures to reach 75%.\n\n` +
      `Please ensure regular attendance.\n`,
  };

  await transporter.sendMail(mailOptions);
};

module.exports = { sendAbsenceEmail };
