const nodemailer = require("nodemailer");

async function sendEmail(to, subject, text) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: "concordgroupvms@gmail.com",
      pass: "rhrf zncv pjpf xyls",
    },
  });

  const mailOptions = {
    from: "concordgroupvms@gmail.com",
    to: to,
    subject: subject,
    html: text,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(("Message sent: %s", info.messageId));
    return {
      success: true,
      message: "Email sent success fully",
    };
  } catch (error) {
    console.error("Error sending email: %s", error);
    return {
      success: false,
      message: "Failed to send email",
    };
  }
}

module.exports = sendEmail;
