/**
 * Two admin access levels, both checked on the server:
 *   admin     ADMIN_PASSWORD     everything
 *   uploader  UPLOADER_PASSWORD  add photos/videos only (nothing else)
 *
 * Only the routes that call roleFor() and explicitly allow "uploader" accept
 * the uploader password. Every other admin route still compares directly
 * against ADMIN_PASSWORD, so it rejects the uploader password by default.
 */

export type Role = "admin" | "uploader" | null;

export function roleFor(password: unknown): Role {
  const given = String(password ?? "");
  const admin = String(process.env.ADMIN_PASSWORD ?? "");
  const uploader = String(process.env.UPLOADER_PASSWORD ?? "");

  if (admin && given === admin) return "admin";
  // An uploader password equal to the admin one (or empty) is never treated as a separate login.
  if (uploader && uploader !== admin && given === uploader) return "uploader";
  return null;
}

export function isAdmin(password: unknown) {
  return roleFor(password) === "admin";
}
