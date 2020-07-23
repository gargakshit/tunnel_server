// Code modified from: https://github.com/MDSLab/wstun/blob/master/lib/client_reverse.js

var logger = console;

var WebSocketClient = require("websocket").client;
var net = require("net");

var bindSockets = require("./bindSockets");

wst_client_reverse = function () {
  this.wsClientForControll = new WebSocketClient();
};

wst_client_reverse.prototype.start = function (
  portTunnel,
  wsHostUrl,
  remoteAddr
) {
  //Getting paramiters
  var url = require("url");
  var urlWsHostObj = url.parse(wsHostUrl);
  var _ref1 = remoteAddr.split(":"),
    remoteHost = _ref1[0],
    remotePort = _ref1[1];

  var proto = wsHostUrl.split(":")[0];
  if (proto == "wss") require("../lib/https_override");

  url = "" + wsHostUrl + "/?dst=" + urlWsHostObj.hostname + ":" + portTunnel;

  //Connection to Controll WS Server
  this.wsClientForControll.connect(url, "tunnel-protocol");

  this.wsClientForControll.on(
    "connect",
    (function (_this) {
      return function (wsConnectionForControll) {
        wsConnectionForControll.on("message", function (message) {
          //Only utf8 message used in Controll WS Socket
          var parsing = message.utf8Data.split(":");

          //Managing new TCP connection on WS Server
          if (parsing[0] === "NC") {
            //Identification of ID connection
            var idConnection = parsing[1];

            this.wsClientData = new WebSocketClient();
            this.wsClientData.connect(
              wsHostUrl + "/?id=" + idConnection,
              "tunnel-protocol"
            );

            this.wsClientData.on(
              "connect",
              (function (_this) {
                return function (wsConnectionForData) {
                  wsConnectionForData.socket.pause();

                  tcpConnection(wsConnectionForData, remoteHost, remotePort);
                };
              })(this)
            );
          }
        });
      };
    })(this)
  );

  //Management of WS Connection failed
  this.wsClientForControll.on("connectFailed", function (error) {
    logger.info("[SYSTEM] --> WS connect error: " + error.toString());
  });
};

function tcpConnection(wsConn, host, port) {
  var tcpConn = net.connect({ port: port, host: host }, function () {});
  bindSockets(wsConn, tcpConn);

  tcpConn.on("connect", function () {
    //Resume of the WS Socket after the connection to WS Server
    wsConn.socket.resume();
  });

  tcpConn.on(
    "error",
    (function (_this) {
      return function (request) {
        logger.info("[SYSTEM] --> " + request);
      };
    })(this)
  );

  //wst_client_reverse
}

module.exports = wst_client_reverse;
