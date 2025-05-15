#!/usr/bin/env node
const { runtime } = require("which-runtime");
runtime === "bare" && (process = require("bare-process"));
const argv = require("minimist")(process.argv.slice(2));
const goodbye = require("graceful-goodbye");
const dns = require("dns");
const express = require("express");
const Docker = require("dockerode");
const WebSocket = require("ws");
const http = require("http");
const cors = require("cors");
const {
  PORT_TO_CONTAINER,
  CONTAINER_TO_PORT,
  PORT_RANGE,
  containerId,
} = require("./globalData/global.js");
const  {
  displayVersionAndExit,
  calculateCPUUsage,
  findAvailablePort,
  displayError,
  generateNewKey,
  generateToken,
  getTimeArgument,
  getImageArgument,
  handleServerKey,
} = require("./utils/utils.js");
const {registerGPU} = require("./apis/registerGPU");
let port2;
// Set DNS resolution order to prefer IPv4
dns.setDefaultResultOrder("ipv4first");

// Lazy-load fetch
const fetchModule = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Require all necessary files
const Client = require("./includes/client.js");
const Server = require("./includes/server.js");
const { ValidateInput } = require("./includes/validateInput.js");

/**
 * Initialize the application
 */
function init() {
  // Validate every input and throw errors if incorrect input
  const validator = new ValidateInput(argv);
  const key_data = argv.connector;
  
  // Handle command line arguments
  if (argv.version) {
    displayVersionAndExit();
  }  else if (argv.live) {
    startServer();
  } else if (argv.connect || argv._[0]) {
    startClient();
  } else {
    displayError();
  }
  
  // Start the Docker management server if in live mode
  if (argv.live) {
    setupDockerServer();
  }
}

/**
 * Start server mode
 */
function startServer() {
  const options = {
    port: 3000,
    host: "127.0.0.1",
    connector: argv.connector,
    public: argv.public,
    service: "Server",
    udp: argv.udp,
  };
  const server = new Server(options);
  server.start();
  goodbye(async () => {
    await server.destroy();
  });
}

/**
 * Start client mode
 */
function startClient() {
  const keyInput = argv.connect || argv._[0];
  const options = {
    port: argv.port || 30000,
    host: argv.host || "127.0.0.1",
    connector: argv.connector,
    udp: argv.udp,
  };
  const client = new Client(keyInput, options);
  client.start();
}



/**
 * Run the application with key management and GPU registration
 */
async function runApp() {
  const keyHex = handleServerKey();
  const topic = Buffer.from(keyHex, "hex");
  const key = `${topic.toString("hex")}`;
  
  if (!!argv.live) {
    const hexcode = generateToken(argv.connector);
    console.log("[INFO] Generated token:", hexcode);
    
    const imageName = getImageArgument();
    if (imageName) {
      const containerId = await registerGPU(hexcode, imageName);
      if (containerId) {
        console.log(`[INFO] Container started with ID: ${containerId}`);
      }
    }
  }
  
  console.log(`[INFO] Server started`);
  
  const timeInSeconds = getTimeArgument();
//   if (timeInSeconds > 0) {
//     console.log(`[INFO] Timer started. Server will shut down in ${timeInSeconds} seconds.`);
//     setTimeout(() => {
//       console.log("[INFO] Time limit reached. Shutting down server.");
//       // Assuming swarm is defined elsewhere in the code
//       // swarm.destroy();
//       process.exit(0);
//     }, timeInSeconds * 1000);
//   }
}


/**
 * Stop and remove a container if it exists
 * @param {string} name - Container name
 * @returns {Promise<void>}
 */
async function stopAndRemoveContainer(name) {
  try {
    const docker = new Docker({ socketPath: "/var/run/docker.sock" });
    const containers = await docker.listContainers({ all: true });
    const existingContainer = containers.find((c) => c.Names[0] === `/${name}`);

    if (existingContainer) {
      console.log(`Container '${name}' exists. Stopping and removing...`);
      const container = docker.getContainer(existingContainer.Id);
      const port = CONTAINER_TO_PORT[existingContainer.Id];

      try {
        await container.stop();
        console.log(`Stopped container: ${name}`);
      } catch (error) {
        if (error.statusCode !== 304) {
          console.error(`Error stopping container '${name}':`, error.message);
          return;
        }
      }

      await container.remove();
      console.log(`Removed container: ${name}`);

      if (port) {
        delete PORT_TO_CONTAINER[port];
        delete CONTAINER_TO_PORT[existingContainer.Id];
      }
    } else {
      console.log(`Container '${name}' not found.`);
    }
  } catch (error) {
    console.error(`Error stopping/removing container '${name}':`, error.message);
  }
}

