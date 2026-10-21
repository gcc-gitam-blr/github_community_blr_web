/** How a handle is shown: "@ada" for a GitHub username; nothing for an Epoch email-code account, whose handle starts
    with "~" (supabase/schema.sql, register_profile) because it isn't a GitHub username and shouldn't look like one. */
export const atHandle = (handle?: string | null) => (handle && !handle.startsWith("~") ? `@${handle}` : "");
export const isGitHubHandle = (handle?: string | null) => !!handle && !handle.startsWith("~");
