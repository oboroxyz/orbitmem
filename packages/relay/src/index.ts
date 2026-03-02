import { app } from "./app.js";

const port = Number(process.env.PORT ?? 3000);
console.log(`OrbitMem Relay starting on port ${port}`);

export default { port, fetch: app.fetch };
