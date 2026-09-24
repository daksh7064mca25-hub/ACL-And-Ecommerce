# Full-Stack E-Commerce & ACL Management Platform

A complete full-stack e-commerce solution featuring enterprise Role-Based Access Control (RBAC/ACL), dynamic Product Management, Next.js storefront, Admin Panel, and end-to-end Stripe payment processing with webhook verification.

---

## Architecture Overview

```
Projects/
├── Seeder-Node/       → Express + MongoDB + Stripe REST API (Port 5000)
├── admin-panel/       → Next.js 16 Admin Panel with RBAC & Analytics (Port 3000)
└── customer-panel/    → Next.js 16 Customer Storefront & Stripe Checkout (Port 3001)
```

---

## Key Features

- **RBAC & ACL Engine**: Dynamic roles, fine-grained permissions, secure JWT authentication with client-side encrypted token storage.
- **Product Management**: Full CRUD, image uploads with Multer, category filtering, real-time inventory tracking.
- **Promotions Engine**: SendGrid/SMTP email promotion dispatching with customizable targeting.
- **Customer Storefront**: Responsive modern UI, cart state management, guest and authenticated checkout flows.
- **Stripe Checkout & Webhooks**: Server-side price calculation, hosted Stripe Checkout sessions, cryptographic webhook verification (`checkout.session.completed`), and idempotent inventory deduction.

---

## Getting Started

### 1. Backend Setup (Seeder-Node)
```bash
cd Seeder-Node
npm install
cp .env.example .env
# Edit .env with your MongoDB URI, JWT Secret, and Stripe Keys
npm run init-setup  # Seeds initial admin user & permissions
npm run dev         # Runs on http://localhost:5000
```

### 2. Admin Panel Setup
```bash
cd admin-panel
npm install
cp .env.example .env.local
npm run dev         # Runs on http://localhost:3000
```

### 3. Customer Storefront Setup
```bash
cd customer-panel
npm install
cp .env.example .env.local
npm run dev         # Runs on http://localhost:3001
```

---

## Environment Configuration

Refer to each directory's `.env.example` file for detailed configuration templates.
