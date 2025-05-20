## PREREQUISITES

| Tool        | Description                         |
| ----------- | ----------------------------------- |
| Node.js     | v16+                                |
| Docker      | Installed & running locally         |
| Web Browser | For terminal access via WebSocket   |

 
 
 # Holesail

[Join our Discord Support Server](https://discord.gg/TQVacE7Vnj) [Join our Reddit Community](https://www.reddit.com/r/holesail/)

To support the development of this project:

Lightning BTC: linenbird5@primal.net
BTC Address: 183Pfn4fxuMJMSvZXdBdYsNKWSnWHCdBdA

## Overview

Holesail is a truly peer-to-peer network tunneling and reverse proxy software that supports both TCP and UDP protocols.

Holesail lets you share any locally running application on a specific port with third parties securely and with a single command. No static IP or port forwarding required.


## Installation

Before using Holesail, make sure you have Node.js installed on your system. You can download Node.js from the official website: [https://nodejs.org/en/download/](https://nodejs.org/en/download/)

Once Node.js is installed, you can install Holesail Server using npm (Node Package Manager):

```
npm i holesail -g
```

## Quick Usage

To start a local Holesail Server, use the following command:

```
holesail --live <port>
```
Replace `port` with the desired port number you want to expose to the network.

This will give you a connection string to connect to, use that to access this server from anywhere:

```
holesail <connection-string> 
```

## All commands

To view full usage instructions and all set of commands, run:
```
holesail --help
```

## Graceful Goodbye

Holesail Server includes graceful goodbye functionality, which ensures that the server is properly shut down when you close the terminal or interrupt the process.

## Documentation

Documentation for Holesail can be found at https://docs.holesail.io/

## License

Holesail Server is released under the GPL-3.0 License. See the [LICENSE](https://www.gnu.org/licenses/gpl-3.0.en.html) file for more information.

## Contributing

Contributions are welcome! If you find any issues or have suggestions for improvements, please open an issue or submit a pull request.

## Acknowledgments

Holesail is built on and inspired by following open-source projects:

- hypertele: https://github.com/bitfinexcom/hypertele
- holepunch: https://holepunch.to


## INSTALL PACKAGES:
npm install

## RUN SERVER WITH IMAGE DETAILS

node demo-index.js --image ubuntu --time 10 --force --live --connector 89fd199803cd2aaf4b5cdba373a970a9e6a08f86547f26c24aae3efee062

*Includes image name,timestamp, status and connector id*

## EXPLANATION

Last code file to run, on successful running, you will receive the add-gpu form link, containing provider's JWT Token. Open the same , provide details and click on add.

On running , you will receive the holesail connection string. Open your Powershell/Mac
Terminal and paste: holesail  <connection-string> --port 8686

Now your client peer device is connected to the provider's peer device.

In the code file's terminal, you will receive the container-ID. Copy that ID, go to the frontend localhost> Terminal Tab> paste the container-ID >Check container status> If status shows "running" > click on 'Connect'> The provider's container's Terminal is now connected.

**🧩 Features**

🐳 *Docker Container Lifecycle Management*
Create, start, stop, remove containers using REST APIs.

📡 *WebSocket Terminal Access*
Real-time terminal interaction with running Docker containers.

🧠 *Tokenized GPU Registration*
Generates and registers containers using unique access tokens.

⚙️ *Client/Server CLI Modes*
Supports running as a client or host server via CLI arguments.

🔒 *IPv4 DNS Preference & Graceful Exit*