/**
 * Setup Express routes for Docker management
 * @param {express.Application} app - Express application
 * @param {Docker} docker - Docker instance
 */
function setupExpressRoutes(app, docker) {
  // List all containers
  app.get("/containers", async (req, res) => {
    try {
      console.log("Fetching list of all containers...");
      const containers = await docker.listContainers({ all: true });

      console.log(`Found ${containers.length} containers.`);
      port2 = CONTAINER_TO_PORT[containers.Id];
      res.json({
        containers: containers.map((container) => ({
          id: container.Id,
          name: container.Names[0].replace("/", ""),
          image: container.Image,
          port: CONTAINER_TO_PORT[container.Id] || "N/A",
        })),
      });
    } catch (error) {
      console.error("Error fetching containers:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get container status and details
  app.get("/status", async (req, res) => {
    try {
      const { id } = req.query;
      if (!id) return res.status(400).json({ error: "Container ID is required" });

      const container = docker.getContainer(id);
      const details = await container.inspect();

      const statsStream = await container.stats({ stream: false });
      const containerInfo = {
        id: details.Id,
        name: details.Name.replace("/", ""),
        image: details.Config.Image,
        status: details.State.Status,
        created: details.Created,
        ip: details.NetworkSettings.IPAddress || "N/A",
        memory: `${(statsStream.memory_stats.usage / 1024 / 1024).toFixed(2)} MB`,
        cpu: calculateCPUUsage(statsStream),
      };

      res.json(containerInfo);
    } catch (error) {
      console.error("Error fetching container status:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Create a new container
  app.post("/containers", async (req, res) => {
    try {
      const { name, image } = req.body;
      console.log(image, name);
      if (!image) {
        return res.status(400).json({ error: "Image is required" });
      }

      console.log(`Creating container '${name}' with image '${image}'...`);
      await stopAndRemoveContainer(name);

      console.log(`Pulling image '${image}', this may take a moment...`);
      await new Promise((resolve, reject) => {
        docker.pull(image, (err, stream) => {
          if (err) return reject(err);
          docker.modem.followProgress(stream, resolve);
        });
      });

      console.log(`Image '${image}' pulled successfully.`);

      const hostPort = findAvailablePort();
      PORT_TO_CONTAINER[hostPort] = true;
      console.log(`Assigning port ${hostPort} to container '${name}'...`);

      const container = await docker.createContainer({
        Image: image,
        name,
        Cmd: [
          "/bin/sh",
          "-c",
          "apt update && apt install -y nginx",
        ],
        AttachStdout: true,
        Tty: true,
        ExposedPorts: { [hostPort] : {} },
        HostConfig: { PublishAllPorts: true },
      });
console.log("above start")
      await container.start();
      global.containerId = container.id;
      console.log(`Container '${name}' started successfully on port ${hostPort}.`);

      PORT_TO_CONTAINER[hostPort] = container.id;
      CONTAINER_TO_PORT[container.id] = hostPort;

      res.json({
        message: `Container '${name}' started on port ${hostPort}: ${container.id}`,
        id: container.id,
      });
    } catch (error) {
      console.error("Error creating container:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop a container
  app.post("/containers/stop", async (req, res) => {
    try {
      const { id } = req.body;
      console.log(`Stopping container: ${id}...`);

      const container = docker.getContainer(id);
      await container.stop();
      console.log(`Container ${id} stopped.`);

      const port = CONTAINER_TO_PORT[id];
      if (port) delete PORT_TO_CONTAINER[port];

      res.json({ message: `Container ${id} stopped.` });
    } catch (error) {
      console.error("Error stopping container:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove a container
  app.delete("/containers/remove", async (req, res) => {
    try {
      const { id } = req.body;
      console.log(`Removing container: ${id}...`);

      const container = docker.getContainer(id);
      const containerInfo = await container.inspect();

      if (containerInfo.State.Running) {
        console.log(`Container ${id} is running. Stopping it first...`);
        await container.stop();
        console.log(`Container ${id} stopped.`);
      } else {
        console.log(`Container ${id} is already stopped.`);
      }

      await container.remove();
      console.log(`Container ${id} removed.`);

      const port = CONTAINER_TO_PORT[id];
      if (port) {
        delete PORT_TO_CONTAINER[port];
        delete CONTAINER_TO_PORT[id];
      }

      res.json({ message: `Container ${id} removed.` });
    } catch (error) {
      console.error("Error removing container:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Stop all containers
  app.post("/containers/stop-all", async (req, res) => {
    try {
      console.log("Stopping all running containers...");
      const containers = await docker.listContainers({ all: false });

      if (containers.length === 0) {
        console.log("No running containers found.");
        return res.json({ message: "No running containers found." });
      }

      for (const containerInfo of containers) {
        const container = docker.getContainer(containerInfo.Id);
        await container.stop();
        console.log(`Stopped container: ${containerInfo.Id}`);

        const port = CONTAINER_TO_PORT[containerInfo.Id];
        if (port) delete PORT_TO_CONTAINER[port];
      }

      res.json({ message: "All running containers stopped." });
    } catch (error) {
      console.error("Error stopping all containers:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Remove all containers
  app.delete("/containers/remove-all", async (req, res) => {
    try {
      console.log("Removing all containers...");
      const containers = await docker.listContainers({ all: true });

      if (containers.length === 0) {
        console.log("No containers found.");
        return res.json({ message: "No containers found." });
      }

      for (const containerInfo of containers) {
        const container = docker.getContainer(containerInfo.Id);
        try {
          await container.stop();
          console.log(`Stopped container: ${containerInfo.Id}`);
        } catch (err) {
          console.log(`Skipping stop for ${containerInfo.Id}, might not be running.`);
        }
        await container.remove();
        console.log(`Removed container: ${containerInfo.Id}`);

        const port = CONTAINER_TO_PORT[containerInfo.Id];
        if (port) {
          delete PORT_TO_CONTAINER[port];
          delete CONTAINER_TO_PORT[containerInfo.Id];
        }
      }

      res.json({ message: "All containers removed." });
    } catch (error) {
      console.error("Error removing all containers:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get container logs
  app.get("/containers/logs", async (req, res) => {
    try {
      const { id } = req.query;
      console.log(`Fetching logs for container: ${id}...`);

      const container = docker.getContainer(id);
      const logs = await container.logs({ stdout: true, stderr: true });

      console.log(`Logs retrieved for container: ${id}`);
      res.json({ logs: logs.toString() });
    } catch (error) {
      console.error("Error fetching logs:", error.message);
      res.status(500).json({ error: error.message });
    }
  });

  // Get port mappings
  app.get("/containers/ports", async (req, res) => {
    console.log("Fetching port mappings...");
    res.json({
      port_to_container: PORT_TO_CONTAINER,
      container_to_port: CONTAINER_TO_PORT,
    });
  });
}

/**
 * Setup WebSocket for terminal access
 * @param {WebSocket.Server} wss - WebSocket server
 * @param {Docker} docker - Docker instance
 */
function setupWebSocket(wss, docker) {
  wss.on("connection", (ws, req) => {
    if (!containerId) {
      ws.send("No active container.");
      ws.close();
      return;
    }

    const container = docker.getContainer(containerId);
    container.exec(
      {
        AttachStdin: true,
        AttachStdout: true,
        AttachStderr: true,
        Tty: true,
        Cmd: ["/bin/bash"],
      },
      (err, exec) => {
        if (err) {
          console.error("Exec error:", err);
          ws.close();
          return;
        }

        exec.start({ hijack: true, stdin: true }, (err, stream) => {
          console.log("Terminal connected.", containerId);
          if (err) {
            console.error("Stream error:", err);
            ws.close();
            return;
          }

          ws.on("message", (msg) => stream.write(msg));
          stream.on("data", (chunk) => ws.send(chunk.toString()));
        });
      }
    );
  });
}

/**
 * Setup Docker management server
 */
function setupDockerServer() {
  const app = express();
  const server = http.createServer(app);
  const wss = new WebSocket.Server({ server });
  const docker = new Docker({ socketPath: "/var/run/docker.sock" });
  
  app.use(cors());
  app.use(express.json());
  
  setupExpressRoutes(app, docker);
  setupWebSocket(wss, docker);
  
  server.listen(3000, () => {
    console.log("Docker Management Server running on port 3000.");
  });
}

// Main execution
runApp();
init();