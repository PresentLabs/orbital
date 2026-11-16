import { withPayload } from "@payloadcms/next/withPayload";
import { fileURLToPath } from "node:url";
export default withPayload({
  turbopack: { root: fileURLToPath(new URL(".", import.meta.url)) },
});
