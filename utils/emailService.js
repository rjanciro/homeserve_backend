const nodemailer = require('nodemailer');

// Function to send verification email with PIN
exports.sendVerificationEmail = async (email, pin) => {
  try {
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !process.env.EMAIL_SERVICE) {
      console.error('Email configuration is missing. Check your .env file');
      return false;
    }

    // Create a transporter object
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Email Verification - HomeServe',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to HomeServe!</h2>
          <p>Thank you for registering. Please verify your email address using the verification code below:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="font-size: 32px; letter-spacing: 5px; color: #4CAF50; margin: 0;">${pin}</h1>
          </div>
          
          <p>Enter this code in the verification screen to complete your registration.</p>
          <p>This verification code will expire in 1 hour.</p>
          <p>If you didn't request this code, please ignore this email.</p>
          <p>Thank you,<br>The HomeServe Team</p>
        </div>
      `,
    };

    // Verify connection configuration
    await transporter.verify();
    
    // Send email
    await transporter.sendMail(mailOptions);
    console.log(`Verification email with PIN sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending verification email:', error);
    return false;
  }
};

// Function to send password change PIN email
exports.sendPasswordChangePinEmail = async (email, pin) => {
  try {
    // Check if email configuration is available
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD || !process.env.EMAIL_SERVICE) {
      console.error('Email configuration is missing. Check your .env file');
      return false;
    }

    // Create a transporter object
    const transporter = nodemailer.createTransport({
      service: process.env.EMAIL_SERVICE,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: 'Password Change Request - HomeServe',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Change Request</h2>
          <p>You have requested to change your password. Please use the verification code below to complete this process:</p>
          
          <div style="background-color: #f5f5f5; padding: 15px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="font-size: 32px; letter-spacing: 5px; color: #4CAF50; margin: 0;">${pin}</h1>
          </div>
          
          <p>This verification code will expire in 1 hour.</p>
          <p>If you didn't request this code, please ignore this email or contact support if you believe this is suspicious.</p>
          <p>Thank you,<br>The HomeServe Team</p>
        </div>
      `,
    };

    // Verify connection configuration
    await transporter.verify();
    
    // Send email
    await transporter.sendMail(mailOptions);
    console.log(`Password change PIN sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending password change PIN email:', error);
    return false;
  }
};
