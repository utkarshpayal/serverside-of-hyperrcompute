// Lazy-load fetch
const fetchModule = (...args) =>
    import("node-fetch").then(({ default: fetch }) => fetch(...args));


/**
 * Start a Docker container
 * @param {string} imageName - Docker image name
 * @returns {Promise<string|null>} Container ID or null
 */
async function startDockerContainer(imageName) {
    try {
      const containerName = `gpu-container-${Date.now()}`;
      let fetch = await fetchModule;
      
      // Make a POST request to the Docker API to create a container
      const containerResponse = await fetch(
        "http://localhost:3000/containers",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: containerName,
            image: imageName,
          }),
        }
      );
  
      if (!containerResponse.ok) {
        throw new Error(`Failed to create container: ${containerResponse.status}`);
      }
  
      const data = await containerResponse.json();
      console.log(`[SUCCESS] Container started: ${data.message}`);
      return data.id;
    } catch (error) {
      console.error("[ERROR] Failed to start Docker container:", error.message);
      throw error;
    }
  }

  
  module.exports = { startDockerContainer };