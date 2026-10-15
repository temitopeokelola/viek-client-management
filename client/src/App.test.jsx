import { beforeEach, describe, expect, test, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

let clients;
let projects;

function json(body, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
}

// small fake of the backend so the tests don't need the real server
function fakeApi(url, options = {}) {
  const { pathname, searchParams } = new URL(url);
  const method = options.method || "GET";

  if (pathname === "/api/login") {
    const { email, password } = JSON.parse(options.body);

    if (email === "admin@viek.test" && password === "password123") {
      return json({ token: "test-token", user: { id: 1 } });
    }

    return json({ message: "Invalid email or password" }, 401);
  }

  if (options.headers?.Authorization !== "Bearer test-token") {
    return json({ message: "Unauthorized" }, 401);
  }

  if (pathname === "/api/clients" && method === "GET") {
    return json({ data: clients });
  }

  if (pathname === "/api/clients" && method === "POST") {
    const client = { id: 3, ...JSON.parse(options.body) };
    clients = [...clients, client];
    return json({ data: client }, 201);
  }

  if (pathname.startsWith("/api/clients/") && method === "DELETE") {
    const id = Number(pathname.split("/").pop());
    clients = clients.filter((client) => client.id !== id);
    return json({ message: "Client deleted successfully" });
  }

  if (pathname === "/api/projects") {
    const clientId = searchParams.get("clientId");

    return json({
      projects: clientId
        ? projects.filter(
            (project) => project.clientId === Number(clientId)
          )
        : projects
    });
  }

  return json({ message: "Route not found" }, 404);
}

beforeEach(() => {
  clients = [
    { id: 1, name: "Acme Limited", email: "contact@acme.test" },
    { id: 2, name: "Bright Solutions", email: "hello@bright.test" }
  ];

  projects = [
    { id: 1, name: "Website Development", clientId: 1 },
    { id: 2, name: "Mobile Application", clientId: 2 },
    { id: 3, name: "UI/UX Design", clientId: 1 }
  ];

  global.fetch = vi.fn(fakeApi);
});

async function logIn(user) {
  await user.type(screen.getByPlaceholderText("Email"), "admin@viek.test");
  await user.type(screen.getByPlaceholderText("Password"), "password123");
  await user.click(screen.getByRole("button", { name: "Login" }));
  await screen.findByText("Acme Limited", { selector: "strong" });
}

function clientList() {
  return screen.getByRole("heading", { name: "Clients" }).parentElement;
}

function projectList() {
  return screen.getByRole("heading", { name: "Projects" }).parentElement;
}

describe("App", () => {
  test("logs in and shows clients and projects", async () => {
    const user = userEvent.setup();
    render(<App />);

    await logIn(user);

    expect(localStorage.getItem("token")).toBe("test-token");
    expect(within(clientList()).getByText("Bright Solutions")).toBeInTheDocument();
    expect(await within(projectList()).findByText("Website Development")).toBeInTheDocument();
    expect(within(projectList()).getByText("Mobile Application")).toBeInTheDocument();
  });

  test("shows an error for wrong login details", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("Email"), "admin@viek.test");
    await user.type(screen.getByPlaceholderText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("adds a client", async () => {
    const user = userEvent.setup();
    render(<App />);
    await logIn(user);

    await user.type(screen.getByPlaceholderText("Client name"), "Nova Tech");
    await user.type(screen.getByPlaceholderText("Client email"), "info@nova.test");
    await user.click(screen.getByRole("button", { name: "Add Client" }));

    expect(await screen.findByText("Client added successfully")).toBeInTheDocument();
    expect(await within(clientList()).findByText("Nova Tech")).toBeInTheDocument();

    const postCall = fetch.mock.calls.find(
      ([, options]) => options?.method === "POST" && options.body.includes("Nova")
    );
    expect(postCall[1].headers["Content-Type"]).toBe("application/json");
  });

  test("deletes a client", async () => {
    const user = userEvent.setup();
    render(<App />);
    await logIn(user);

    const row = within(clientList()).getByText("Bright Solutions").closest("li");
    await user.click(within(row).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Client deleted successfully")).toBeInTheDocument();
    expect(within(clientList()).queryByText("Bright Solutions")).not.toBeInTheDocument();
  });

  test("filters projects by client", async () => {
    const user = userEvent.setup();
    render(<App />);
    await logIn(user);
    await within(projectList()).findByText("Mobile Application");

    await user.selectOptions(screen.getByRole("combobox"), "1");

    expect(await within(projectList()).findByText("UI/UX Design")).toBeInTheDocument();
    expect(within(projectList()).getByText("Website Development")).toBeInTheDocument();
    expect(within(projectList()).queryByText("Mobile Application")).not.toBeInTheDocument();
  });

  test("goes back to login when the token is rejected", async () => {
    localStorage.setItem("token", "expired-token");
    render(<App />);

    expect(await screen.findByRole("button", { name: "Login" })).toBeInTheDocument();
    expect(screen.getByText("Unauthorized")).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
  });

  test("shows a message when the server cannot be reached", async () => {
    global.fetch = vi.fn(() => Promise.reject(new TypeError("Failed to fetch")));
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByPlaceholderText("Email"), "admin@viek.test");
    await user.type(screen.getByPlaceholderText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Login" }));

    expect(await screen.findByText("Could not reach the server. Please try again.")).toBeInTheDocument();
  });

  test("logs out", async () => {
    const user = userEvent.setup();
    render(<App />);
    await logIn(user);

    await user.click(screen.getByRole("button", { name: "Logout" }));

    expect(screen.getByRole("button", { name: "Login" })).toBeInTheDocument();
    expect(localStorage.getItem("token")).toBeNull();
  });
});
