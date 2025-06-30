import { describe, it, expect, beforeAll } from "bun:test";
import { App, createApp } from "../src/index";
import { treaty } from "@elysiajs/eden";
import { Messages } from "../src/constants/messages";

describe("Tasks", () => {
  let api: any;
  let userToken: string;
  let secondUserToken: string;
  let taskId: number;

  beforeAll(async () => {
    const app = await createApp(":memory:");
    api = treaty(app);

    // Create first user and get token
    const { data: userData } = await api.signup.post({
      username: "taskuser",
      password: "password123",
      email: "task@example.com",
      fullName: "Task User",
    });
    userToken = userData?.accessToken;

    // Create second user for permission testing
    const { data: secondUserData } = await api.signup.post({
      username: "otheruser",
      password: "password123",
      email: "other@example.com",
      fullName: "Other User",
    });
    secondUserToken = secondUserData?.accessToken;
  });

  describe("GET /tasks/metadata", () => {
    it("should return task metadata (priorities and statuses)", async () => {
      const { data, status } = await api.tasks.metadata.get({
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data).toHaveProperty("priorities");
      expect(data).toHaveProperty("statuses");
      expect(data.priorities).toHaveLength(4); // Low, Medium, High, Critical
      expect(data.statuses).toHaveLength(3); // To Do, In Progress, Completed
    });

    it("should require authentication for metadata", async () => {
      const { error, status } = await api.tasks.metadata.get();

      expect(status).toEqual(401);
      expect(error?.value?.message).toEqual(Messages.AUTH_REQUIRED);
    });
  });

  describe("POST /tasks", () => {
    it("should create a new task with minimum required fields", async () => {
      const { data, status } = await api.tasks.post(
        {
          title: "Test Task",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data).toHaveProperty("task");
      expect(data.task.title).toEqual("Test Task");
      expect(data.message).toEqual(Messages.TASK_CREATED_SUCCESS);

      taskId = data.task.id; // Store for later tests
    });

    it("should create a task with all fields", async () => {
      const { data, status } = await api.tasks.post(
        {
          title: "Complete Task",
          description: "A task with all fields filled",
          priority_id: 3, // High priority
          due_date: "2024-12-31T23:59:59Z",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.task.title).toEqual("Complete Task");
      expect(data.task.description).toEqual("A task with all fields filled");
    });

    it("should require authentication to create task", async () => {
      const { error, status } = await api.tasks.post({
        title: "Unauthorized Task",
      });

      expect(status).toEqual(401);
      expect(error?.value?.message).toEqual(Messages.AUTH_REQUIRED);
    });

    it("should validate required title field", async () => {
      const { error, status } = await api.tasks.post(
        {
          description: "Task without title",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(422);
    });

    it("should validate invalid priority_id", async () => {
      const { error, status } = await api.tasks.post(
        {
          title: "Task with invalid priority",
          priority_id: 999,
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(400);
      expect(error?.value?.message).toEqual(Messages.PRIORITY_NOT_FOUND);
    });

    it("should validate invalid assignee_id", async () => {
      const { error, status } = await api.tasks.post(
        {
          title: "Task with invalid assignee",
          assignee_id: 999,
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(400);
      expect(error?.value?.message).toEqual(Messages.ASSIGNEE_NOT_FOUND);
    });
  });

  describe("GET /tasks", () => {
    it("should list user's tasks", async () => {
      const { data, status } = await api.tasks.get({
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data).toHaveProperty("tasks");
      expect(data).toHaveProperty("stats");
      expect(Array.isArray(data.tasks)).toBe(true);
      expect(data.tasks.length).toBeGreaterThan(0);
    });

    it("should filter tasks by status", async () => {
      const { data, status } = await api.tasks.get({
        query: { status: "To Do" },
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data.tasks.every((task: any) => task.status === "To Do")).toBe(true);
    });

    it("should filter tasks by assignee filter", async () => {
      const { data, status } = await api.tasks.get({
        query: { assignee: "created" },
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data.tasks.every((task: any) => task.creator_username === "taskuser")).toBe(true);
    });

    it("should filter tasks by title", async () => {
      // Create a task with a unique title for this test
      const { data: createdTaskData } = await api.tasks.post(
        {
          title: "Unique Task Title for Filtering",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      const { data, status } = await api.tasks.get({
        query: { title: "Unique Task Title" },
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data.tasks.length).toBeGreaterThan(0);
      expect(data.tasks.every((task: any) => task.title.includes("Unique Task Title"))).toBe(true);
    });

    it("should filter tasks by due_date_start and due_date_end", async () => {
      // Create tasks with specific due dates
      const { data: task1Data } = await api.tasks.post(
        {
          title: "Task Due Today",
          due_date: "2025-06-30T12:00:00Z",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      const { data: task2Data } = await api.tasks.post(
        {
          title: "Task Due Tomorrow",
          due_date: "2025-07-01T12:00:00Z",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      const { data: task3Data } = await api.tasks.post(
        {
          title: "Task Due Next Week",
          due_date: "2025-07-07T12:00:00Z",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      // Filter for tasks due between today and tomorrow
      const { data, status } = await api.tasks.get({
        query: {
          due_date_start: "2025-06-30T00:00:00Z",
          due_date_end: "2025-07-01T23:59:59Z",
        },
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data.tasks.length).toBeGreaterThanOrEqual(2);
      expect(data.tasks.some((task: any) => task.title === "Task Due Today")).toBe(true);
      expect(data.tasks.some((task: any) => task.title === "Task Due Tomorrow")).toBe(true);
      expect(data.tasks.every((task: any) => new Date(task.due_date) >= new Date("2025-06-30T00:00:00Z") && new Date(task.due_date) <= new Date("2025-07-01T23:59:59Z"))).toBe(true);
    });

    it("should filter tasks by created_at_start and created_at_end", async () => {
      // Create tasks with specific creation dates (adjusting for test execution time)
      const { data: taskAData } = await api.tasks.post(
        {
          title: "Task Created Yesterday",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );
      // Simulate a slight delay for distinct creation times
      await new Promise(resolve => setTimeout(resolve, 100));
      const { data: taskBData } = await api.tasks.post(
        {
          title: "Task Created Today",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      // Get current date and yesterday's date for filtering
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);

      const created_at_start = yesterday.toISOString().split('T')[0] + 'T00:00:00Z';
      const created_at_end = today.toISOString().split('T')[0] + 'T23:59:59Z';

      const { data, status } = await api.tasks.get({
        query: {
          created_at_start,
          created_at_end,
        },
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data.tasks.length).toBeGreaterThanOrEqual(2);
      expect(data.tasks.some((task: any) => task.title === "Task Created Yesterday")).toBe(true);
      expect(data.tasks.some((task: any) => task.title === "Task Created Today")).toBe(true);
      expect(data.tasks.every((task: any) => new Date(task.created_at) >= new Date(created_at_start) && new Date(task.created_at) <= new Date(created_at_end))).toBe(true);
    });

    it("should require authentication to list tasks", async () => {
      const { error, status } = await api.tasks.get();

      expect(status).toEqual(401);
      expect(error?.value?.message).toEqual(Messages.AUTH_REQUIRED);
    });
  });

  describe("PUT /tasks/:id", () => {
    it("should update a task", async () => {
      const { data, status } = await api.tasks[taskId].put(
        {
          title: "Updated Task Title",
          description: "Updated description",
          priority_id: 2,
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.task.title).toEqual("Updated Task Title");
      expect(data.task.description).toEqual("Updated description");
      expect(data.message).toEqual(Messages.TASK_UPDATED_SUCCESS);
    });

    it("should allow partial updates", async () => {
      const { data, status } = await api.tasks[taskId].put(
        {
          title: "Partially Updated Task",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.task.title).toEqual("Partially Updated Task");
    });

    it("should not allow non-creator/non-assignee to update task", async () => {
      const { error, status } = await api.tasks[taskId].put(
        {
          title: "Unauthorized Update",
        },
        {
          headers: {
            Authorization: `Bearer ${secondUserToken}`,
          },
        }
      );

      expect(status).toEqual(403);
      expect(error?.value?.message).toEqual(Messages.PERMISSION_DENIED);
    });

    it("should return 404 for non-existent task", async () => {
      const { error, status } = await api.tasks["999"].put(
        {
          title: "Non-existent Task",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(404);
      expect(error?.value?.message).toEqual(Messages.TASK_NOT_FOUND);
    });

    it("should validate invalid priority in update", async () => {
      const { error, status } = await api.tasks[taskId].put(
        {
          priority_id: 999,
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(400);
      expect(error?.value?.message).toEqual(Messages.PRIORITY_NOT_FOUND);
    });

    it("should require authentication to update task", async () => {
      const { error, status } = await api.tasks[taskId].put({
        title: "Unauthorized Update",
      });

      expect(status).toEqual(401);
      expect(error?.value?.message).toEqual(Messages.AUTH_REQUIRED);
    });
  });

  describe("PATCH /tasks/:id/status", () => {
    it("should update task status to In Progress", async () => {
      const { data, status } = await api.tasks[taskId].status.patch(
        {
          status: "In Progress",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.status).toEqual("In Progress");
      expect(data.message).toEqual(Messages.TASK_STATUS_UPDATED_SUCCESS);
    });

    it("should update task status to Completed", async () => {
      const { data, status } = await api.tasks[taskId].status.patch(
        {
          status: "Completed",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.status).toEqual("Completed");
    });

    it("should validate status value", async () => {
      const { error, status } = await api.tasks[taskId].status.patch(
        {
          status: "Invalid Status",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(422);
    });

    it("should not allow non-creator/non-assignee to update status", async () => {
      const { error, status } = await api.tasks[taskId].status.patch(
        {
          status: "To Do",
        },
        {
          headers: {
            Authorization: `Bearer ${secondUserToken}`,
          },
        }
      );

      expect(status).toEqual(403);
      expect(error?.value?.message).toEqual(Messages.PERMISSION_DENIED);
    });

    it("should return 404 for non-existent task status update", async () => {
      const { error, status } = await api.tasks["999"].status.patch(
        {
          status: "Completed",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(404);
      expect(error?.value?.message).toEqual(Messages.TASK_NOT_FOUND);
    });

    it("should require authentication to update status", async () => {
      const { error, status } = await api.tasks[taskId].status.patch({
        status: "Completed",
      });

      expect(status).toEqual(401);
      expect(error?.value?.message).toEqual(Messages.AUTH_REQUIRED);
    });
  });

  describe("DELETE /tasks/:id", () => {
    let deleteTaskId: number;

    it("should create a task for deletion testing", async () => {
      const { data } = await api.tasks.post(
        {
          title: "Task to Delete",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );
      deleteTaskId = data.task.id;
    });

    it("should delete a task", async () => {
      const { data, status } = await api.tasks[deleteTaskId].delete(undefined, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data.message).toEqual(Messages.TASK_DELETED_SUCCESS);
    });

    it("should return 404 for already deleted task", async () => {
      const { error, status } = await api.tasks[deleteTaskId].delete(undefined, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(404);
      expect(error?.value?.message).toEqual(Messages.TASK_NOT_FOUND);
    });

    it("should not allow non-creator to delete task", async () => {
      // Create task with first user
      const { data: createData } = await api.tasks.post(
        {
          title: "Task for Permission Test",
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      // Try to delete with second user
      const { error, status } = await api.tasks[createData.task.id].delete(undefined, {
        headers: {
          Authorization: `Bearer ${secondUserToken}`,
        },
      });

      expect(status).toEqual(403);
      expect(error?.value?.message).toEqual(Messages.TASK_DELETE_CREATOR_ONLY);
    });

    it("should return 404 for non-existent task deletion", async () => {
      const { error, status } = await api.tasks["999"].delete(undefined, {
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(404);
      expect(error?.value?.message).toEqual(Messages.TASK_NOT_FOUND);
    });

    it("should require authentication to delete task", async () => {
      const { error, status } = await api.tasks[taskId].delete();

      expect(status).toEqual(401);
      expect(error?.value?.message).toEqual(Messages.AUTH_REQUIRED);
    });
  });

  describe("Task Assignment and Permissions", () => {
    let assignedTaskId: number;

    it("should create a task assigned to another user", async () => {
      // Get the second user's ID by creating a task and checking the user data
      const { data: secondUserData } = await api.me.get({
        headers: {
          Authorization: `Bearer ${secondUserToken}`,
        },
      });

      const { data, status } = await api.tasks.post(
        {
          title: "Assigned Task",
          description: "Task assigned to another user",
          assignee_id: secondUserData.id,
        },
        {
          headers: {
            Authorization: `Bearer ${userToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      assignedTaskId = data.task.id;
    });

    it("should allow assignee to update assigned task", async () => {
      const { data, status } = await api.tasks[assignedTaskId].put(
        {
          description: "Updated by assignee",
        },
        {
          headers: {
            Authorization: `Bearer ${secondUserToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.task.description).toEqual("Updated by assignee");
    });

    it("should allow assignee to update task status", async () => {
      const { data, status } = await api.tasks[assignedTaskId].status.patch(
        {
          status: "In Progress",
        },
        {
          headers: {
            Authorization: `Bearer ${secondUserToken}`,
          },
        }
      );

      expect(status).toEqual(200);
      expect(data.status).toEqual("In Progress");
    });

    it("should show assigned tasks in assignee's task list", async () => {
      const { data, status } = await api.tasks.get({
        headers: {
          Authorization: `Bearer ${secondUserToken}`,
        },
      });

      expect(status).toEqual(200);
      const assignedTask = data.tasks.find((task: any) => task.id === assignedTaskId);
      expect(assignedTask).toBeDefined();
      expect(assignedTask.assignee_username).toEqual("otheruser");
    });
  });

  describe("Task Statistics", () => {
    it("should return task statistics with task list", async () => {
      const { data, status } = await api.tasks.get({
        headers: {
          Authorization: `Bearer ${userToken}`,
        },
      });

      expect(status).toEqual(200);
      expect(data).toHaveProperty("stats");
      expect(typeof data.stats).toBe("object");

      // Should have counts for different statuses
      const statsKeys = Object.keys(data.stats);
      expect(statsKeys.length).toBeGreaterThan(0);
    });
  });
});
