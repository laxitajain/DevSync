import { PrismaClient, Role, TaskPriority } from "@prisma/client";
import * as argon2 from "argon2";

/**
 * Seeds a realistic DevSync demo: one workspace ("Acme") with four members
 * spanning every role, two projects, kanban boards, and a backlog of tasks
 * with assignees and comments. Re-running it resets the demo data first so the
 * outcome is deterministic.
 *
 * Every demo user shares the same password so a reviewer can log in instantly:
 *   email: <name>@devsync.dev   password: Password123!
 */
const prisma = new PrismaClient();

const DEMO_PASSWORD = "Password123!";

async function reset() {
  // Cascades handle children, but we delete the top-level tables explicitly so
  // the reset is obvious and order-independent issues never surprise us.
  await prisma.activityLog.deleteMany();
  await prisma.workspace.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  await reset();

  const passwordHash = await argon2.hash(DEMO_PASSWORD);
  const now = new Date();

  const people = [
    { email: "olivia@devsync.dev", name: "Olivia Owner", role: Role.OWNER },
    { email: "aaron@devsync.dev", name: "Aaron Admin", role: Role.ADMIN },
    { email: "maria@devsync.dev", name: "Maria Member", role: Role.MEMBER },
    { email: "victor@devsync.dev", name: "Victor Viewer", role: Role.VIEWER }
  ] as const;

  const users = await Promise.all(
    people.map((p) =>
      prisma.user.create({
        data: {
          email: p.email,
          name: p.name,
          passwordHash,
          emailVerifiedAt: now
        }
      })
    )
  );

  const [olivia, aaron, maria] = users;

  const workspace = await prisma.workspace.create({
    data: {
      name: "Acme Inc",
      slug: "acme",
      members: {
        create: people.map((p, i) => ({ userId: users[i].id, role: p.role }))
      }
    }
  });

  const projectsData = [
    {
      name: "Website Revamp",
      key: "WEB",
      description: "Marketing site redesign and migration to the new design system.",
      columns: ["Backlog", "In Progress", "Review", "Done"],
      tasks: [
        {
          title: "Audit current information architecture",
          priority: TaskPriority.MEDIUM,
          column: 0,
          assignees: [maria.id],
          comments: ["I'll start with the analytics on the top 20 pages."]
        },
        {
          title: "Build component library in Figma",
          priority: TaskPriority.HIGH,
          column: 1,
          assignees: [maria.id, aaron.id],
          comments: ["Buttons and forms are done.", "Need brand sign-off on colors."]
        },
        {
          title: "Migrate blog to MDX",
          priority: TaskPriority.LOW,
          column: 0,
          assignees: [],
          comments: []
        },
        {
          title: "Ship new homepage",
          priority: TaskPriority.URGENT,
          column: 2,
          assignees: [aaron.id],
          comments: ["Blocked on the hero illustration."]
        }
      ]
    },
    {
      name: "Mobile App",
      key: "MOB",
      description: "React Native client for DevSync.",
      columns: ["To Do", "Doing", "Done"],
      tasks: [
        {
          title: "Set up CI for the mobile pipeline",
          priority: TaskPriority.HIGH,
          column: 0,
          assignees: [aaron.id],
          comments: []
        },
        {
          title: "Implement offline task cache",
          priority: TaskPriority.MEDIUM,
          column: 1,
          assignees: [maria.id],
          comments: ["Using SQLite for the local store."]
        }
      ]
    }
  ];

  for (const projectData of projectsData) {
    const project = await prisma.project.create({
      data: {
        workspaceId: workspace.id,
        name: projectData.name,
        key: projectData.key,
        description: projectData.description
      }
    });

    const board = await prisma.board.create({
      data: { projectId: project.id, name: "Main Board" }
    });

    const columns = await Promise.all(
      projectData.columns.map((name, index) =>
        prisma.boardColumn.create({
          data: { boardId: board.id, name, position: (index + 1) * 1000 }
        })
      )
    );

    let taskIndex = 0;
    for (const task of projectData.tasks) {
      taskIndex += 1;
      const created = await prisma.task.create({
        data: {
          projectId: project.id,
          columnId: columns[task.column].id,
          title: task.title,
          priority: task.priority,
          position: taskIndex * 1000,
          createdById: olivia.id,
          assignees: { create: task.assignees.map((userId) => ({ userId })) },
          comments: {
            create: task.comments.map((body) => ({ authorId: maria.id, body }))
          }
        }
      });

      await prisma.activityLog.create({
        data: {
          workspaceId: workspace.id,
          projectId: project.id,
          taskId: created.id,
          actorId: olivia.id,
          action: "task.created",
          metadata: { title: task.title }
        }
      });
    }
  }

  const counts = {
    users: await prisma.user.count(),
    workspaces: await prisma.workspace.count(),
    projects: await prisma.project.count(),
    tasks: await prisma.task.count(),
    comments: await prisma.taskComment.count()
  };

  console.log("Seed complete:", counts);
  console.log(`Demo login -> olivia@devsync.dev / ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
