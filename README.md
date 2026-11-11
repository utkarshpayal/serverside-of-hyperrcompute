# serverside-of-hyperrcompute

Provider-side agent for a peer-to-peer GPU/compute sharing setup. It is built on top of
[Holesail](https://github.com/holesail/holesail) (a HyperDHT-based TCP/UDP peer-to-peer proxy —
`package.json` still carries the upstream `holesail` name, version and GPL-3.0 license) and adds:

- a Docker management HTTP API (Express + [dockerode](https://github.com/apocas/dockerode)) on port `3000`,
- a WebSocket terminal that attaches an interactive `/bin/bash` session to the active container,
- a "register GPU" step that signs a JWT token and posts it to a registration service, then launches a container from a given image.

## How it works

The entry point is `demo-index.js` (note: `package.json` `main`/`bin` still point to `index.js`, which does not exist in this repo).

When started with `--live`:

1. A `SERVER_KEY` is loaded from the environment, or a new 32-byte key is generated and written to `.env` (`--new` forces a new key).
2. A Holesail server is started over HyperDHT, exposing local port `3000` (see `includes/server.js`).
3. A JWT is generated from `--connector` (and optional `--time`), and `apis/registerGPU.js` POSTs it to a registration service expected on `localhost:8282` (`/add-gpu`).
4. If registration succeeds and `--image` was given, `apis/startDockerContainer.js` asks the local Docker API (`POST /containers`) to pull the image and start a container.
5. The Docker management server (HTTP + WebSocket) listens on port `3000`.

Without `--live`, passing a connection string (`--connect <key>` or as the first argument) starts a Holesail client that forwards the remote service to a local port (default `127.0.0.1:30000`).

## Tech stack

- Node.js (with partial [Bare](https://github.com/holepunchto/bare) / Pear runtime support inherited from Holesail)
- `holesail-server`, `holesail-client`, `hyperdht`, `hypercore-crypto`
- Express, `ws`, `dockerode`, `jsonwebtoken`, `minimist`

## Requirements

- Node.js
- Docker, with the socket available at `/var/run/docker.sock` (used directly by `dockerode`)
- For `--live` registration: a service listening on `localhost:8282` that implements `POST /add-gpu` (not part of this repo — needs confirmation which service provides it)

## Installation

```bash
npm install
```

## Usage

Start in provider (server) mode, register, and launch a container:

```bash
node demo-index.js --live --connector <connector> --image <docker-image> [--time <seconds>] [--new] [--udp] [--public]
```

Connect to a remote provider as a client:

```bash
node demo-index.js <connection-string> [--port 30000] [--host 127.0.0.1] [--udp]
```

Print the version:

```bash
node demo-index.js --version
```

## Docker management API (port 3000)

| Method | Path | Description |
| --- | --- | --- |
| GET | `/containers` | List all containers with their mapped port |
| GET | `/status?id=<id>` | Container details, memory and CPU usage |
| POST | `/containers` | Body `{ name, image }` — pull the image and start a container on a free port in the 8001–9000 range |
| POST | `/containers/stop` | Body `{ id }` — stop a container |
| DELETE | `/containers/remove` | Body `{ id }` — remove a container |
| POST | `/containers/stop-all` | Stop all containers |
| DELETE | `/containers/remove-all` | Remove all containers |
| GET | `/containers/logs?id=<id>` | Fetch container logs |
| GET | `/containers/ports` | Current port-to-container mappings |

A WebSocket connection to the same server opens a `/bin/bash` exec session in the most recently started container.

> The API has no authentication and CORS is open; only run it on trusted hosts.

## Configuration

| Variable | Description |
| --- | --- |
| `SERVER_KEY` | Hex-encoded 32-byte server key. Generated and written to `.env` if missing. The code reads `process.env.SERVER_KEY` but does not load `.env` itself (no `dotenv`), so it must be exported in the environment to be reused (needs confirmation). |

Do not commit `.env`; it contains the server key.

## Scripts

| Script | Description |
| --- | --- |
| `npm run refresh` | Remove `node_modules` and `package-lock.json`, reinstall and update dependencies |

There is no working test suite (`npm test` is self-referential).

## Builds

`.github/workflows/build.yml` packages standalone binaries with [`pkg`](https://github.com/vercel/pkg) (Node 16) for Linux, macOS and Windows on every push.

## Project structure

```
demo-index.js          Entry point: CLI parsing, Holesail server/client, Docker API, WebSocket terminal
apis/                  GPU registration and container start helpers
includes/              Holesail server/client wrappers, input validation, help text, file manager
utils/utils.js         Key management, JWT generation, CLI argument helpers, port allocation
globalData/global.js   In-memory port/container maps and port range
```

## License

Inherited from upstream Holesail: GPL-3.0 (per `package.json`).
