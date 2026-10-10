import { describe, it, expect } from "vitest";
import {
  evaluateUser,
  matchUsers,
  generateHireMessage,
} from "../agent-scoring";
import type { UserWithSocials, Project } from "../types/database";
import type { TaskRequest } from "../types/agent";

const projectDefaults: Pick<
  Project,
  | "quality_score"
  | "quality_metrics"
  | "live_url_ok"
  | "endorsement_count"
  | "is_private"
> = {
  quality_score: 0,
  quality_metrics: null,
  live_url_ok: null,
  endorsement_count: 0,
  is_private: false,
};

function createMockProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "p-1",
    user_id: "user-1",
    title: "Test Project",
    description:
      "A comprehensive test project with many features and good documentation",
    tech_stack: ["React", "TypeScript", "Node.js"],
    live_url: "https://test.dev",
    github_url: "https://github.com/test/project",
    image_url: null,
    build_time: "2 weeks",
    tags: ["web", "fullstack"],
    verified: true,
    created_at: "2025-01-01T00:00:00Z",
    ...projectDefaults,
    ...overrides,
  };
}

function createMockUser(
  overrides: Partial<UserWithSocials> = {},
): UserWithSocials {
  return {
    id: "user-1",
    username: "testuser",
    display_name: null,
    bio: "Full stack developer",
    avatar_url: null,
    github_username: null,
    streak: 30,
    longest_streak: 60,
    vibe_score: 100,
    badge_level: "bronze",
    streak_freezes_remaining: 2,
    streak_freezes_used: 0,
    referral_count: 0,
    share_private_activity: false,
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
    projects: [createMockProject()],
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

    Object.values(result.dimensions).filter(dim => dim !== null).forEach((dim) => {
      expect(dim).toBeGreaterThanOrEqual(0);
      expect(dim).toBeLessThanOrEqual(100);
    });
  });

  it("keeps activity out of the hiring score", () => {
    const activeUser = createMockUser({ streak: 100, longest_streak: 200 });
    const inactiveUser = createMockUser({
      streak: 0,
      longest_streak: 5,
      badge_level: "none",
    });

    const activeResult = evaluateUser(activeUser);
    const inactiveResult = evaluateUser(inactiveUser);

    expect(activeResult.overall_score).toBe(inactiveResult.overall_score);
  });

  it("gives higher score to users with more projects", () => {
    const manyProjects = createMockUser({
      projects: Array.from({ length: 5 }, (_, i) =>
        createMockProject({
          id: `p-${i}`,
          title: `Project ${i}`,
          description: "A well-documented project with comprehensive features",
          tech_stack: ["React", "Node.js"],
          live_url: `https://project${i}.dev`,
          github_url: `https://github.com/test/project${i}`,
          build_time: "1 week",
          tags: ["web"],
        }),
      ),
    });
    const fewProjects = createMockUser({ projects: [] });

    const manyResult = evaluateUser(manyProjects);
    const fewResult = evaluateUser(fewProjects);

    expect(manyResult.dimensions.project_quality).toBeGreaterThan(
      fewResult.dimensions.project_quality,
    );
  });

  it("flags unverified projects as a risk", () => {
    const user = createMockUser({
      projects: [
        createMockProject({
          title: "Fake",
          description: "Unverified project",
          tech_stack: ["React"],
          live_url: null,
          github_url: null,
          build_time: null,
          tags: [],
          verified: false,
        }),
      ],
    });
    const result = evaluateUser(user);
    expect(
      result.risks.some(
        (r) => r.includes("unverified") || r.includes("ownership"),
      ),
    ).toBe(true);
  });

  it("gives higher project quality score to verified projects", () => {
    const verifiedUser = createMockUser({
      projects: Array.from({ length: 3 }, (_, i) =>
        createMockProject({
          id: `p-${i}`,
          title: `Proj ${i}`,
          description: "A well-documented project with comprehensive features",
          tech_stack: ["React"],
          live_url: `https://p${i}.dev`,
          github_url: `https://github.com/t/p${i}`,
          build_time: null,
          tags: [],
          verified: true,
        }),
      ),
    });
    const unverifiedUser = createMockUser({
      projects: Array.from({ length: 3 }, (_, i) =>
        createMockProject({
          id: `p-${i}`,
          title: `Proj ${i}`,
          description: "A well-documented project with comprehensive features",
          tech_stack: ["React"],
          live_url: `https://p${i}.dev`,
          github_url: `https://github.com/t/p${i}`,
          build_time: null,
          tags: [],
          verified: false,
        }),
      ),
    });
    const vResult = evaluateUser(verifiedUser);
    const uResult = evaluateUser(unverifiedUser);
    expect(vResult.dimensions.project_quality).toBeGreaterThan(
      uResult.dimensions.project_quality,
    );
  });

  it("returns at most 6 strengths and 5 risks", () => {
    const user = createMockUser({
      streak: 200,
      longest_streak: 400,
      vibe_score: 1000,
      badge_level: "diamond",
    });
    const result = evaluateUser(user);
    expect(result.strengths.length).toBeLessThanOrEqual(6);
    expect(result.risks.length).toBeLessThanOrEqual(5);
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
          createMockProject({
            id: `p-${i}`,
            user_id: `user-${i}`,
            title: "Test",
            description: "Test project",
            tech_stack:
              i % 2 === 0 ? ["React", "TypeScript"] : ["Python", "Django"],
            live_url: null,
            github_url: null,
            build_time: null,
            tags: ["web"],
            verified: false,
          }),
        ],
      }),
    );

    const results = matchUsers(users, task);

    expect(results.length).toBeLessThanOrEqual(5);
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].match_score).toBeGreaterThanOrEqual(
        results[i].match_score,
      );
    }
  });

  it("prioritizes users with matching tech stack", () => {
    const reactUser = createMockUser({
      id: "react-dev",
      username: "reactdev",
      projects: [
        createMockProject({
          id: "p-react",
          user_id: "react-dev",
          title: "React App",
          description: "React app",
          tech_stack: ["React", "TypeScript", "Node.js"],
          live_url: null,
          github_url: null,
          build_time: null,
          tags: [],
          verified: true,
        }),
      ],
    });

    const pythonUser = createMockUser({
      id: "python-dev",
      username: "pythondev",
      projects: [
        createMockProject({
          id: "p-python",
          user_id: "python-dev",
          title: "Python App",
          description: "Python app",
          tech_stack: ["Python", "Flask"],
          live_url: null,
          github_url: null,
          build_time: null,
          tags: [],
          verified: true,
        }),
      ],
    });

    const results = matchUsers([pythonUser, reactUser], task);
    expect(results[0].user.username).toBe("reactdev");
  });

  it("returns matched_skills correctly", () => {
    const user = createMockUser({
      projects: [
        createMockProject({
          title: "Test",
          description: "Test",
          tech_stack: ["React", "TypeScript", "Vue"],
          live_url: null,
          github_url: null,
          build_time: null,
          tags: [],
          verified: true,
        }),
      ],
    });

    const results = matchUsers([user], task);
    expect(results[0].matched_skills).toContain("React");
    expect(results[0].matched_skills).toContain("Typescript");
  });
});

