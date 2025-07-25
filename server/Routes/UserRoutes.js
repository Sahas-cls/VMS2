const express = require("express");
const csrf = require("csurf");
const userRoutes = express.Router();
const bcrypt = require("bcrypt");
const db = require("../models");
const User = db.department_Users;
// const Factory = db.Factories;
// const Department = db.Departments;
const Department = db.Departments;
// const Factory = db.Factories;
const Factory = db.Factories;
const csrfProtection = csrf({ cookie: true });
const { body, validationResult, cookie } = require("express-validator");
const { ValidationError, where, Op } = require("sequelize");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv").config();
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { MailtrapClient } = require("mailtrap");
const sendEmail = require("../utils/SendEmail");
const { error } = require("console");
// const Factory = require("../models/Factory");
require("dotenv").config();
const checkAuthToken = require("../middlewares/authonticationToken.js"); //middleware to check author jwt token

userRoutes.use(cookieParser());
// userRoutes.get("/", csrfProtection, (req, res) => {
//   // console.log(csrfProtection);
//   // console.log(req.headers);
//   res.send("sending all details of users");
// });

userRoutes.post(
  "/register",
  csrfProtection,
  [
    //validation user details
    body("userName")
      .isLength({ min: 3 })
      .withMessage("Username must contain at least 3 letters")
      .matches(/^[A-Za-z\s]+$/)
      .withMessage("Username can only contain letters and spaces"),
    body("email").isEmail().withMessage("Invalid email format"),
    body("email")
      .isEmail()
      .withMessage("Invalid email format")
      .custom(async (email) => {
        try {
          // Use Sequelize's findOne method to check if email already exists
          const user = await User.findOne({ where: { user_email: email } });

          if (user) {
            // If a user with the email already exists, reject the promise
            return Promise.reject(
              "The email already exists. Please enter a new email address"
            );
          }

          // If no user is found, resolve the promise
          return true;
        } catch (error) {
          return Promise.reject("Database error occurred.");
        }
      }),
    body("userCategory")
      .notEmpty()
      .withMessage("User category cannot be empty please select one"),
    body("password").isLength({ min: 6 }),
    body("department")
      .notEmpty()
      .withMessage("Please select user's department"),
    body("mobileNo")
      .notEmpty()
      .withMessage("Mobile number cannot be empty")
      .matches(/^[0-9]{10}$/)
      .withMessage("Invalid mobile number"),
  ],
  async (req, res) => {
    // console.log(req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("errors found", errors);
      return res.status(400).json({ errors: errors.array() });
    } else {
      console.log("no errors found");
    }

    const {
      userName,
      email,
      userCategory,
      password,
      department,
      mobileNo,
      factory,
    } = req.body;
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    // console.log(hashedPassword);
    const newUser = {
      user_Name: userName,
      user_email: email,
      user_category: userCategory,
      user_password: hashedPassword,
      Department_Id: department,
      mobile_No: mobileNo,
      Factory_Id: factory,
    };

    try {
      const createUser = await User.create(newUser);
      res.status(201).send("User Creation success");
    } catch (error) {
      console.log(error);
      // console.log("exception occurs");
      // console.log(error.message);
      res
        .status(500)
        .json({ message: "User creation failed, please try again" });
    }
    // res.send('User registered');
  }
);

