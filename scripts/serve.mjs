import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url).pathname.replace(/^\/(.:\/)/, "$1");
const port = Number(process.env.PORT || 4173);
const mimes = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png"
};
createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, `http://${request.headers.host}`).pathname);
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const path = normalize(join(root, relative));
    if (!path.startsWith(normalize(root))) throw new Error("Ruta fuera del proyecto");
    const info = await stat(path);
    const file = info.isDirectory() ? join(path, "index.html") : path;
    response.writeHead(200, {
      "Content-Type": mimes[extname(file)] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    response.end(await readFile(file));
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Kinetra disponible en http://127.0.0.1:${port}`));
