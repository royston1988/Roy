import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { DATA_DIR, live, type Person } from "./config.js";
import { checkPhoto, planLooks, type Brief, type Check } from "./director.js";
import { download, faceFiles, loadFaces, readImage, saveImage } from "./images.js";
import { makePhoto } from "./photos.js";
import { addPhoto, getProduct } from "./shopline.js";

export type LookStatus = "waiting" | "making" | "ready" | "failed" | "uploading" | "uploaded" | "rejected";

export type Look = {
  id: string;
  brief: Brief;
  status: LookStatus;
  demo: boolean;
  file?: string;
  check?: Check;
  error?: string;
  note?: string;
  mediaId?: string;
};

export type Job = {
  id: string;
  productId: string;
  productTitle: string;
  status: "working" | "ready" | "failed";
  createdAt: string;
  sourceFile?: string;
  productDetails?: string;
  error?: string;
  looks: Look[];
};

const JOBS_FILE = path.join(DATA_DIR, "jobs.json");
const jobs: Job[] = fs.existsSync(JOBS_FILE) ? JSON.parse(fs.readFileSync(JOBS_FILE, "utf8")) : [];

// Anything cut off by a restart is marked failed so it can be redone.
for (const job of jobs) {
  if (job.status === "working") {
    job.status = "failed";
    job.error = "Stopped when the studio restarted. Please start it again.";
  }
  for (const look of job.looks) {
    if (look.status === "uploading") {
      look.status = "failed";
      look.error = "The studio restarted during upload. Check Shopline before trying again.";
    } else if (look.status === "waiting" || look.status === "making") {
      look.status = "failed";
      look.error = "Stopped when the studio restarted. Press Redo.";
    }
  }
}
save();

function save() {
  fs.writeFileSync(JOBS_FILE, JSON.stringify(jobs, null, 2));
}

// One photo at a time keeps us inside Google's rate limits.
let queue: Promise<unknown> = Promise.resolve();
function enqueue(task: () => Promise<void>) {
  queue = queue.then(task).catch((err) => console.error("[studio]", err));
}

export function listJobs() {
  return jobs.slice().reverse();
}

function find(jobId: string, lookId?: string) {
  const job = jobs.find((j) => j.id === jobId);
  if (!job) throw new Error("That job doesn't exist.");
  const look = job.looks.find((l) => l.id === lookId);
  return { job, look };
}

export function peopleWithPhotos(): Person[] {
  return (["yan", "host"] as Person[]).filter((p) => faceFiles(p).length > 0);
}

export function startJob(productId: string, productTitle: string): Job {
  const job: Job = {
    id: randomUUID().slice(0, 8),
    productId,
    productTitle,
    status: "working",
    createdAt: new Date().toISOString(),
    looks: [],
  };
  jobs.push(job);
  save();
  enqueue(() => runJob(job));
  return job;
}

async function runJob(job: Job) {
  try {
    const product = await getProduct(job.productId);
    if (!product.imageUrl) throw new Error("This product has no photo on Shopline yet.");

    const source = await download(product.imageUrl);
    job.sourceFile = saveImage(`${job.id}-source`, source);
    save();

    const people = live.photos ? peopleWithPhotos() : (["yan", "host"] as Person[]);
    if (people.length === 0) {
      throw new Error("Add photos of Yan or your host to studio/faces first.");
    }

    const plan = await planLooks(source, job.productTitle, people);
    job.productDetails = plan.productDetails;
    job.looks = plan.looks.map((brief) => ({
      id: randomUUID().slice(0, 8),
      brief,
      status: "waiting" as const,
      demo: !live.photos,
    }));
    save();

    for (const look of job.looks) await makeLook(job, look);
    job.status = "ready";
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
  }
  save();
}

async function makeLook(job: Job, look: Look) {
  look.status = "making";
  look.error = undefined;
  save();
  try {
    const product = readImage(job.sourceFile!);
    const photo = await makePhoto({
      brief: look.brief,
      productDetails: job.productDetails ?? job.productTitle,
      product,
      faces: loadFaces(look.brief.person),
      note: look.note,
    });
    look.file = saveImage(`${job.id}-${look.id}-${Date.now()}`, photo);
    look.demo = !live.photos;
    look.check = await checkPhoto(product, photo).catch((err) => ({
      score: 0,
      verdict: "check" as const,
      differences: [`The automatic check didn't work (${err.message}). Please compare by eye.`],
      realism: [],
    }));
    look.status = "ready";
  } catch (err) {
    look.status = "failed";
    look.error = err instanceof Error ? err.message : String(err);
  }
  save();
}

export function redoLook(jobId: string, lookId: string, note: string) {
  const { job, look } = find(jobId, lookId);
  if (!look) throw new Error("That photo doesn't exist.");
  if (look.status === "uploading" || look.status === "uploaded") {
    throw new Error("This photo is already on Shopline.");
  }
  look.note = note.trim() || look.note;
  look.status = "waiting";
  save();
  enqueue(() => makeLook(job, look));
  return job;
}

export function rejectLook(jobId: string, lookId: string) {
  const { job, look } = find(jobId, lookId);
  if (!look) throw new Error("That photo doesn't exist.");
  if (look.status !== "ready" && look.status !== "failed") throw new Error("This photo can't be rejected now.");
  look.status = "rejected";
  save();
  return job;
}

export async function approveLook(jobId: string, lookId: string) {
  const { job, look } = find(jobId, lookId);
  if (!look?.file) throw new Error("That photo doesn't exist.");
  if (look.status !== "ready") throw new Error("Only a finished photo can be approved.");
  if (look.demo) throw new Error("This is a demo photo, so it can't go on your shop.");
  if (!live.shopline) throw new Error("Connect Shopline first (add SHOPLINE_ACCESS_TOKEN).");

  look.status = "uploading";
  look.error = undefined;
  save();
  try {
    look.mediaId = await addPhoto(job.productId, readImage(look.file), `ai-${look.file}`);
    look.status = "uploaded";
  } catch (err) {
    look.status = "ready";
    look.error = err instanceof Error ? err.message : String(err);
  }
  save();
  return job;
}
