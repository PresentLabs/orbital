/// <reference types="astro/client" />
declare namespace App {
  interface Locals {
    workspaceUser?: import("@/lib/saas/model").WorkspaceMember & { workspace: unknown };
  }
}
