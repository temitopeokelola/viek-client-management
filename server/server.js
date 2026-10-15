import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";

try {
  process.loadEnvFile();
} catch {
  // no .env file, use the real environment
}

const app = express();
const PORT = process.env.PORT || 4000;

let JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  // random per run, so tokens stop working when the server restarts
  JWT_SECRET = crypto.randomBytes(32).toString("hex");
  console.warn("JWT_SECRET is not set, using a random secret");
}

app.use(cors());
app.use(express.json({ limit: "10kb" }));

const users = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@viek.test",
    // bcrypt hash of the demo password
    passwordHash:
      "$2b$10$FcOQ3W0JJDjeeQslK39OPe3WCzUoiv4HqiE.03Fw6o20hnhlcKAKa"
  }
];

let clients = [
  {
    id: 1,
    name: "Acme Limited",
    email: "contact@acme.test"
  },
  {
    id: 2,
    name: "Bright Solutions",
    email: "hello@bright.test"
  }
];

// separate counter so ids are never reused after a delete
let nextClientId = clients.length + 1;

const projects = [
  {
    id: 1,
    name: "Website Development",
    clientId: 1
  },
  {
    id: 2,
    name: "Mobile Application",
    clientId: 2
  },
  {
    id: 3,
    name: "UI/UX Design",
    clientId: 1
  }
];

// Login
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  const user = users.find((item) => item.email === email);

  const passwordMatches =
    user &&
    typeof password === "string" &&
    (await bcrypt.compare(password, user.passwordHash));

  if (!passwordMatches) {
    return res.status(401).json({
      message: "Invalid email or password"
    });
  }

  const token = jwt.sign(
    { sub: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "1h" }
  );

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email
    }
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const [scheme, token] = authHeader.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Unauthorized"
    });
  }

  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({
      message: "Session expired or invalid, please log in again"
    });
  }

  next();
}

// Get clients
app.get("/api/clients", authenticate, (req, res) => {
  res.json({
    data: clients
  });
});

// Add client
app.post("/api/clients", authenticate, (req, res) => {
  const { name, email } = req.body;

  if (!name || !email) {
    return res.status(400).json({
      message: "Name and email are required"
    });
  }

  const newClient = {
    id: nextClientId++,
    name,
    email
  };

  clients.push(newClient);

  res.status(201).json({
    data: newClient
  });
});

// Delete client
app.delete("/api/clients/:id", authenticate, (req, res) => {
  const id = Number(req.params.id);

  const originalLength = clients.length;

  clients = clients.filter(
    (client) => client.id !== id
  );

  if (clients.length === originalLength) {
    return res.status(404).json({
      message: "Client not found"
    });
  }

  res.json({
    message: "Client deleted successfully"
  });
});

// Get projects
app.get("/api/projects", authenticate, (req, res) => {
  const { clientId } = req.query;

  let result = projects;

  if (clientId) {
    result = projects.filter(
      (project) => project.clientId === Number(clientId)
    );
  }

  res.json({
    projects: result
  });
});

app.use((req, res) => {
  res.status(404).json({
    message: "Route not found"
  });
});

// Error handler
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON in request body"
    });
  }

  if (err.type === "entity.too.large") {
    return res.status(413).json({
      message: "Request body is too large"
    });
  }

  console.error(err);

  res.status(500).json({
    message: "Something went wrong"
  });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
