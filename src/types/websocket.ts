export interface WebSocketUser {
  id: number;
  username: string;
  ws: {
    send: (message: string) => void;
    close: () => void;
  };
}

export type TaskEventType = 
  | 'TASK_CREATED'
  | 'TASK_UPDATED' 
  | 'TASK_STATUS_CHANGED'
  | 'TASK_DELETED';

export interface TaskEvent {
  type: TaskEventType;
  taskId: number;
  task?: {
    id: number;
    title: string;
    description?: string;
    due_date?: string;
    creator_id: number;
    assignee_id?: number;
    creator_username: string;
    assignee_username?: string;
    status: string;
    priority?: string;
    created_at: string;
    updated_at: string;
  };
  userId: number;
  timestamp: string;
}

export interface WebSocketMessage {
  type: TaskEventType;
  data: TaskEvent;
}

// Map to store connected users by ID
export const connectedUsers = new Map<number, WebSocketUser>();

// Helper function to check if user should receive task updates
export function canUserAccessTask(userId: number, task: TaskEvent['task']): boolean {
  if (!task) return false;
  // User can access task if they are creator, assignee, or admin
  return task.creator_id === userId || task.assignee_id === userId;
}

// Helper function to broadcast event to relevant users
export function broadcastTaskEvent(event: TaskEvent, task: TaskEvent['task']) {
  connectedUsers.forEach((user, userId) => {
    if (canUserAccessTask(user.id, task)) {
      try {
        const message = JSON.stringify({
          type: event.type,
          data: event
        } as WebSocketMessage);
        
        user.ws.send(message);
      } catch (error) {
        // Remove disconnected user
        connectedUsers.delete(userId);
      }
    }
  });
}