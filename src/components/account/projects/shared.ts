import type { ProjectMilestonesRow, ProjectsRow, ProjectStage } from "@/lib/backend/db-types";

export const PROJECT_STEPS = [
  { key: "discovery", label: "Discovery" },
  { key: "design", label: "Design" },
  { key: "artwork", label: "Artwork" },
  { key: "approval", label: "Approval" },
  { key: "production", label: "Production" },
  { key: "quality_control", label: "Quality control" },
  { key: "delivery", label: "Delivery" },
  { key: "completion", label: "Completion" },
] as const satisfies readonly { key: ProjectStage; label: string }[];

export const stageLabel = (s: ProjectStage) => PROJECT_STEPS.find((x) => x.key === s)?.label ?? s;

export const STAGE_NOTE: Record<ProjectStage, string> = {
  discovery: "SPP is understanding the brief: goals, sites, quantities and constraints.",
  design: "Concepts and layouts are being developed.",
  artwork: "Final artwork is being prepared for production.",
  approval: "Waiting for sign-off. Check the messages below for anything SPP needs from you.",
  production: "In production.",
  quality_control: "Finished work is being checked before it leaves SPP.",
  delivery: "Being delivered or installed.",
  completion: "Project complete.",
};

export const PROJECT_COLS = "id,ref,name,objective,scope,stage,due_on,created_at,updated_at";
export type ProjectLite = Pick<ProjectsRow, "id" | "ref" | "name" | "objective" | "scope" | "stage" | "due_on" | "created_at" | "updated_at">;
export type Milestone = Pick<ProjectMilestonesRow, "id" | "title" | "due_on" | "done_at" | "sort">;
