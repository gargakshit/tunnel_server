// Code modified from: https://github.com/MDSLab/wstun/blob/master/lib/server_reverse.js

var logger = console;

var WebSocketServer, bindSockets, http, net, url, wst_server_reverse;

WebSocketServer = require("websocket").server;
http = require("http");
url = require("url");
net = require("net");
bindSockets = require("./bindSockets");

uuid = require("uuid");

logger.info("WSTUN STARTED!");

https_flag = null;

var eventEmitter = require("events").EventEmitter;
eventEmitter.prototype._maxListeners = 1000;

var newWSTCP_DATA = new eventEmitter();

wst_server_reverse = function (options) {
  if (options != undefined) {
    logger.info(
      "[SYSTEM] - WS Reverse Tunnel Server starting with these paramters:\n" +
        JSON.stringify(options, null, "\t")
    );
    this.dstHost = options.dstHost;
    this.dstPort = options.dstPort;

    https_flag = options.ssl;
  } else logger.info("[SYSTEM] - WS Reverse Tunnel Server starting...");

  if (https_flag == "true") {
    var https = require("https");
    var fs = require("fs");

    require("../lib/https_override");

    https_flag = options.ssl;

    try {
      this.s4t_key = fs.readFileSync(options.key, "utf8");
      this.s4t_cert = fs.readFileSync(options.cert, "utf8");
    } catch (err) {
      logger.info("[SYSTEM] --> ERROR: " + err);
      process.exit(1);
    }

    var credentials = {
      key: this.s4t_key,
      cert: this.s4t_cert,
    };

    this.httpServer = https.createServer(credentials, function (
      request,
      response
    ) {
      response.write("You discovered something lol!");
      response.end();
    });
  } else {
    logger.info("[SYSTEM] - WS Reverse Tunnel Server over HTTP.");
    this.httpServer = http.createServer(function (request, response) {
      response.write("You discovered something lol!");
      response.end();
    });
  }

  //create websocket
  this.wsServerForControll = new WebSocketServer({
    httpServer: this.httpServer,
    autoAcceptConnections: false,
  });
};

wst_server_reverse.prototype.start = function (port) {
  this.httpServer.listen(port, function () {
    logger.info("[SYSTEM] - WS Reverse Tunnel Server is listening...");
  });

  this.wsServerForControll.on(
    "request",
    (function (_this) {
      return function (request) {
        //Create one TCP server for each client WebSocketRequest
        request.tcpServer = new net.createServer();

        var uri = url.parse(request.httpRequest.url, true);

        var src_address = request.httpRequest.client._peername.address.split(
          ":"
        )[3];

        if (uri.query.dst != undefined) {
          var remoteAddr = uri.query.dst;
          ref1 = remoteAddr.split(":");
          var portTcp = ref1[1];

          request.tcpServer.listen(portTcp);

          request.wsConnectionForControll = request.accept(
            "tunnel-protocol",
            request.origin
          );

          request.wsConnectionForControll.on("close", function (
            reasonCode,
            description
          ) {
            request.tcpServer.close();
          });
        } else {
          newWSTCP_DATA.emit("created", request);
        }

        request.tcpServer.on("error", function (message) {
          if (message.code == "EADDRINUSE") {
            logger.info(
              "[SYSTEM] - Error - Port " +
                message.port +
                " already used: connection aborted."
            );
            request.wsConnectionForControll.close();
          } else logger.info("[SYSTEM] - Error establishing TCP connection: " + message);
        });

        request.tcpServer.on(
          "connection",
          (function (_this) {
            return function (tcpConn) {
              tcpConn.wsConnection;
              tcpConn.pause();
              var idConnection = uuid.v4();
              var msgForNewConnection = "NC:" + idConnection;

              request.wsConnectionForControll.sendUTF(msgForNewConnection);

              var EventManager = (function (_this) {
                return function (request) {
                  try {
                    var uri = url.parse(request.httpRequest.url, true);

                    if (idConnection == uri.query.id) {
                      //tcpConn.wsConnection = wsTCP;
                      tcpConn.wsConnection = request.accept(
                        "tunnel-protocol",
                        request.origin
                      );
                      bindSockets(tcpConn.wsConnection, tcpConn);
                      tcpConn.resume();
                      newWSTCP_DATA.removeListener("created", EventManager);
                    }
                  } catch (err) {
                    logger.info("[SYSTEM] --> ERROR: " + err);
                    request.tcpServer.close();
                    newWSTCP_DATA.removeListener("created", EventManager);
                  }
                };
              })(this);

              newWSTCP_DATA.on("created", EventManager);
            };
          })(_this)
        );
      };
    })(this)
  );
};

module.exports = wst_server_reverse;
