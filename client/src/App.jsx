import { useEffect, useState } from "react";

const API_URL = "http://localhost:4000/api";

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("token")
  );

  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");

  const [clients, setClients] = useState([]);

  const [projects, setProjects] = useState([]);

  const [selectedClient, setSelectedClient] =
    useState("");

  const [clientName, setClientName] =
    useState("");

  const [clientEmail, setClientEmail] =
    useState("");

  const [message, setMessage] = useState("");

  const [loadingClients, setLoadingClients] =
    useState(false);

  const [loadingProjects, setLoadingProjects] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);

  async function login(event) {
    event.preventDefault();

    let response;

    setSubmitting(true);

    try {
      response = await fetch(
        `${API_URL}/login`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            email,
            password
          })
        }
      );
    } catch {
      setMessage("Could not reach the server. Please try again.");
      return;
    } finally {
      setSubmitting(false);
    }

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(result.message || "Login failed");
      return;
    }

    localStorage.setItem("token", result.token);
    setToken(result.token);
    setPassword("");
    setMessage("");
  }

  function logout(text = "") {
    localStorage.removeItem("token");
    setToken(null);
    setClients([]);
    setProjects([]);
    setSelectedClient("");
    setMessage(text);
  }

  // returns the response body, or null after showing an error
  async function apiRequest(path, options = {}) {
    let response;

    try {
      response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
    } catch {
      setMessage("Could not reach the server. Please try again.");
      return null;
    }

    const result = await response.json().catch(() => ({}));

    if (response.status === 401) {
      logout(result.message || "Please log in again");
      return null;
    }

    if (!response.ok) {
      setMessage(result.message || "Something went wrong");
      return null;
    }

    return result;
  }

  async function loadClients() {
    setLoadingClients(true);
    const result = await apiRequest("/clients");
    setLoadingClients(false);

    if (result) {
      setClients(result.data);
    }
  }

  async function loadProjects() {
    const path = selectedClient
      ? `/projects?clientId=${selectedClient}`
      : "/projects";

    setLoadingProjects(true);
    const result = await apiRequest(path);
    setLoadingProjects(false);

    if (result) {
      setProjects(result.projects);
    }
  }

  async function addClient(event) {
    event.preventDefault();

    setSubmitting(true);

    const result = await apiRequest("/clients", {
      method: "POST",
      body: JSON.stringify({
        name: clientName,
        email: clientEmail
      })
    });

    setSubmitting(false);

    if (!result) {
      return;
    }

    setMessage("Client added successfully");

    setClientName("");
    setClientEmail("");

    loadClients();
  }

  async function deleteClient(id) {
    const result = await apiRequest(`/clients/${id}`, {
      method: "DELETE"
    });

    if (result) {
      setMessage(result.message);
      loadClients();

      if (String(id) === selectedClient) {
        setSelectedClient("");
      }
    }
  }

  useEffect(() => {
    if (token) {
      loadClients();
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      loadProjects();
    }
  }, [token, selectedClient]);

  if (!token) {
    return (
      <div className="container">
        <div className="card">
          <h1>VIEK Client Management</h1>

          <h2>Login</h2>

          <form onSubmit={login}>
            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(e.target.value)
              }
              placeholder="Email"
            />

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Password"
            />

            <button type="submit" disabled={submitting}>
              {submitting ? "Logging in..." : "Login"}
            </button>
          </form>

          {message && (
            <p className="message">
              {message}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="header">
        <h1>VIEK Client Management</h1>

        <button onClick={() => logout()}>
          Logout
        </button>
      </div>

      <div className="card">
        <h2>Add Client</h2>

        <form onSubmit={addClient}>
          <input
            value={clientName}
            onChange={(e) =>
              setClientName(e.target.value)
            }
            placeholder="Client name"
          />

          <input
            type="email"
            value={clientEmail}
            onChange={(e) =>
              setClientEmail(e.target.value)
            }
            placeholder="Client email"
          />

          <button type="submit" disabled={submitting}>
            {submitting ? "Saving..." : "Add Client"}
          </button>
        </form>

        {message && (
          <p className="message">
            {message}
          </p>
        )}
      </div>

      <div className="card">
        <h2>Clients</h2>

        {loadingClients && clients.length === 0 ? (
          <p>Loading clients...</p>
        ) : clients.length === 0 ? (
          <p>No clients found.</p>
        ) : (
          <ul>
            {clients.map((client) => (
              <li key={client.id}>
                <strong>{client.name}</strong>
                <span>{client.email}</span>

                <button
                  onClick={() =>
                    deleteClient(client.id)
                  }
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <h2>Projects</h2>

        <select
          value={selectedClient}
          onChange={(e) =>
            setSelectedClient(e.target.value)
          }
        >
          <option value="">
            All Clients
          </option>

          {clients.map((client) => (
            <option
              key={client.id}
              value={client.id}
            >
              {client.name}
            </option>
          ))}
        </select>

        {loadingProjects ? (
          <p>Loading projects...</p>
        ) : projects.length === 0 ? (
          <p>No projects found.</p>
        ) : (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <strong>{project.name}</strong>

                <span>
                  Client ID: {project.clientId}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default App;
