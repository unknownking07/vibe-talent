import { describe, it, expect } from "vitest";
import { evaluateUser, matchUsers, generateHireMessage } from "../agent-scoring";
import type { UserWithSocials } from "../types/database";
import type { TaskRequest } from "../types/agent";

function createMockUser(overrides: Partial<UserWithSocials> = {}): UserWithSocials {
  return {
    id: "user-1",
    username: "testuser",
    bio: "Full stack developer",
    avatar_url: null,
    streak: 30,
    longest_streak: 60,
    vibe_score: 100,
    badge_level: "bronze",
    created_at: "2025-01-01T00:00:00Z",
    social_links: {
      id: "sl-1",
      user_id: "user-1",
      twitter: "@test",
      telegram: "@test",
      github: "testuser",
      website: "https://test.dev",
      farcaster: null,
    },
    projects: [
      {
        id: "p-1",
        user_id: "user-1",
        title: "Test Project",
        description: "A comprehensive test project with many features and good documentation",
        tech_stack: ["React", "TypeScript", "Node.js"],
        live_url: "https://test.dev",
        github_url: "https://github.com/test/project",
        image_url: null,
        build_time: "2 weeks",
        tags: ["web", "fullstack"],
        verified: true,
        created_at: "2025-01-01T00:00:00Z",
      },
    ],
    ...overrides,
  };
}

describe("evaluateUser", () => {
  it("returns an evaluation result with all required fields", () => {
    const user = createMockUser();
    const result = evaluateUser(user);

    expect(result.username).toBe("testuser");
    expect(result.overall_score).toBeGreaterThanOrEqual(0);
    expect(result.overall_score).toBeLessThanOrEqual(100);
    expect(result.dimensions).toHaveProperty("consistency");
    expect(result.dimensions).toHaveProperty("project_quality");
    expect(result.dimensions).toHaveProperty("tech_breadth");
    expect(result.dimensions).toHaveProperty("activity_recency");
    expect(result.dimensions).toHaveProperty("reputation");
    expect(result.summary).toBeTruthy();
    expect(Array.isArray(result.strengths)).toBe(true);
    expect(Array.isArray(result.risks)).toBe(true);
    expect(result.badge_level).toBe("bronze");
    expect(result.evaluated_at).toBeTruthy();
  });

  it("clamps all dimensions between 0 and 100", () => {
    const user = createMockUser({
      streak: 1000,
      longest_streak: 2000,
      vibe_score: 9999,
      badge_level: "diamond",
    });
    const result = evaluateUser(user);

    Object.values(result.dimensions).forEach((dim) => {
      expect(dim).toBeGreaterThanOrEqual(0);
      expect(dim).toBeLessThanOrEqual(100);
    });
  });

  it("gives higher score to more active users", () => {
    const activeUser = createMockUser({ streak: 100, longest_streak: 200 });
    const inactiveUser = createMockUser({ streak: 0, longest_streak: 5, badge_level: "none" });

    const activeResult = evaluateUser(activeUser);
    const inactiveResult = evaluateUser(inactiveUser);

    expect(activeResult.overall_score).toBeGreaterThan(inactiveResult.overall_score);
  });

  it("gives higher score to users with more projects", () => {
    const manyProjects = createMockUser({
      projects: Array.from({ length: 5 }, (_, i) => ({
        id: `p-${i}`,
        user_id: "user-1",
        title: `Project ${i}`,
        description: "A well-documented project with comprehensive features",
        tech_stack: ["React", "Node.js"],
        live_url: `https://project${i}.dev`,
        github_url: `https://github.com/test/project${i}`,
        image_url: null,
        build_time: "1 week",
        tags: ["web"],
        verified: true,
        created_at: "2025-01-01T00:00:00Z",
      })),
    });
    const fewProjects = createMockUser({ projects: [] });

    const manyResult = evaluateUser(manyProjects);
    const fewResult = evaluateUser(fewProjects);

    expect(manyResult.dimensions.project_quality).toBeGreaterThan(fewResult.dimensions.project_quality);
  });

  it("returns max 5 strengths and max 4 risks", () => {
    const user = createMockUser({
      streak: 200,
      longest_streak: 400,
      vibe_score: 1000,
      badge_level: "diamond",
    });
    const result = evaluateUser(user);
    expect(result.strengths.length).toBeLessThanOrEqual(5);
    expect(result.risks.length).toBeLessThanOrEqual(4);
  });
});

describe("matchUsers", () => {
  const task: TaskRequest = {
    description: "Build a web dashboard with React and TypeScript",
    tech_stack: ["React", "TypeScript"],
    project_type: "mvp",
    timeline: "1_month",
    budget: "2k_5k",
  };

  it("returns max 5 matches sorted by score descending", () => {
    const users = Array.from({ length: 10 }, (_, i) =>
      createMockUser({
        id: `user-${i}`,
        username: `user${i}`,
        streak: i * 10,
        projects: [
          {
            id: `p-${i}`,
            user_id: `user-${i}`,
            title: "Test",
            description: "Test project",
            tech_stack: i % 2 === 0 ? ["React", "TypeScript"] : ["Python", "Django"],
            live_url: null,
            github_url: null,
            image_url: null,
            build_time: null,
            tags: ["web"],
            verified: false,
            created_at: "2025-01-01T00:00:00Z",
          },
        ],
      })
    );

    const results = matchUsers(users, task);

    expect(results.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].match_score).toBeGreaterThanOrEqual(results[i].match_score);
    }
  });

  it("prioritizes users with matching tech stack", () => {
    const reactUser = createMockUser({
      id: "react-dev",
      username: "reactdev",
      projects: [
        {
          id: "p-react",
          user_id: "react-dev",
          title: "React App",
          description: "React app",
          tech_stack: ["React", "TypeScript", "Node.js"],
          live_url: null,
          github_url: null,
          image_url: null,
          build_time: null,
          tags: [],
          verified: false,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const pythonUser = createMockUser({
      id: "python-dev",
      username: "pythondev",
      projects: [
        {
          id: "p-python",
          user_id: "python-dev",
          title: "Python App",
          description: "Python app",
          tech_stack: ["Python", "Flask"],
          live_url: null,
          github_url: null,
          image_url: null,
          build_time: null,
          tags: [],
          verified: false,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const results = matchUsers([pythonUser, reactUser], task);
    expect(results[0].user.username).toBe("reactdev");
  });

  it("returns matched_skills correctly", () => {
    const user = createMockUser({
      projects: [
        {
          id: "p-1",
          user_id: "user-1",
          title: "Test",
          description: "Test",
          tech_stack: ["React", "TypeScript", "Vue"],
          live_url: null,
          github_url: null,
          image_url: null,
          build_time: null,
          tags: [],
          verified: false,
          created_at: "2025-01-01T00:00:00Z",
        },
      ],
    });

    const results = matchUsers([user], task);
    expect(results[0].matched_skills).toContain("React");
    expect(results[0].matched_skills).toContain("Typescript");
  });
});

describe("generateHireMessage", () => {
  it("generates a message with all components", () => {
    const msg = generateHireMessage("John", "devuser", "Build a SaaS app", ["React", "Node.js"]);
    expect(msg).toContain("John");
    expect(msg).toContain("@devuser");
    expect(msg).toContain("Build a SaaS app");
    expect(msg).toContain("React");
    expect(msg).toContain("Node.js");
  });

  it("handles empty matched skills", () => {
    const msg = generateHireMessage("Jane", "builder", "Fix some bugs", []);
    expect(msg).toContain("Jane");
    expect(msg).toContain("@builder");
    expect(msg).not.toContain("expertise in");
  });
});