describe("hiring evidence safeguards", () => {
  const task: TaskRequest = {
    description: "Build a React dashboard",
    tech_stack: ["React"],
    project_type: "mvp", timeline: "flexible", budget: "500_2k",
  };

  it("does not reward inflated streaks, badges, or vibe scores in hiring", () => {
    const ordinary = createMockUser({ streak: 0, longest_streak: 0, vibe_score: 10, badge_level: "none" });
    const inflated = { ...ordinary, streak: 10000, longest_streak: 10000, vibe_score: 1000000, badge_level: "diamond" as const };
    expect(evaluateUser(inflated).overall_score).toBe(evaluateUser(ordinary).overall_score);
    expect(matchUsers([inflated], task)[0].match_score).toBe(matchUsers([ordinary], task)[0].match_score);
  });

  it("does not let commit counts, stars, or endorsements inflate portfolio evidence", () => {
    const project = createMockProject({ quality_metrics: { has_tests: true, has_ci: true, has_readme: true } as Project["quality_metrics"] });
    const ordinary = createMockUser({ projects: [project] });
    const inflated = createMockUser({ projects: [{ ...project, quality_score: 100, endorsement_count: 10000, quality_metrics: { ...project.quality_metrics!, total_commits: 1000000, stars: 1000000, community_score: 100, maintenance_score: 100 } }] });
    expect(evaluateUser(inflated).overall_score).toBe(evaluateUser(ordinary).overall_score);
  });

  it("does not reward a flood of duplicate or unverified projects", () => {
    const project = createMockProject();
    const ordinary = createMockUser({ projects: [project] });
    const flooded = createMockUser({ projects: [project, ...Array.from({ length: 100 }, (_, i) => createMockProject({ id: `spam-${i}`, verified: false, quality_score: 100, endorsement_count: 100 }))] });
    const duplicated = createMockUser({ projects: Array.from({ length: 100 }, (_, i) => ({ ...project, id: `duplicate-${i}` })) });
    expect(evaluateUser(flooded).overall_score).toBe(evaluateUser(ordinary).overall_score);
    expect(evaluateUser(duplicated).overall_score).toBe(evaluateUser(ordinary).overall_score);
  });

  it("breaks tied hiring scores independently of input activity order", () => {
    const first = createMockUser({ username: "aaa", vibe_score: 10, streak: 0 });
    const second = createMockUser({ username: "zzz", vibe_score: 1000000, streak: 10000 });
    expect(matchUsers([second, first], task).map(match => match.user.username)).toEqual(["aaa", "zzz"]);
  });

  it("puts inspectable work above an activity-only profile", () => {
    const farmer = createMockUser({ username: "farmer", streak: 10000, longest_streak: 10000, vibe_score: 1000000, badge_level: "diamond", projects: [] });
    const builder = createMockUser({ username: "builder", streak: 0, longest_streak: 0, vibe_score: 10, badge_level: "none" });
    expect(evaluateUser(farmer).overall_score).toBe(0);
    expect(matchUsers([farmer, builder], task)[0].user.username).toBe("builder");
  });

  it("excludes private, flagged, and unverified projects from hiring evidence and skills", () => {
    const hidden = createMockProject({ is_private: true });
    const flagged = { ...createMockProject(), flagged: true };
    const user = createMockUser({ projects: [hidden, flagged, createMockProject({ verified: false })] });
    expect(evaluateUser(user).overall_score).toBe(0);
    expect(matchUsers([user], task)[0].matched_skills).toEqual([]);
  });

  it("describes repository checks without claiming delivery or passing tests", () => {
    const user = createMockUser({ projects: [createMockProject({ quality_metrics: { has_tests: true, has_ci: true } as Project["quality_metrics"] })] });
    const result = evaluateUser(user);
    expect(result.strengths.join(" ")).toContain("Test-related files or configuration detected");
    expect(result.summary).toContain("delivery");
    expect(result.summary).not.toMatch(/reliable|production-grade|Has shipped/);
    expect(result.strengths.join(" ")).not.toMatch(/test suites|Open source contributor/);
    expect(result.risks.join(" ")).toContain("paid trial");
  });
});

describe("generateHireMessage", () => {
  it("generates a message with all components", () => {
    const msg = generateHireMessage("John", "devuser", "Build a SaaS app", [
      "React",
      "Node.js",
    ]);
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
