import { z } from "zod";

export const DirectionSchema = z.enum(["up", "down", "left", "right", "none"]);

export const JoinRoomSchema = z.object({
  roomId: z.string().min(1).max(8),
  playerName: z.string().min(1).max(20),
  mode: z.enum(["coop", "versus"]).default("coop"),
});

export const CreateRoomSchema = z.object({
  playerName: z.string().min(1).max(20),
  mode: z.enum(["coop", "versus"]).default("coop"),
});

export const InputSchema = z.object({
  direction: DirectionSchema,
});

export const StartGameSchema = z.object({});

export type JoinRoomMsg = z.infer<typeof JoinRoomSchema>;
export type CreateRoomMsg = z.infer<typeof CreateRoomSchema>;
export type InputMsg = z.infer<typeof InputSchema>;
