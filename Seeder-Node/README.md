# Node.js Database Seeder & Customer Signup with Email Verification

A beginner-friendly Node.js and Express backend demonstrating database initialization, schema relationships, idempotent data seeding, and a complete **Customer Signup & Email Verification flow** using MongoDB, Mongoose, bcryptjs, and Nodemailer.

---

## 📌 Table of Contents
- [What This Project Does](#what-this-project-does)
- [Project Structure](#project-structure)
- [Tech Stack & Packages](#tech-stack--packages)
- [Environment Configuration](#environment-configuration)
- [Database Initialization & Seeding](#database-initialization--seeding)
- [Starting the Express Server](#starting-the-express-server)
- [Authentication API Endpoints](#authentication-api-endpoints)
  - [1. Customer Signup (`POST /api/auth/signup`)](#1-customer-signup-post-apiauthsignup)
  - [2. Email Verification (`GET /api/auth/verify-email`)](#2-email-verification-get-apiauthverify-email)
- [How the System Works (Conceptual Guide)](#how-the-system-works-conceptual-guide)
  - [How Customer Role ObjectId is Assigned](#how-customer-role-objectid-is-assigned)
  - [How Email Verification Tokens Work](#how-email-verification-tokens-work)
  - [The Seeder Lifecycle](#the-seeder-lifecycle)

---

## 🚀 What This Project Does

1. **Database Seeding (`npm run initsetup`):** Initializes standard system roles (`Admin`, `Customer`, `Rider`, `Staff`) and creates a default Admin user.
2. **Customer Signup (`POST /api/auth/signup`):** Allows new customers to register. The API automatically looks up the existing `Customer` role `ObjectId` and links it to the user.
3. **Password Security:** Hashes passwords with `bcryptjs` before persisting them to MongoDB.
4. **Email Verification (`GET /api/auth/verify-email?token=...`):** Generates a secure random 32-byte hexadecimal token with a 24-hour expiration, emails a verification link to the customer via `nodemailer`, and activates their account once clicked.

---

## 📁 Project Structure

```text
Seeder Node/
├── src/
│   ├── config/
│   │   └── db.js            # MongoDB connection & disconnection helpers
│   ├── controllers/
│   │   └── authController.js# Signup and email verification route handlers
│   ├── models/
│   │   ├── Role.js          # Role schema (name, display, timestamps)
│   │   └── User.js          # User schema (name, email, password, role ref, isEmailVerified, tokens)
│   ├── routes/
│   │   └── authRoutes.js    # Express routing for /api/auth
│   ├── seeders/
│   │   └── initSetup.js     # Standalone idempotent database seeder script
│   ├── services/
│   │   └── emailService.js  # Nodemailer email dispatch helper
│   └── app.js               # Express application instance & global routes
├── .env                     # Local environment variables
├── .env.example             # Template for required environment variables
├── .gitignore               # Excludes node_modules and .env
├── package.json             # Dependencies and npm scripts
├── server.js                # Server entry point
└── README.md                # Full documentation
```

---

## 🛠️ Tech Stack & Packages

- **Node.js** - JavaScript runtime environment.
- **Express.js** - Web server framework.
- **MongoDB & Mongoose** - Database and ODM.
- **bcryptjs** - One-way cryptographic password hashing.
- **nodemailer** - Email transmission library.
- **dotenv** - Environment variable management.
- **crypto** - Built-in Node.js module for generating secure random tokens.

---

## ⚙️ Environment Configuration

Copy `.env.example` to `.env`:

```env
# Server Configuration
PORT=5000
BASE_URL=http://localhost:5000

# MongoDB Connection String
MONGO_URI=mongodb://localhost:27017/seeder_demo_db

# Default Admin User Credentials (used by initSetup seeder)
ADMIN_NAME=System Admin
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=Admin@123

# Email Service Configuration (Nodemailer / SMTP)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
EMAIL_FROM="Customer Support <no-reply@example.com>"
```

---

## 🌱 Database Initialization & Seeding

Before registering customers, initialize default roles and the admin user:

```bash
npm run initsetup
```

---

## 🌐 Starting the Express Server

```bash
npm run dev
# or
npm start
```

---

## 📡 Authentication API Endpoints

### 1. Customer Signup (`POST /api/auth/signup`)

Registers a new user and automatically assigns the `Customer` role.

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/auth/signup`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Password@123"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Account created successfully. Please check your email to verify your account.",
  "data": {
    "id": "6aa0f19b8d4f6b4ac7e3917f",
    "name": "John Doe",
    "email": "john@example.com",
    "role": "Customer",
    "isEmailVerified": false
  }
}
```

---

### 2. Email Verification (`GET /api/auth/verify-email`)

Verifies the customer's email address using the token received in the verification email.

**Request:**
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/auth/verify-email?token=835ef3e3454a039ea652f93c2a1756d01fece31ab0d5a2ff074df37c9553e8f3`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Email has been successfully verified. Your account is now active."
}
```

---

### 3. Admin Login (`POST /api/auth/admin/login`)

Authenticates an administrator using email and password, verifies that the user holds the `Admin` role in the database, and returns a signed JSON Web Token (JWT).

**Request:**
- **Method:** `POST`
- **URL:** `http://localhost:5000/api/auth/admin/login`
- **Headers:** `Content-Type: application/json`
- **Body:**
```json
{
  "email": "admin@example.com",
  "password": "Admin@123"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Admin login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "6aa0f19b8d4f6b4ac7e3917a",
      "name": "System Admin",
      "email": "admin@example.com",
      "role": "Admin"
    }
  }
}
```

**Error Responses:**
- `400 Bad Request`: Missing email or password.
- `401 Unauthorized`: Invalid credentials (incorrect email or password).
- `403 Forbidden`: Authenticated user does not have the `Admin` role (e.g. Customer, Rider, Staff attempting to log in via Admin portal).

---

## 🔒 Protected Admin Routes

### Admin Authorization Test (`GET /api/admin/test`)

Demonstrates how routes are protected using `authenticateToken` and `requireAdmin` middlewares.

**Request:**
- **Method:** `GET`
- **URL:** `http://localhost:5000/api/admin/test`
- **Headers:** `Authorization: Bearer <ADMIN_JWT_TOKEN>`

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Welcome to the Admin test route. Authorization successful!",
  "data": {
    "admin": {
      "id": "6aa0f19b8d4f6b4ac7e3917a",
      "name": "System Admin",
      "email": "admin@example.com",
      "role": "Admin"
    }
  }
}
```

**Error Responses:**
- `401 Unauthorized`: Missing or malformed token, invalid or expired token.
- `403 Forbidden`: Authenticated user is not an Admin.

---

## 🧠 How the System Works (Conceptual Guide)

### How Customer Role ObjectId is Assigned
1. When a user submits the signup form, the controller runs `Role.findOne({ name: 'Customer' })`.
2. It fetches the existing `Customer` role document from MongoDB and extracts its `_id`.
3. It sets `newUser.role = customerRole._id`.
4. It **never** creates duplicate roles.

### How Admin Login & JWT Authentication Work
1. The admin posts credentials to `POST /api/auth/admin/login`.
2. The controller finds the user and populates the `role` reference (`User.findOne({ email }).populate('role')`).
3. It validates password hash with `bcrypt.compare()`.
4. It checks that `user.role.name === 'Admin'`. Non-admins receive `403 Forbidden`.
5. It signs a JWT containing `{ id: user._id, role: user.role.name }` using `JWT_SECRET` with the configured expiration (`JWT_EXPIRES_IN`).
6. The client passes this token in the header: `Authorization: Bearer <token>`.
7. `authenticateToken` middleware verifies the token and loads the authenticated user into `req.user`.
8. `requireAdmin` middleware checks `req.user.role.name === 'Admin'` to protect administrative resources.

### How Email Verification Tokens Work
1. `crypto.randomBytes(32).toString('hex')` creates an unguessable 64-character random string.
2. The user document stores:
   - `emailVerificationToken`: the token string.
   - `emailVerificationExpires`: current time + 24 hours.
   - `isEmailVerified`: `false`.
3. The server sends an email containing `http://localhost:5000/api/auth/verify-email?token=TOKEN`.
4. When clicked, the server finds the matching user, checks expiration, sets `isEmailVerified = true`, and clears the token fields.

