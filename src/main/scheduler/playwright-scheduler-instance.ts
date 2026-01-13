import { PlaywrightSchedulerService } from './playwright-scheduler-service';

let instance: PlaywrightSchedulerService | null = null;

export const setPlaywrightSchedulerService = (service: PlaywrightSchedulerService) => {
  instance = service;
};

export const getPlaywrightSchedulerService = (): PlaywrightSchedulerService | null => {
  return instance;
};

export const restartPlaywrightScheduler = async (): Promise<void> => {
  try {
    if (!instance) {
      return;
    }
    // Stop existing jobs and start fresh to pick up schedule changes
    instance.stop();
    await instance.start();
  } catch (error) {
    console.error('❌ Failed to restart PlaywrightSchedulerService:', error);
  }
};
