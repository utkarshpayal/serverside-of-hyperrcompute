const {startDockerContainer} = require("./startDockerContainer");

// Lazy-load fetch
const fetchModule = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));
/**
 * Register GPU with remote service
 * @param {string} hexcode - The JWT token
 * @param {string} imageName - Docker image name
 * @returns {Promise<string|null>} Container ID or null
 */
async function registerGPU(hexcode, imageName) {
    try {
      let fetch = await fetchModule;
      const response = await fetch("http://localhost:8282/add-gpu", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ hexcode: hexcode }),
      });
  console.log(response, "res")
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
  
      const responseData = await response.json();
      console.log("Click on this link to add GPU", responseData.url);
  
      if (response.status === 200) {
        console.log("[INFO] Received valid response, starting Docker container...");
        return await startDockerContainer(imageName);
      } else {
        console.log("[INFO] Invalid response received, not starting Docker container");
        return null;
      }
    } catch (error) {
      console.error("Error occurred:", error);
      return null;
    }
  }

  module.exports = { registerGPU };