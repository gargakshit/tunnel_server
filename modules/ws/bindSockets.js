// Rewritten in modern javascript
// Original Source: https://github.com/MDSLab/wstun/blob/master/lib/bindSockets_reverse.js

module.exports = (wsconn, tcpconn) => {
  wsconn.__paused = false;

  wsconn.on("message", (message) => {
    if (message.type === "utf8") {
      return console.info("Error, Not supposed to received message ");
    } else if (message.type === "binary") {
      if (tcpconn.write(message.binaryData) === false) {
        wsconn.socket.pause();
        wsconn.__paused = true;
        return "";
      } else {
        if (wsconn.__paused === true) {
          wsconn.socket.resume();
          return (wsconn.__paused = false);
        }
      }
    }
  });

  wsconn.on("overflow", () => {
    return tcpconn.pause();
  });

  wsconn.socket.on("drain", () => {
    return tcpconn.resume();
  });

  wsconn.on("error", (err) => {
    return console.info("[SYSTEM] --> WS Error: " + err);
  });

  wsconn.on("close", (reasonCode, description) => {
    return tcpconn.destroy();
  });

  tcpconn.on("drain", () => {
    wsconn.socket.resume();
    return (wsconn.__paused = false);
  });

  tcpconn.on("data", (buffer) => {
    return wsconn.sendBytes(buffer);
  });

  tcpconn.on("error", (err) => {
    console.info("[SYSTEM] --> TCP Error " + err);
    return tcpconn.destroy();
  });

  tcpconn.on("close", () => {
    return wsconn.close();
  });
};
