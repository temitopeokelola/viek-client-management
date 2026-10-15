# VIEK Client Management

A small client management app with a React (Vite) frontend and an Express API. This repo has my fixes for the debugging assessment and the report on what I found.

## Setup

You need Node.js 20.12 or newer. I used Node 24.

Start the backend:

```
cd server
npm install
npm start
```

It runs on http://localhost:4000.

Start the frontend in a second terminal:

```
cd client
npm install
npm run dev
```

It runs on http://localhost:5173.

Login details:

- Email: admin@viek.test
- Password: password123

### Environment variables

The server reads these from the environment, or from `server/.env` if the file exists. See `server/.env.example`.

- `JWT_SECRET` is the secret used to sign login tokens. If it is not set, the server makes a random one at startup, so you have to log in again after a restart.
- `CLIENT_ORIGIN` is the frontend origin allowed by CORS. It defaults to http://localhost:5173.
- `PORT` defaults to 4000.

### Running the tests

```
cd server
npm test

cd client
npm test
```

## Bugs Identified

Frontend and API communication:

1. The page was blank on load with "React is not defined" in the console.
2. After login the page crashed with "Cannot read properties of undefined (reading 'map')".
3. After that was fixed, it crashed on `clients.length` because the client list was undefined.
4. Adding a client always failed with "Name and email are required", even with both fields filled in.
5. There was no way to log out. A bad or expired token in localStorage left a blank page, and the user had no way to recover.
6. Network errors and non-JSON responses were not handled, so a failed request threw an uncaught error.
7. Every change to the project filter also re-fetched the client list.
8. If you deleted the client selected in the project filter, the dropdown fell back to "All Clients" but the list still showed the deleted client's projects.
9. There were no loading states. "No clients found." showed while the first request was still running, and an empty project list showed nothing at all.

Backend and data handling:

10. Deleting a client always returned 404 "Client not found".
11. Filtering projects by client always returned an empty list.
12. New client ids came from `clients.length + 1`, so after a delete a new client could get the same id as an existing one. Deleting that id then removed both clients.
13. Invalid JSON returned a 500 with the raw parser error message.
14. Unknown routes returned Express's default HTML page instead of JSON.
15. There was no real input validation. `{"name": 123, "email": "not-an-email"}` was accepted and saved.

Authentication and security:

16. The login response included the user's password.
17. The password was stored in plain text in the server code.
18. The token was a hardcoded string, `demo-token`. Anyone who read the code could use the API without logging in, and tokens never expired.
19. CORS allowed every origin.
20. There was no limit on login attempts.
21. The login form came prefilled with the admin email and password, so the password shipped in the frontend bundle.

## Root Causes

1. There was no `vite.config.js`, so `@vitejs/plugin-react` was installed but never loaded. Without it, esbuild compiles JSX to `React.createElement`, and `App.jsx` never imports `React`.
2. `projects` started as `useState()`, so it was `undefined` on the first render when `projects.map` ran.
3. The API returns clients under `data`, but the frontend read `result.clients`.
4. The add-client request sent a JSON body with no `Content-Type: application/json` header. `express.json()` skipped it and `req.body` was empty.
5. `localStorage` kept the token, but nothing removed it. A 401 response was treated like a successful one.
6. The fetch calls had no `try/catch` and called `response.json()` without checking the response.
7. One `useEffect` loaded both clients and projects and depended on `selectedClient`.
8. Nothing reset `selectedClient` when its client was deleted.
9. No loading state was tracked.
10. `req.params.id` is a string and client ids are numbers, so `client.id !== id` was always true and nothing was removed.
11. Same problem with `req.query.clientId`, which is a string compared with `===` against a number.
12. Using the array length as the next id only works if nothing is ever deleted.
13. The error handler sent `err.message` with status 500 for every error, including the body parser's 400 errors.
14. There was no fallback route handler.
15. The route only checked that `name` and `email` were truthy.
16. The route sent back the whole user object.
17 to 21. These were shortcuts in the starter code: plain-text credentials, a static token, the `cors()` defaults, and no rate limiting.

## Solutions

I made one commit per fix, so `git log` shows each change on its own.

