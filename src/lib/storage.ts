// Image hosting for event photos, via imgbb (https://imgbb.com/).
//
// To enable uploads, set this in .env.local (and in the Vercel dashboard for prod):
//
//   IMGBB_API_KEY   - your imgbb API key
//                     (get one at https://api.imgbb.com/ — free, no signup required beyond email)
//
// Without it, `isStorageConfigured()` returns false and `uploadToStorage()` throws
// a clear error. The app still works — users can paste external image URLs.
//
// Notes on imgbb:
//   - Images are hosted at i.ibb.co with permanent public URLs.
//   - Uploads return a one-time `delete_url` that opens a webpage (not an API).
//     We store it in the DB (image_key) so a human can manually delete later;
//     `deleteFromStorage` is a no-op because imgbb has no clean delete API.

export type UploadResult = { url: string; key: string | null };

export function isStorageConfigured(): boolean {
  return Boolean(process.env.IMGBB_API_KEY);
}

export async function uploadToStorage(
  body: Buffer,
  filename: string,
  _contentType: string
): Promise<UploadResult> {
  const apiKey = process.env.IMGBB_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Image upload is not configured. Set IMGBB_API_KEY in .env.local to enable it."
    );
  }

  // imgbb accepts a base64 payload in the "image" field.
  const form = new FormData();
  form.append("image", body.toString("base64"));
  if (filename) form.append("name", filename);

  const url = `https://api.imgbb.com/1/upload?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "POST", body: form });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `imgbb upload failed (${res.status}): ${text.slice(0, 200) || "no body"}`
    );
  }

  const json = (await res.json()) as {
    success?: boolean;
    data?: { url?: string; display_url?: string; delete_url?: string };
    error?: { message?: string };
  };

  if (!json.success || !json.data?.url) {
    throw new Error(json.error?.message || "imgbb returned no image URL");
  }

  return {
    url: json.data.display_url || json.data.url,
    key: json.data.delete_url || null,
  };
}

// imgbb doesn't expose a clean delete API — the `delete_url` we stored is a
// one-time webpage that requires a manual click. This is a no-op; if the event
// is deleted, the image stays on imgbb (visit the delete_url to remove it).
export async function deleteFromStorage(_key: string): Promise<void> {
  return;
}
