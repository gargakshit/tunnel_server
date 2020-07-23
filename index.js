require("dotenv").config();
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const random = require("crypto-random-string");

const { redis } = require("./redis");
const server = require("./modules/ws/server");

const reverseServer = new server();
const app = express();

app.use(express.json());

app.post("/", async (req, res) => {
  const sub = random({
    length: 8,
    type: "hex",
  });

  const key = random({
    length: 64,
    type: "hex",
  });

  const port = Math.ceil(5000 * Math.random()) + 40000;

  await redis.set(
    `tunnel:sub:${sub}`,
    JSON.stringify({
      key,
      port,
    }),
    "EX",
    `${60 * 60}`
  );

  return res.json({
    sub,
    key,
    port,
  });
});

app.delete("/", async (req, res) => {
  const { key, sub } = req.body;

  if (!key || !sub) {
    return res.status(400).send("Bad Request");
  }

  const data = await redis.get(`tunnel:sub:${sub}`);

  if (!data) {
    return res.status(404).send("Not Found");
  }

  if (JSON.parse(data).key !== key) {
    return res.status(401).send("Unauthorized");
  }

  await redis.del(`tunnel:sub:${sub}`);

  return res.send("OK");
});

app.use("*", async (req, res, next) => {
  res.removeHeader("X-Powered-By");
  const hostname = req.hostname;
  const sub = hostname.split(".")[0];
  const data = await redis.get(`tunnel:sub:${sub}`);

  if (!data) {
    return res.status(404).send("Not Found | PaperPlane tunnel");
  }

  const port = Number(JSON.parse(data).port);

  createProxyMiddleware({
    target: `http://localhost:${port}`,
    changeOrigin: true,
    onProxyRes: (res, _, __) => {
      res.headers["Via"] = `PaperPlane Tunnel 1.1 @ ${hostname
        .split(".")
        .slice(1)
        .join(".")}`;
    },
    onError: (_, req, res) => {
      res
        .status(404)
        .send(
          `Looks like the target for "${hostname}" is down. This subdomain will be freed in a maximum of 1 hour.`
        );
    },
  })(req, res, next);
});

reverseServer.start(process.env.SOCKETS);
app.listen(process.env.PORT);