userRoutes.post(
  "/login",
  csrfProtection,
  [
    body("email").isEmail().withMessage("Invalid email"),
    body("password").isLength({ min: 3 }).withMessage("Password is too short"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    const { email, password } = req.body;
    try {
      const user = await User.findOne({ where: { user_email: email } });
      if (!user) {
        return res.status(401).json({
          msg: "The email or password you entered is incorrect. Please try again",
        });
      }
      // console.log(user)
      const isUser = await bcrypt.compare(password, user.user_password);
      if (isUser) {
        const token = jwt.sign(
          {
            userId: user.user_Id,
            userName: user.user_Name,
            userEmail: user.user_email,
            userCategory: user.user_category,
            departmentId: user.Department_Id,
            factoryId: user.Factory_Id,
          },
          process.env.JWT_SECRET,
          { expiresIn: "1h" }
        );
        console.log("factory_Id: ", user.factory_Id);

        res.cookie("authToken", token, { httpOnly: true, secure: false });
        console.log("Login success-------------------->cms");
        res.status(200).json({
          msg: "Login success",
          data: {
            userName: user.user_Name,
            userCategory: user.user_category,
            department: user.department_Id,
          },
        });
      } else {
        return res.status(401).json({
          msg: "The credentials you provided don't seem to match our records",
        });
      }
    } catch (error) {
      return res.status(500).json({ msg: `Error: ${error.message}` });
    }
  }
);

module.exports = userRoutes;

//to verify user auth token
userRoutes.get("/getToken", async (req, res) => {
  console.log("token verify route called");

  const token = await req.cookies.authToken;
  if (token) {
    try {
      //decoding authToken
      const decodedToken = jwt.verify(
        token,
        "Y3J5P2l!aS@N%hUv$1aKeT@9dXqL&8Rz#xWmO*4bQfG"
      );
      console.log("decoded....", decodedToken);
      const { userId, userName, userCategory, departmentId, factoryId } =
        decodedToken;
      //getting department name according to the departmentId
      const department = await Department.findOne({
        where: { Department_Id: departmentId },
        attributes: ["Department_Name"],
      });
      const departmentName = department.dataValues.Department_Name;

      const userData = {
        userId: userId,
        userName: userName,
        userCategory: userCategory,
        department: departmentName,
        departmentId: departmentId,
        factoryId: factoryId,
      };
      // console.log(userData);
      return res
        .status(200)
        .json({ data: userData, message: "Getting user data success" });
    } catch (error) {
      console.log(error);
      return res.status(500).send(error);
    }
  } else {
    res.status(500).json({ error: "Authenticating needed" });
  }
  //res.send('Token check complete');
});

//to log out
userRoutes.post("/logout", (req, res) => {
  // Clear the 'authToken' cookie
  console.log(req.body);
  console.log("logout success");
  res.clearCookie("authToken", { httpOnly: true, secure: true });
  console.log("login out");
  res.status(200).json({ msg: "Logout successful" });
});

//!to reset user password
userRoutes.post(
  "/forgot-password",
  csrfProtection,
  [
    body("email")
      .notEmpty()
      .withMessage("Email is required")
      .bail()
      .isEmail()
      .withMessage("Invalid email format"),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: errors.array() });
    }
    const { email } = req.body;

    const user = await User.findOne({ where: { user_email: email } });
    if (user) {
      const token = jwt.sign(
        {
          userId: user.user_Id,
          userEmail: user.user_email,
        },
        "jklmno12345pqrs67890tuv",
        { expiresIn: "30min" }
      );

      const expireTime = new Date(Date.now() + 15 * 60 * 1000);

      const updatedUser = await user.update({
        password_Reset_Token: token,
        password_Reset_Token_Expired_At: expireTime,
      });

      if (updatedUser) {
        try {
          const email = sendEmail(
            user.user_email,
            "Visitor Management Password Reset",
            `
            <p>Hello, this email is from the Visitor Management System.</p>
            <p>If you need to reset your password, please enter the secret token below into the input box:</p>

            <!-- Creating a square box for the token -->
            <div style="border: 2px solid #000; padding: 10px; display: inline-block; font-size: 18px; font-weight: bold; background-color: #f4f4f4; margin: 10px 0; width:95%;">
              ${token}
            </div>

            <p>Click the link below to reset your password:</p>
            <a href="http://localhost:5173/reset-user-password" style="color: #1a73e8;">Reset Password</a>

            <p style="color:red;">Please don't share this token with anyone else.</p>
            <p style="color:red;">This token will expire 15 minutes after you receive it.</p>
          `
          );

          let emailSend = "";
          if (email) {
            emailSend = "You will receive the password reset token shortly.";
          } else {
            emailSend = "Failed to send the email.";
          }

          return res
            .status(200)
            .json({ msg: "User update successful", email: emailSend });
        } catch (error) {
          console.error("Error sending email:", error);
          return res.status(500).json({ msg: "Internal server error" });
        }
      } else {
        console.error("user update failed");
        return res
          .status(500)
          .json({ msg: "User update failed please try again shortly" });
      }

      // console.log(token);
    } else {
      console.log("user cannot be found");
      return res
        .status(400)
        .json({ msg: "Provided email doesn't contain in our users list" });
    }
    // console.log(token);
    // return;
  }
);

