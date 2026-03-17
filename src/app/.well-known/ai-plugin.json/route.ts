import { NextResponse } from "next/server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function GET() {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://vibetalent.xyz";

  const manifest = {
    schema_version: "v1",
    name_for_human: "VibeTalent",
    name_for_model: "vibetalent",
    description_for_human:
      "Discover and hire top vibe coders. Search builders by skills, view profiles, and send hire requests.",
    description_for_model:
      "Plugin for discovering and hiring software builders on VibeTalent. You can search builders by skills (e.g. React, TypeScript, Solidity), filter by vibe score or streak, view full builder profiles with projects and social links, and submit hire requests on behalf of users. Use the /builders endpoint to find talent and /hire to initiate contact.",
    auth: {
      type: "none",
    },
    api: {
      type: "openapi",
      url: `${siteUrl}/api/v1/openapi`,
    },
    logo_url: `${siteUrl}/logo.png`,
    contact_email: "hello@vibetalent.xyz",
    legal_info_url: `${siteUrl}/terms`,
  };

  return NextResponse.json(manifest, { headers: corsHeaders });
}
