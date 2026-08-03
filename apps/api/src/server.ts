import app from "./app";
import http from "http"
import { env } from "./config/env";
import { createSocketServer } from "./lib/socket";

const PORT = env.PORT;

// http server
const server = http.createServer(app)

// attach socket.io connection
createSocketServer(server)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