userRoutes.post(
  "/reset-password",
  csrfProtection,
  [
    body("token").notEmpty().withMessage("token is empty"),
    body("password")
      .notEmpty()
      .withMessage("password cannot be empty")
      .bail()
      .isLength({ min: 6, max: 255 })
      .withMessage("password must contain at least 6 characters"),
    body("cpassword")
      .notEmpty()
      .withMessage("confirm password is empty")
      .bail()
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error("Confirm password doesn't match with password");
        }
        return true;
      }),
  ],
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      console.log(errors);
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, password } = req.body;

    try {
      const decoded = jwt.verify(token, "jklmno12345pqrs67890tuv");
      const userId = decoded.userId;

      const user = await User.findOne({ where: { user_Id: userId } });
      if (user) {
        const { password_Reset_Token, password_Reset_Token_Expired_At } = user;
        const now = new Date();

        if (
          token === password_Reset_Token &&
          password_Reset_Token_Expired_At > now
        ) {
          const hashedPassword = await bcrypt.hash(password, 10);
          await user.update({
            user_password: hashedPassword,
            password_Reset_Token: null, //destroing jwt token
            password_Reset_Token_Expired_At: null,
          });
          return res.status(200).json({ msg: "Password has been reset." });
        } else {
          return res.status(400).json({
            error: "Invalid or expired token, password reset failed.",
          });
        }
      } else {
        console.log("user cannot be found");
        return res.status(404).json({
          error: "Invalid or expired token, password reset failed.",
        });
      }
    } catch (error) {
      console.error(error);
      return res.status(400).json({
        error: "Invalid or expired token, password reset failed.",
      });
    }
  }
);

userRoutes.get(
  "/get-all-users",
  csrfProtection,
  checkAuthToken,
  async (req, res) => {
    //! to retive all users details for admin panel
    try {
      const userList = await User.findAll({
        include: [
          {
            model: Department, // Correct model reference
            as: "Department", // Ensure alias matches the one defined in the association
          },
        ],
      });
      if (userList) {
        return res.status(200).json({ UserList: userList });
      } else {
        return res
          .status(500)
          .json({ error: "Data fetch failed, please try again later" });
      }
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Error found ", error });
    }
  }
);

