<div align="center">

# Rayva Cloud

### Distributed Cloud Computing & Cluster Management Platform

A secure, multi-user cloud simulation platform for job execution, intelligent scheduling, worker management, real-time monitoring, and tamper-evident execution tracking.

</div>

---

## Overview

**Rayva Cloud** is a distributed cloud computing platform designed to simulate and manage a multi-node compute cluster.

It provides a centralized dashboard for submitting computational jobs, monitoring worker nodes, selecting scheduling strategies, tracking execution, and analyzing cluster activity.

## Core Features

* 🔐 **Secure Authentication** — User accounts, sessions, password hashing, email verification, and role-based access.
* 👥 **Multi-User Isolation** — Each user has an independent job history and cannot access another user's jobs.
* ⚙️ **Job Execution** — Submit and monitor computational workloads across the cluster.
* 🧠 **Intelligent Scheduling** — Resource Aware, Round Robin, Least Loaded, Priority Driven, and Predictive scheduling strategies.
* 🖥️ **Worker Management** — Monitor four Rayva worker nodes and their resource utilization.
* 📊 **Real-Time Dashboard** — Cluster health, workload, worker status, scheduling activity, and execution metrics.
* 🔗 **Execution Ledger** — Tamper-evident tracking of completed executions.
* 📈 **Analytics** — Analyze workloads, worker performance, and cluster activity.
* 💾 **Persistent Storage** — SQLite-based persistent data storage with support for production persistent disks.
* 🛡️ **Production Security** — Rate limiting, protected API endpoints, ownership checks, secret management, and anti-enumeration protections.

## Worker Cluster

| Worker           | Node        |
| ---------------- | ----------- |
| **Rayva Titan**  | `worker-01` |
| **Rayva Vector** | `worker-02` |
| **Rayva Flux**   | `worker-03` |
| **Rayva Edge**   | `worker-04` |

## Job Types

Rayva Cloud supports computational workloads including:

* SHA-256 hashing
* Prime calculations
* Fibonacci calculations
* Array sorting
* Matrix multiplication
* Telemetry processing
* AI tensor inference

## Scheduling

The platform supports multiple scheduling strategies:

* Resource Aware
* Round Robin
* Least Loaded
* Priority Driven
* Predictive AI

## Technology Stack

* **Frontend:** React, TypeScript, Vite
* **Backend:** Node.js, Express
* **Database:** SQLite / sql.js
* **Styling:** Tailwind CSS
* **Communication:** REST API & WebSockets
* **Authentication:** PBKDF2 password hashing with session-based authentication

## Running Locally

### Requirements

* Node.js
* npm

### Install Dependencies

```bash
npm install
```

### Configure Environment Variables

Create a `.env` file using `.env.example` as a reference.

**Never commit `.env` or real credentials to the repository.**

### Start Development Server

```bash
npm run dev
```

## Production Deployment

Before deployment, configure the required environment variables on your hosting platform, including the administrator password and any required API or email service credentials.

For persistent production data, configure a persistent storage volume and set the appropriate `DATA_DIR`.

## Security

Rayva Cloud follows production-oriented security practices, including:

* Secure password hashing
* Cryptographically strong session tokens
* Role-based authorization
* Per-user job ownership
* API access control
* Rate limiting
* Password reset protection
* Email verification
* Secret isolation through environment variables
* Database persistence and recovery safeguards
* Anti-enumeration protections

**Never commit passwords, API keys, database files, `.env` files, or other secrets to Git.**

## Project Structure

```text
Rayva Cloud/
├── public/
├── scripts/
├── src/
│   ├── backend/
│   │   ├── api/
│   │   ├── database/
│   │   ├── email/
│   │   ├── jobs/
│   │   ├── ledger/
│   │   ├── monitoring/
│   │   ├── scheduler/
│   │   ├── security/
│   │   └── workers/
│   ├── components/
│   ├── context/
│   ├── shared/
│   └── utils/
├── server.ts
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## Deployment

Rayva Cloud can be deployed to a cloud hosting platform using the GitHub repository.

For production deployments:

1. Configure environment variables.
2. Configure persistent storage for the database.
3. Set `DATA_DIR` to the persistent storage location.
4. Configure required email/API services.
5. Deploy the production build.
6. Verify authentication, database persistence, job isolation, workers, scheduling, and API health after deployment.

## License

This project is currently maintained as a personal development project.

---

<div align="center">

**Rayva Cloud — Distributed Computing, Simplified.**

Made with ❤️ by **Abdul Rehman Yasir**

</div>
