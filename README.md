<p align="center">
  <h1 align="center">🏥 HealthSense</h1>
  <p align="center">
    <strong>A modern health monitoring and tracking platform</strong>
  </p>
  <p align="center">
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#api-reference">API Reference</a>
  </p>
</p>

---

## 📋 Overview

**HealthSense** is a full-stack health monitoring web application that enables users to track vital signs, visualize health trends through interactive charts, and manage their wellness data — all through a sleek, responsive interface.

---

## ✨ Features

- 🔐 **Secure Authentication** — User registration & login with JWT-based auth
- 📊 **Health Dashboard** — Real-time vital sign monitoring (heart rate, blood pressure, SpO2, temperature)
- 📈 **Interactive Charts** — Beautiful health data visualizations powered by Recharts
- 📝 **Health Reports** — Track and review historical health data
- 👤 **User Profiles** — Personalized health profiles and settings
- 📱 **Responsive Design** — Fully optimized for desktop, tablet, and mobile

---

## 🛠️ Tech Stack

### Frontend

| Technology     | Purpose                          |
| -------------- | -------------------------------- |
| **React.js**   | UI component library             |
| **Tailwind CSS** | Utility-first CSS framework    |
| **Recharts**   | Health/vital data visualizations |
| **Axios**      | HTTP client for API communication |

### Backend

| Technology      | Purpose                        |
| --------------- | ------------------------------ |
| **Node.js**     | JavaScript runtime             |
| **Express.js**  | Web application framework      |
| **REST API**    | API architecture pattern       |
| **JWT**         | Token-based authentication     |

### Database

| Technology   | Purpose                          |
| ------------ | -------------------------------- |
| **MongoDB**  | NoSQL document database          |
| **Mongoose** | MongoDB object modeling (ODM)    |

---

## 🏗️ Architecture

```
HealthSense/
├── client/                     # Frontend (React)
│   ├── public/                 # Static assets
│   └── src/
│       ├── assets/             # Images, icons, fonts
│       ├── components/         # Reusable UI components
│       │   ├── auth/           # Login, Register forms
│       │   ├── charts/         # Recharts visualizations
│       │   ├── dashboard/      # Dashboard widgets
│       │   ├── layout/         # Navbar, Sidebar, Footer
│       │   └── common/         # Buttons, Cards, Modals
│       ├── context/            # React Context providers
│       ├── hooks/              # Custom React hooks
│       ├── pages/              # Page-level components
│       │   ├── Dashboard.jsx
│       │   ├── Login.jsx
│       │   ├── Register.jsx
│       │   ├── Profile.jsx
│       │   └── Reports.jsx
│       ├── services/           # API service layer (Axios)
│       ├── utils/              # Helper functions
│       ├── App.jsx             # Root component
│       ├── index.css           # Tailwind directives
│       └── main.jsx            # Entry point
│
├── server/                     # Backend (Node.js + Express)
│   ├── config/                 # DB connection, environment config
│   │   └── db.js
│   ├── controllers/            # Route handlers / business logic
│   │   ├── authController.js
│   │   ├── userController.js
│   │   └── healthController.js
│   ├── middleware/             # Custom middleware
│   │   ├── authMiddleware.js   # JWT verification
│   │   └── errorHandler.js
│   ├── models/                 # Mongoose schemas
│   │   ├── User.js
│   │   └── HealthRecord.js
│   ├── routes/                 # API route definitions
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   └── healthRoutes.js
│   ├── utils/                  # Helper utilities
│   │   └── generateToken.js
│   └── server.js               # Express app entry point
│
├── .env.example                # Environment variable template
├── .gitignore
├── package.json
└── README.md
```

---

## 🔄 System Flow

```
┌─────────────┐     Axios/HTTP      ┌──────────────┐     Mongoose     ┌──────────┐
│             │  ←───────────────→   │              │  ←────────────→  │          │
│   React.js  │    REST API + JWT    │  Express.js  │     ODM Layer    │ MongoDB  │
│  (Frontend) │                      │  (Backend)   │                  │   (DB)   │
│             │                      │              │                  │          │
└─────────────┘                      └──────────────┘                  └──────────┘
   Tailwind CSS                        JWT Auth
   Recharts                            Middleware
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 18.x
- **npm** >= 9.x
- **MongoDB** (local instance or [MongoDB Atlas](https://www.mongodb.com/atlas))

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/healthsense.git
cd healthsense
```

### 2. Environment Variables

Create a `.env` file in the `server/` directory:

```env
# Server
PORT=5000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://localhost:27017/healthsense

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRE=30d
```

### 3. Install Dependencies

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 4. Run the Application

```bash
# Run backend server (from /server)
npm run dev

# Run frontend client (from /client)
npm run dev
```

| Service  | URL                         |
| -------- | --------------------------- |
| Frontend | `http://localhost:5173`      |
| Backend  | `http://localhost:5000/api`  |

---

## 📡 API Reference

### Authentication

| Method | Endpoint              | Description         | Auth     |
| ------ | --------------------- | ------------------- | -------- |
| POST   | `/api/auth/register`  | Register new user   | Public   |
| POST   | `/api/auth/login`     | Login user          | Public   |
| GET    | `/api/auth/profile`   | Get user profile    | Private  |

### Health Records

| Method | Endpoint              | Description              | Auth     |
| ------ | --------------------- | ------------------------ | -------- |
| GET    | `/api/health`         | Get all health records   | Private  |
| POST   | `/api/health`         | Add new health record    | Private  |
| GET    | `/api/health/:id`     | Get single record        | Private  |
| PUT    | `/api/health/:id`     | Update health record     | Private  |
| DELETE | `/api/health/:id`     | Delete health record     | Private  |

### Users

| Method | Endpoint              | Description         | Auth     |
| ------ | --------------------- | ------------------- | -------- |
| GET    | `/api/users/me`       | Get current user    | Private  |
| PUT    | `/api/users/me`       | Update user profile | Private  |

---

## 📦 Key Dependencies

### Client

```json
{
  "react": "^18.x",
  "react-dom": "^18.x",
  "react-router-dom": "^6.x",
  "axios": "^1.x",
  "recharts": "^2.x",
  "tailwindcss": "^3.x"
}
```

### Server

```json
{
  "express": "^4.x",
  "mongoose": "^7.x",
  "jsonwebtoken": "^9.x",
  "bcryptjs": "^2.x",
  "dotenv": "^16.x",
  "cors": "^2.x",
  "nodemon": "^3.x"
}
```

---

## 🧪 Available Scripts

### Client

| Script           | Description                    |
| ---------------- | ------------------------------ |
| `npm run dev`    | Start development server       |
| `npm run build`  | Build for production           |
| `npm run preview`| Preview production build       |

### Server

| Script           | Description                    |
| ---------------- | ------------------------------ |
| `npm run dev`    | Start with nodemon (hot reload)|
| `npm start`      | Start production server        |

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by the HealthSense Team
</p>
