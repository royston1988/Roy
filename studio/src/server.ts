import path from "node:path";
import express, { type Request, type Response } from "express";
import { config, IMAGES_DIR, live, ROOT } from "./config.js";
import { faceFiles } from "./images.js";
import { approveLook, listJobs, redoLook, rejectLook, startJob } from "./jobs.js";
import { listProducts } from "./shopline.js";

const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, "public")));
app.use("/images", express.static(IMAGES_DIR));

// Turns thrown errors into a plain-words message for the page.
const handle =
  (fn: (req: Request) => unknown) => async (req: Request, res: Response) => {
    try {
      res.json(await fn(req));
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : String(err) });
    }
  };

app.get(
  "/api/status",
  handle(() => ({
    live,
    faces: { yan: faceFiles("yan").length, host: faceFiles("host").length },
    photoModel: config.geminiModel,
  })),
);

app.get("/api/products", handle((req) => listProducts(Number(req.query.page) || 1)));

app.get("/api/jobs", handle(() => listJobs()));

app.post(
  "/api/jobs",
  handle((req) => {
    const products = req.body?.products as { id: string; title: string }[] | undefined;
    if (!Array.isArray(products) || products.length === 0) throw new Error("Pick at least one product.");
    return products.map((p) => startJob(String(p.id), String(p.title)));
  }),
);

app.post("/api/jobs/:job/looks/:look/approve", handle((req) => approveLook(req.params.job, req.params.look)));
app.post("/api/jobs/:job/looks/:look/reject", handle((req) => rejectLook(req.params.job, req.params.look)));
app.post(
  "/api/jobs/:job/looks/:look/redo",
  handle((req) => redoLook(req.params.job, req.params.look, String(req.body?.note ?? ""))),
);

app.listen(config.port, "127.0.0.1", () => {
  console.log(`[studio] open http://localhost:${config.port}`);
  const off = Object.entries(live).filter(([, on]) => !on).map(([name]) => name);
  if (off.length) console.log(`[studio] demo mode for: ${off.join(", ")} (add keys to .env to go live)`);
});