- Added `client/vite.config.js` that loads the React plugin.
- Initialised `projects` as an empty array.
- Read clients from `result.data`, which matches the API.
- Sent the JSON content type header on requests with a body.
- Converted route and query ids to numbers before comparing them. Ids that are not positive integers now get a 400.
- Added a `nextClientId` counter that only ever goes up, so ids are never reused.
- The error handler now returns 400 for invalid JSON and 413 for bodies over 10kb. Other errors return a generic 500, and the details are logged on the server.
- Added a JSON 404 handler for unknown routes.
- The add-client route now checks that name and email are strings. It trims them, lowercases the email, checks the email format and length, and limits the name to 100 characters. It also rejects an email that already exists, with a 409.
- Login only returns `id`, `name` and `email`.
- The demo password is stored as a bcrypt hash and checked with `bcrypt.compare`.
- Login returns a JWT signed with `JWT_SECRET` that expires after one hour. The auth middleware verifies it.
- CORS only allows `CLIENT_ORIGIN`.
- Login is limited to 5 failed attempts per 15 minutes per IP, using `express-rate-limit`. Successful logins don't count.
- Removed the prefilled credentials from the login form.
- Added a logout button. All API calls in the frontend go through one `apiRequest` helper. It catches network errors, handles non-JSON responses, shows the server's error message, and on a 401 clears the token and returns to the login screen with a message.
- Split the effect so changing the filter only reloads projects.
- The filter resets to "All Clients" when the selected client is deleted.
- Added loading text for clients and projects, a "No projects found." message, and disabled the submit buttons while a request is running.

New dependencies: `bcryptjs`, `jsonwebtoken` and `express-rate-limit` on the server. `supertest`, `vitest`, `jsdom` and Testing Library are dev dependencies only. To read `.env` I used Node's built-in `process.loadEnvFile()` instead of adding dotenv.

## Testing

First I reproduced every bug against the running app. I used curl for the API and a headless Chrome script for the UI, which logged in, added, deleted, filtered and logged out while recording page errors and API responses. After each fix I ran the same request or flow again to confirm it was fixed.

Then I added automated tests.

- `server/server.test.js` uses `node:test` and supertest. It covers login, password not being returned, wrong password, missing and old tokens, listing, adding and deleting clients, validation errors, duplicate emails, invalid JSON, project filtering, id uniqueness after a delete, the JSON 404 and the login rate limit. That's 12 tests.
- `client/src/App.test.jsx` uses Vitest and React Testing Library with a mocked `fetch`. It covers login, a failed login, listing clients and projects, adding a client (including the content type header), deleting a client, filtering projects, a rejected token returning to login, a network error and logout. That's 8 tests.

To check the tests actually catch the bugs, I put a few of the old lines back one at a time and ran the tests. These were the `clients.length + 1` id, the string `clientId` comparison and `result.clients`, and each one made the matching tests fail. I also noticed the id test only works if delete works, because with the old delete nothing was ever removed.

At the end I did a fresh install in both folders, ran both test suites and did a full manual run in the browser. The run covered an empty login form, a wrong password, login, adding a client, a duplicate email, filtering, deleting the selected client, a reload keeping the session, a tampered token sending me back to login, and logout. I also ran `vite build` to make sure the production build works.

## Security

What I fixed is listed above: no password in responses, a hashed password, signed tokens that expire, a secret from the environment, restricted CORS, input validation, a body size limit, login rate limiting, no internal error messages sent to the client, and handling of 401s in the UI.

What I would still change for production:

- The token is kept in localStorage, which any script running on the page can read. An httpOnly, secure cookie with CSRF protection would be safer.
- Users and clients live in memory. A real app needs a database and user accounts instead of one hardcoded user.
- `JWT_SECRET` must be set to a long random value. The random fallback is only for local use.
- The rate limiter keeps its counts in memory, so they reset on restart and aren't shared between server instances. A shared store like Redis would fix that.
- It should run over HTTPS. I'd also add security headers (for example with helmet) and request logging.
- There's no token revocation, so logout only removes the token from the browser.

React escapes the values it renders, so client names can't inject HTML into the page.

## Reflection

The issue that took the most investigation was the blank page at startup, because it was really three bugs stacked on top of each other. The first error was "React is not defined", which I traced to the missing Vite config: the transformed `App.jsx` served by Vite used `React.createElement` without importing React. Once the plugin was loaded, the page rendered but crashed on `projects.map`. After that came `clients.length`. Each fix uncovered the next crash, so I had to keep re-running the app after every change instead of assuming one fix solved it. The last one turned out to be the response shape mismatch (`data` vs `clients`), which I confirmed by comparing the curl output with what the frontend read.

My general approach was:

- Reproduce the problem against the running app with curl or the browser script, and save the output.
- Narrow it down to the line or request involved.
- Work out why it happens.
- Make the smallest fix for that cause.
- Retest the same case, then run the full flow again to check nothing else broke.

Once the fixes were in, I wrote tests for them and checked that the tests fail when the bug is put back.

One thing is left open on purpose. When a client is deleted, their projects stay in the project list with a client id that no longer exists. The brief doesn't say whether projects should be deleted with the client or whether deleting a client with projects should be blocked, so I didn't pick one. The other items under Security are improvements for production rather than bugs in this app. I don't know of any other unresolved issues.
