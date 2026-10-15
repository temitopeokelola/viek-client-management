import express from "express";
import cors from "cors";

const app = express();
const PORT = 4000;

app.use(cors());
app.use(express.json({ limit: "10kb" }));

const users = [
  {
    id: 1,
    name: "Admin User",
    email: "admin@viek.test",
    password: "password123"
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
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = users.find(
    (item) =>
      item.email === email &&
      item.password === password
  );

  if (!user) {
    return res.status(401).json({
      message: "Invalid email or password"
    });
  }

  res.json({
    token: "demo-token",
    user
  });
});

// Authentication middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader !== "Bearer demo-token") {
    return res.status(401).json({
      message: "Unauthorized"
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
