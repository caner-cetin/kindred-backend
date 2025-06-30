export const Messages = {
  // Authentication & Authorization
  AUTH_REQUIRED: "Authentication required",
  PERMISSION_DENIED: "Permission denied",
  TASK_DELETE_CREATOR_ONLY: "Only the task creator can delete this task",
  INVALID_CREDENTIALS: "Invalid credentials",
  NO_TOKEN_PROVIDED: "No token provided",
  INVALID_OR_EXPIRED_TOKEN: "Invalid or expired token",

  // Task Management Errors
  TASK_NOT_FOUND: "Task not found",
  INVALID_TASK_ID: "Invalid task ID",
  PRIORITY_NOT_FOUND: "Priority not found",
  ASSIGNEE_NOT_FOUND: "Assignee not found",
  DEFAULT_STATUS_NOT_FOUND: "Default status not found",
  INVALID_STATUS: "Invalid status",

  // Success Messages
  TASK_CREATED_SUCCESS: "Task created successfully",
  TASK_UPDATED_SUCCESS: "Task updated successfully",
  TASK_STATUS_UPDATED_SUCCESS: "Task status updated successfully",
  TASK_DELETED_SUCCESS: "Task deleted successfully",

  // User Management
  USERNAME_ALREADY_EXISTS: "Username already exists",
  USER_NOT_FOUND: "User not found",

  // Token & Session Management
  REFRESH_TOKEN_NOT_PROVIDED: "Refresh token not provided",
  INVALID_OR_EXPIRED_REFRESH_TOKEN: "Invalid or expired refresh token",
  INVALID_REFRESH_TOKEN: "Invalid refresh token",

  // Generic Errors
  INTERNAL_SERVER_ERROR: "Internal server error",

  // Debug & Console Messages
  CREATE_TASK_ERROR: "Create task error:",
  UPDATE_TASK_ERROR: "Update task error:",
  UPDATE_TASK_STATUS_ERROR: "Update task status error:",
  DELETE_TASK_ERROR: "Delete task error:",
  LIST_TASKS_ERROR: "List tasks error:",
  GET_TASK_METADATA_ERROR: "Get task metadata error:",

  // Migration Messages
  MIGRATION_SUCCESS: "was executed successfully",
  MIGRATION_FAILED: "failed to execute migration",
  MIGRATE_FAILED: "failed to migrate",

  // Server Messages
  SERVER_RUNNING: "Elysia is running at http://localhost:",
} as const;

export type MessageKey = keyof typeof Messages;
