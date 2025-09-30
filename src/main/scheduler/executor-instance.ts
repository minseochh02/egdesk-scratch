import { ScheduledPostsExecutor } from './scheduled-posts-executor'

let instance: ScheduledPostsExecutor | null = null

export const setScheduledPostsExecutor = (executor: ScheduledPostsExecutor) => {
  instance = executor
}

export const getScheduledPostsExecutor = (): ScheduledPostsExecutor | null => {
  return instance
}

export const restartScheduledPostsExecutor = async (): Promise<void> => {
  try {
    if (!instance) {
      return
    }
    // Stop existing jobs and start fresh to pick up schedule changes
    instance.stop()
    await instance.start()
  } catch (error) {
    console.error('❌ Failed to restart ScheduledPostsExecutor:', error)
  }
}


