import { test, before } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";

process.env.JWT_SECRET = "test-secret";

let app;
let token;

before(async () => {
  app = (await import("./server.js")).default;

  const res = await request(app)
    .post("/api/login")
    .send({ email: "admin@viek.test", password: "password123" });

  token = res.body.token;
});

function auth(req) {
  return req.set("Authorization", `Bearer ${token}`);
}

test("login returns a token and no password", async () => {
  const res = await request(app)
    .post("/api/login")
    .send({ email: "admin@viek.test", password: "password123" });

  assert.equal(res.status, 200);
  assert.ok(res.body.token);
  assert.deepEqual(res.body.user, {
    id: 1,
    name: "Admin User",
    email: "admin@viek.test"
  });
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.passwordHash, undefined);
});

test("login rejects a wrong password", async () => {
  const res = await request(app)
    .post("/api/login")
    .send({ email: "admin@viek.test", password: "wrong" });

  assert.equal(res.status, 401);
  assert.equal(res.body.token, undefined);
});

test("clients route rejects missing and invalid tokens", async () => {
  const missing = await request(app).get("/api/clients");
  assert.equal(missing.status, 401);

  const old = await request(app)
    .get("/api/clients")
    .set("Authorization", "Bearer demo-token");
  assert.equal(old.status, 401);
});

test("lists clients", async () => {
  const res = await auth(request(app).get("/api/clients"));

  assert.equal(res.status, 200);
  assert.equal(res.body.data.length, 2);
  assert.equal(res.body.data[0].name, "Acme Limited");
});

test("adds a client", async () => {
  const res = await auth(request(app).post("/api/clients")).send({
    name: "  Nova Tech ",
    email: "Info@Nova.test"
  });

  assert.equal(res.status, 201);
  assert.equal(res.body.data.name, "Nova Tech");
  assert.equal(res.body.data.email, "info@nova.test");

  const list = await auth(request(app).get("/api/clients"));
  assert.equal(list.body.data.length, 3);
});

test("rejects invalid client input", async () => {
  const missing = await auth(request(app).post("/api/clients")).send({
    name: "",
    email: ""
  });
  assert.equal(missing.status, 400);

  const badEmail = await auth(request(app).post("/api/clients")).send({
    name: "Test",
    email: "not-an-email"
  });
  assert.equal(badEmail.status, 400);

  const notStrings = await auth(request(app).post("/api/clients")).send({
    name: 123,
    email: ["a@b.test"]
  });
  assert.equal(notStrings.status, 400);

  const duplicate = await auth(request(app).post("/api/clients")).send({
    name: "Acme again",
    email: "contact@acme.test"
  });
  assert.equal(duplicate.status, 409);
});

test("returns 400 for invalid json", async () => {
  const res = await auth(request(app).post("/api/clients"))
    .set("Content-Type", "application/json")
    .send("{bad json");

  assert.equal(res.status, 400);
  assert.equal(res.body.message, "Invalid JSON in request body");
});

test("filters projects by client id", async () => {
  const all = await auth(request(app).get("/api/projects"));
  assert.equal(all.body.projects.length, 3);

  const res = await auth(request(app).get("/api/projects?clientId=1"));
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.projects.map((project) => project.id),
    [1, 3]
  );

  const invalid = await auth(request(app).get("/api/projects?clientId=abc"));
  assert.equal(invalid.status, 400);
});

test("deletes a client", async () => {
  const res = await auth(request(app).delete("/api/clients/2"));
  assert.equal(res.status, 200);

  const list = await auth(request(app).get("/api/clients"));
  assert.ok(!list.body.data.some((client) => client.id === 2));

  const again = await auth(request(app).delete("/api/clients/2"));
  assert.equal(again.status, 404);

  const invalid = await auth(request(app).delete("/api/clients/abc"));
  assert.equal(invalid.status, 400);
});

test("new client ids stay unique after a delete", async () => {
  const res = await auth(request(app).post("/api/clients")).send({
    name: "After Delete",
    email: "after@delete.test"
  });

  assert.equal(res.status, 201);

  const list = await auth(request(app).get("/api/clients"));
  const ids = list.body.data.map((client) => client.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(res.body.data.id, 4);
});

test("returns json 404 for unknown routes", async () => {
  const res = await request(app).get("/api/unknown");

  assert.equal(res.status, 404);
  assert.equal(res.body.message, "Route not found");
});

test("rate limits repeated failed logins", async () => {
  let status;

  for (let i = 0; i < 6; i++) {
    const res = await request(app)
      .post("/api/login")
      .send({ email: "admin@viek.test", password: "wrong" });
    status = res.status;
  }

  assert.equal(status, 429);
});
