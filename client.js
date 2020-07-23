const client = require("./modules/ws/client");

const reverse_client = new client();
const wstunHost = "ws://localhost:5001";

reverse_client.start(44926, wstunHost, "localhost:5000");
