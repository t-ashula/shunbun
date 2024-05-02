import winston from "winston";

const rootLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});

const getLogger = () => {
  return rootLogger;
};

export { getLogger };
