const crypto = require("hypercore-crypto");
const argv = require("minimist")(process.argv.slice(2));

const pkg = require("../package.json");
const path = require("path");
const colors = require("colors/safe");

const fs = require("fs");
const os = require("os");
const jwt = require("jsonwebtoken");
const { parseArgs } = require("util");
const {
    PORT_TO_CONTAINER,
    CONTAINER_TO_PORT,
    PORT_RANGE,
    containerId,
  } = require("../globalData/global.js");
/**
 * Display version and exit
 */
function displayVersionAndExit() {
    console.log(pkg.version);
    process.exit(-1);
  }
  
  

/**
 * Display error for invalid arguments
 */
function displayError() {
    console.log(colors.red("Error: Invalid or Incorrect arguments specified. "));
    process.exit(2);
  }
  
  /**
   * Generate a new key for the server
   * @returns {Buffer} The generated key
   */
  function generateNewKey() {
    const newKey = crypto.randomBytes(32);
    if (fs.existsSync(".env")) {
      const envContent = fs.readFileSync(".env", "utf8");
      const updatedEnv = envContent
        .split("\n")
        .filter((line) => !line.startsWith("SERVER_KEY="))
        .concat(`SERVER_KEY=${newKey.toString("hex")}`)
        .join("\n")
        .trim();
      fs.writeFileSync(".env", `${updatedEnv}\n`);
    } else {
      fs.writeFileSync(".env", `SERVER_KEY=${newKey.toString("hex")}\n`);
    }
    
    console.log("[INFO] New SERVER_KEY saved to .env.");
    return newKey;
  }
  
  /**
   * Generate JWT token
   * @param {string} key - The key to encode in the token
   * @returns {string} The generated JWT token
   */
  function generateToken(key) {
    const payload = {
      key,
      timeInSeconds: getTimeArgument(),
    };
  
    return jwt.sign(payload, "secret", { expiresIn: "1h" });
  }
  
  /**
   * Get time argument from command line
   * @returns {number} Time in seconds
   */
  function getTimeArgument() {
    const args = process.argv.slice(2);
    const timeArgIndex = args.findIndex((arg) => arg === "--time");
    let timeInSeconds = 0;
  
    if (timeArgIndex !== -1 && args[timeArgIndex + 1]) {
      timeInSeconds = parseInt(args[timeArgIndex + 1], 10);
      if (isNaN(timeInSeconds) || timeInSeconds <= 0) {
        console.log("[ERROR] Invalid time argument. Please provide a valid number in seconds.");
        process.exit(1);
      }
    }
    
    return timeInSeconds;
  }
  
  /**
   * Get image argument from command line
   * @returns {string|null} Image name
   */
  function getImageArgument() {
    const args = process.argv.slice(2);
    const imageArgIndex = args.findIndex((arg) => arg === "--image");
    
    if (imageArgIndex !== -1 && args[imageArgIndex + 1] && !!argv.live) {
      return args[imageArgIndex + 1];
    }
    
    console.log("[ERROR] --image argument missing or invalid.");
    return null;
  }
  
  /**
   * Handle server key management
   * @returns {string} The key in hex format
   */
  function handleServerKey() {
    const args = process.argv.slice(2);
    const isNewKey = args.includes("--new");
    
    if (isNewKey && !!argv.live) {
      const newKey = generateNewKey();
      return newKey.toString("hex");
    } else {
      let keyHex = process.env.SERVER_KEY;
  
      if (!keyHex) {
        console.log("[INFO] No SERVER_KEY found in .env. Generating a new one...");
        const newKey = generateNewKey();
        return newKey.toString("hex");
      } else {
        console.log("[INFO] SERVER_KEY loaded from .env.");
        return keyHex;
      }
    }
  }


/**
 * Find an available port within range
 * @returns {string} Available port
 */
function findAvailablePort() {
    for (let port = PORT_RANGE.min; port <= PORT_RANGE.max; port++) {
      if (!PORT_TO_CONTAINER[port]) {
        return port.toString();
      }
    }
    throw new Error("No available ports in the specified range");
  }
  
  /**
   * Calculate CPU usage percentage
   * @param {Object} stats - Container stats
   * @returns {string} CPU usage percentage
   */
  function calculateCPUUsage(stats) {
    if (!stats || !stats.cpu_stats || !stats.precpu_stats) return "N/A";
  
    const cpuDelta =
      stats.cpu_stats.cpu_usage.total_usage -
      stats.precpu_stats.cpu_usage.total_usage;
    const systemDelta =
      stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  
    if (systemDelta > 0.0 && cpuDelta > 0.0) {
      return `${(
        (cpuDelta / systemDelta) *
        stats.cpu_stats.online_cpus *
        100
      ).toFixed(2)}%`;
    }
    return "0%";
  }

  module.exports = {
    calculateCPUUsage,
    findAvailablePort,
    displayVersionAndExit,
    displayError,
    generateNewKey,
    generateToken,
    getTimeArgument,
    getImageArgument,
    handleServerKey,
  };