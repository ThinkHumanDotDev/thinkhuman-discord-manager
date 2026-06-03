import { Hono } from "hono";
import type { Env } from "../env.ts";
import { getGuildChannels, getGuildRoles, getGuildInfo } from "../discord.ts";

const guild = new Hono<{ Bindings: Env }>();

guild.get("/info", async (c) => {
  const info = await getGuildInfo(c.env);
  return c.json(info);
});

guild.get("/channels", async (c) => {
  const channels = await getGuildChannels(c.env);
  return c.json(channels);
});

guild.get("/roles", async (c) => {
  const roles = await getGuildRoles(c.env);
  return c.json(roles);
});

export default guild;
