# UptimeGuard

A small uptime monitoring and incident tracking tool, in the spirit of UptimeRobot and StatusPage. You give it URLs, it checks them on a schedule, stores every result, opens an incident when something stays down, and emails you. There's a React dashboard for the numbers and a public status page you can share.

I built it because I wanted a project that deals with real backend problems (scheduling, failure detection, alerting) and not just another CRUD app.

<!-- Add screenshots here: dashboard and status page -->

## What it does

- Add any HTTP/HTTPS URL as a monitor and pick how often it's checked (10 seconds or more)
- A Spring scheduler runs the checks in the background and saves each result to MySQL: status code, response time, and the error if it failed
- After 2 failed checks in a row, an incident is opened automatically
- When the service responds again, the incident is closed and a recovery email is sent
- Email alerts go out when a service goes down and when it comes back
- Dashboard shows 24h uptime %, average response time, a response-time chart for the last 100 checks, and the incident history
- Public status page at `/#/status` that shows service health without exposing URLs or alert emails
- Monitors can be paused, resumed and deleted

## Tech stack

| Part | Tech |
| --- | --- |
| Backend | Java 17, Spring Boot 3, Spring Data JPA, Spring Scheduling, Spring Mail |
| Database | MySQL 8 |
| Frontend | React 18, Vite, Recharts |
| Local dev | Docker Compose (MySQL and MailHog) |

## How it works

1. A scheduled job wakes up every 5 seconds and looks at all active monitors.
2. Any monitor whose interval has passed gets handed to a thread pool (10 workers), so one slow site doesn't hold up the others.
3. Each check sends a GET request with a 10 second timeout. A response below 400 counts as up. Anything else, including timeouts and connection errors, counts as down.
4. The result is saved, and the monitor's consecutive failure count is updated.
5. When the failure count reaches the threshold (default 2), the monitor is marked DOWN, an incident is opened, and an alert email is sent. Waiting for 2 failures avoids alerts from a single blip.
6. On the next successful check, the monitor goes back to UP, the open incident is resolved, and a recovery email is sent.

The frontend polls the API every 5 seconds, so the dashboard stays current without a refresh.

## Getting started

You need Java 17+, Maven, Node 18+ and Docker.

**1. Start MySQL and the test mail server**

```bash
docker compose up -d
```

MySQL runs on port 3306. MailHog catches outgoing emails, so you can read your alerts at http://localhost:8025 without setting up a real mail account.

**2. Run the backend**

```bash
cd backend
mvn spring-boot:run
```

The API runs on http://localhost:8080. Tables are created automatically on first start.

**3. Run the frontend**

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

## Try it out

1. Add a monitor for a site that's up, like `https://example.com`, with your email as the alert address.
2. Add a second monitor pointing at something that doesn't exist, like `http://localhost:9999`.
3. Wait about 20 seconds. The second monitor turns DOWN, an incident appears, and the alert shows up in MailHog.
4. Pause or delete the broken monitor, or point it at a working URL, to see the recovery flow.

## Configuration

Everything has a default for local development. Override with environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `DB_HOST` | `localhost` | MySQL host |
| `DB_USER` | `root` | MySQL user |
| `DB_PASS` | `root` | MySQL password |
| `MAIL_HOST` | `localhost` | SMTP host |
| `MAIL_PORT` | `1025` | SMTP port |
| `MAIL_USER` / `MAIL_PASS` | empty | SMTP credentials |
| `MAIL_AUTH` / `MAIL_TLS` | `false` | Set both to `true` for most real SMTP providers |
| `MAIL_FROM` | `alerts@uptimeguard.local` | Sender address |

The number of failed checks before an incident opens is `uptimeguard.failures-before-incident` in `application.properties`.

## API

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/api/monitors` | All monitors with 24h uptime and average response time |
| POST | `/api/monitors` | Create a monitor (`name`, `url`, `intervalSeconds`, `alertEmail`) |
| POST | `/api/monitors/{id}/toggle` | Pause or resume |
| DELETE | `/api/monitors/{id}` | Delete a monitor along with its results and incidents |
| GET | `/api/monitors/{id}/results` | Last 100 check results |
| GET | `/api/incidents` | Latest incidents |
| GET | `/api/status` | Public status data |

## Project structure

```
uptimeguard/
├── docker-compose.yml
├── backend/
│   ├── pom.xml
│   └── src/main/
│       ├── resources/application.properties
│       └── java/com/uptimeguard/
│           ├── UptimeGuardApplication.java
│           ├── Monitor.java, CheckResult.java, Incident.java    (entities)
│           ├── MonitorRepo.java, CheckRepo.java, IncidentRepo.java
│           ├── MonitorService.java    (scheduler, checks, incidents, alerts)
│           └── ApiController.java     (REST endpoints)
└── frontend/
    ├── package.json, vite.config.js, index.html
    └── src/
        ├── main.jsx
        ├── App.jsx        (dashboard and status page)
        └── styles.css
```

## Known limitations

- No user accounts yet. Everyone sees every monitor, so don't expose it publicly as-is.
- Monitors can target internal addresses (like localhost). A real deployment would need SSRF protection.
- Old check results are never deleted, so the table will keep growing.
- Only HTTP/HTTPS checks for now, with no TCP or ping.

## What I'd add next

- Login with Spring Security and JWT, with monitors belonging to each user
- A retention job that cleans up old check results
- Slack and webhook alerts
- Keyword checks (the page must contain some text) and expected status codes
- TCP port checks
- Uptime history over 7 and 30 days
- Tests for the incident detection logic

## License

MIT, or whatever you prefer. Add a LICENSE file before publishing.