userRoutes.put(
  "/update/:id",
  csrfProtection,
  checkAuthToken,
  [
    // Validate username, email, etc.
    body("userName")
      .isLength({ min: 3 })
      .withMessage("Username must contain at least 3 letters"),
    body("email").isEmail().withMessage("Invalid email format"),
    body("userCategory")
      .notEmpty()
      .withMessage("User category cannot be empty, please select one"),
    body("department")
      .notEmpty()
      .withMessage("Please select the user's department"),
    body("mobileNo")
      .notEmpty()
      .withMessage("Mobile number cannot be empty")
      .matches(/^[0-9]{10}$/)
      .withMessage("Invalid mobile number"),

    // Validate resetPassword field (optional check)
    body("resetPassword")
      .optional()
      .isBoolean()
      .withMessage("resetPassword field must be a boolean"),

    // Conditionally validate password and confirm password fields if resetPassword is true
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters")
      .custom((value, { req }) => {
        if (req.body.resetPassword === true) {
          if (!value) {
            throw new Error("Password is required when resetPassword is true");
          }
        }
        return true;
      }),

    // body("cpassword").custom((value, { req }) => {
    //   console.log(req.body);
    //   return;
    //   // Only validate cpassword if resetPassword is true
    //   if (req.body.resetPassword === true) {
    //     // Check if cpassword exists and is equal to password
    //     if (!value) {
    //       throw new Error(
    //         "Confirm password is required when resetting the password"
    //       );
    //     }

    //     if (value !== req.body.password) {
    //       throw new Error("Confirm password must match password");
    //     }
    //   }
    //   return true;
    // }),
  ],
  async (req, res) => {
    console.log(req.body);
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log(errors);
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const {
      userName,
      email,
      userCategory,
      password,
      department,
      mobileNo,
      factory,
      resetPassword,
    } = req.body;

    try {
      // Find the user to update
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Check if email is being changed to one that already exists
      if (email !== user.user_email) {
        const existingUser = await User.findOne({
          where: { user_email: email },
        });
        if (existingUser) {
          return res.status(400).json({
            errors: [
              {
                msg: "Email is already registered. Please use a different email.",
              },
            ],
          });
        }
      }

      // Prepare update data
      const updateData = {
        user_Name: userName,
        user_email: email,
        user_category: userCategory,
        department_Id: department,
        mobile_No: mobileNo,
        factory_Id: factory,
      };

      // Only update password if resetPassword is true and password is provided
      if (resetPassword === true && password && password.trim() !== "") {
        const saltRounds = 10;
        updateData.user_password = await bcrypt.hash(password, saltRounds);
      }

      // Perform the update
      await User.update(updateData, {
        where: { user_Id: id },
      });

      res.status(200).json({ message: "User updated successfully" });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  }
);

// to delete existing user
userRoutes.delete(
  "/delete/:id",
  csrfProtection,
  checkAuthToken,
  async (req, res) => {
    const { id } = req.params;

    try {
      const user = await User.findByPk(id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      await User.destroy({
        where: { user_Id: id },
      });

      res.status(200).json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  }
);

// select users by factory id
userRoutes.get(
  "/getUsers/:id",
  csrfProtection,
  checkAuthToken,
  async (req, res) => {
    const factory_Id = req.params.id; // Correctly extracting 'id' from the params
    console.log(factory_Id);

    try {
      const users = await User.findAll({
        where: {
          factory_Id: factory_Id, // Ensure this is the correct column name in your User model
        },
        include: [
          {
            model: Department, // Correct model reference
            as: "Department", // Ensure alias matches the one defined in the association
          },
        ],
      });

      if (users) {
        // console.log(users);
        // return;
        return res.status(200).json({ data: users }); // Respond with the users data
      } else {
        console.log("No data found");
        return res.status(404).send("No users found"); // Send a 404 status if no users found
      }
    } catch (error) {
      console.error(error);
      return res.status(500).send("Server error"); // Send a 500 status if an error occurs
    }
  }
);

// searching by user name
userRoutes.get(
  "/getUsersByName",
  csrfProtection,
  checkAuthToken,
  async (req, res) => {
    const searchKey = req.query.searchKey; // Decode the URL parameter
    console.log("user name ================= ", searchKey); // Log the decoded name

    try {
      const users = await User.findAll({
        where: {
          user_Name: {
            [Op.like]: `%${searchKey}%`, // Use Op.like with wildcards for substring search
          },
        },
        include: [
          {
            model: Department,
            as: "Department",
          },
        ],
        logging: console.log, // Enable logging to see the generated SQL query
      });

      if (users && users.length > 0) {
        return res.status(200).json({ data: users });
      } else {
        console.log("No data found");
        return res.status(404).send("No users found");
      }
    } catch (error) {
      console.error(error);
      return res.status(500).send("Server error");
    }
  }
);

module.exports = userRoutes;
