import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth";
import { uploadFile, ALLOWED_IMAGE_TYPES, MAX_FILE_SIZE } from "@/lib/s3";

type AuthEnv = {
  Variables: {
    user: {
      id: string;
      role: string;
      name?: string | null;
      email?: string | null;
    };
  };
};

const app = new Hono<AuthEnv>();

// POST /logo - admin only
app.post("/logo", requireAdmin, async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return c.json(
      { error: "Invalid file type. Allowed: PNG, JPEG, SVG, WebP" },
      400
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: "File too large. Maximum 2MB" }, 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = file.name.split(".").pop() || "png";
  const key = `logos/company-logo-${Date.now()}.${ext}`;

  const url = await uploadFile(key, buffer, file.type);

  return c.json({ url });
});

export default app;
