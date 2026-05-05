import { NextResponse } from "next/server";
import { getSiteUrl } from "@/lib/seo";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  const siteUrl = getSiteUrl();

  const spec = {
    openapi: "3.0.0",
    info: {
      title: "VibeTalent Public API",
      description:
        "Public REST API for discovering and hiring top vibe coders. Search builders by skills, view profiles, and submit hire requests programmatically.",
      version: "1.0.0",
      contact: {
        name: "VibeTalent",
        url: siteUrl,
      },
    },
    servers: [{ url: `${siteUrl}/api/v1` }],
    paths: {
      "/builders": {
        get: {
          operationId: "listBuilders",
          summary: "List and search builders",
          description:
            "Returns a list of builders, optionally filtered by skills, minimum streak, or vibe score.",
          parameters: [
            {
              name: "skills",
              in: "query",
              description:
                "Comma-separated list of skills to filter by (e.g. react,typescript)",
              schema: { type: "string" },
            },
            {
              name: "min_streak",
              in: "query",
              description: "Minimum streak count",
              schema: { type: "integer" },
            },
            {
              name: "min_vibe_score",
              in: "query",
              description: "Minimum vibe score",
              schema: { type: "integer" },
            },
            {
              name: "verified_only",
              in: "query",
              description:
                "If true, only return builders with at least one GitHub-verified project (recommended for hire decisions).",
              schema: { type: "boolean", default: false },
            },
            {
              name: "sort",
              in: "query",
              description: "Sort field",
              schema: {
                type: "string",
                enum: ["vibe_score", "streak", "projects"],
                default: "vibe_score",
              },
            },
            {
              name: "limit",
              in: "query",
              description: "Number of results (1-100, default 20)",
              schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
            },
          ],
          responses: {
            "200": {
              description: "List of builders",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      builders: {
                        type: "array",
                        items: { $ref: "#/components/schemas/BuilderSummary" },
                      },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/builders/{username}": {
        get: {
          operationId: "getBuilder",
          summary: "Get a builder profile",
          description:
            "Returns full profile for a builder including projects and social links.",
          parameters: [
            {
              name: "username",
              in: "path",
              required: true,
              description: "Builder username",
              schema: { type: "string" },
            },
          ],
          responses: {
            "200": {
              description: "Builder profile",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      builder: { $ref: "#/components/schemas/BuilderProfile" },
                    },
                  },
                },
              },
            },
            "404": {
              description: "Builder not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
      "/hire": {
        post: {
          operationId: "submitHireRequest",
          summary: "Submit a hire request",
          description:
            "Send a hire request to a builder by their username. Returns the request ID and a chat URL.",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HireRequestInput" },
              },
            },
          },
          responses: {
            "201": {
              description: "Hire request created",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      success: { type: "boolean" },
                      id: { type: "string", format: "uuid" },
                      chat_url: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
            "400": {
              description: "Invalid request",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
            "404": {
              description: "Builder not found",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Error" },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        BuilderSummary: {
          type: "object",
          properties: {
            username: { type: "string" },
            profile_url: {
              type: "string",
              format: "uri",
              description: "Direct URL to the builder's public profile.",
            },
            bio: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            vibe_score: { type: "integer" },
            streak: { type: "integer" },
            longest_streak: { type: "integer" },
            badge_level: {
              type: "string",
              enum: ["none", "bronze", "silver", "gold", "diamond"],
            },
            projects_count: { type: "integer" },
            verified_projects_count: {
              type: "integer",
              description:
                "How many of the builder's projects are GitHub-verified (owner-match or .vibetalent file).",
            },
            tech_stack: { type: "array", items: { type: "string" } },
          },
        },
        BuilderProfile: {
          type: "object",
          properties: {
            username: { type: "string" },
            profile_url: { type: "string", format: "uri" },
            bio: { type: "string", nullable: true },
            avatar_url: { type: "string", nullable: true },
            vibe_score: { type: "integer" },
            streak: { type: "integer" },
            longest_streak: { type: "integer" },
            badge_level: {
              type: "string",
              enum: ["none", "bronze", "silver", "gold", "diamond"],
            },
            created_at: { type: "string", format: "date-time" },
            review_count: {
              type: "integer",
              description: "Trust-scored review count (anti-abuse filter applied).",
            },
            average_rating: {
              type: "number",
              nullable: true,
              description: "Average of trust-scored reviews (1-5), null if no reviews.",
            },
            projects: {
              type: "array",
              items: { $ref: "#/components/schemas/Project" },
            },
            social_links: {
              $ref: "#/components/schemas/SocialLinks",
              nullable: true,
            },
          },
        },
        Project: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            title: { type: "string" },
            description: { type: "string" },
            tech_stack: { type: "array", items: { type: "string" } },
            live_url: { type: "string", nullable: true },
            github_url: { type: "string", nullable: true },
            image_url: { type: "string", nullable: true },
            build_time: { type: "string", nullable: true },
            tags: { type: "array", items: { type: "string" } },
            verified: {
              type: "boolean",
              description:
                "True when GitHub ownership is verified (owner-match or .vibetalent file).",
            },
            quality_score: {
              type: "integer",
              nullable: true,
              description:
                "Composite 0-100 score from public GitHub signals (community, substance, maintenance).",
            },
            quality_metrics: {
              type: "object",
              nullable: true,
              description:
                "Raw signals — stars, forks, contributors, total_commits, has_tests, has_ci, has_readme, sub-scores, analyzed_at.",
              additionalProperties: true,
            },
            live_url_ok: {
              type: "boolean",
              nullable: true,
              description: "True if the live_url responded healthily on the last check.",
            },
            endorsement_count: {
              type: "integer",
              description: "Public endorsements from other builders.",
            },
            created_at: { type: "string", format: "date-time" },
          },
        },
        SocialLinks: {
          type: "object",
          properties: {
            twitter: { type: "string", nullable: true },
            telegram: { type: "string", nullable: true },
            github: { type: "string", nullable: true },
            website: { type: "string", nullable: true },
            farcaster: { type: "string", nullable: true },
          },
        },
        HireRequestInput: {
          type: "object",
          required: ["builder_username", "sender_name", "sender_email", "message"],
          properties: {
            builder_username: {
              type: "string",
              description: "Username of the builder to hire",
            },
            sender_name: { type: "string", description: "Your name" },
            sender_email: {
              type: "string",
              format: "email",
              description: "Your email address",
            },
            message: {
              type: "string",
              description: "Message to the builder about the project",
            },
            budget: {
              type: "string",
              description: "Optional budget range (e.g. '$1k-5k')",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            error: { type: "string" },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, { headers: corsHeaders });
}
