import { DockerSchedulerService } from './DockerSchedulerService';

let instance: DockerSchedulerService | null = null;

export const setDockerSchedulerService = (service: DockerSchedulerService) => {
  instance = service;
};

export const getDockerSchedulerServiceInstance = (): DockerSchedulerService | null => {
  return instance;
};

export const restartDockerScheduler = async (): Promise<void> => {
  try {
    if (!instance) {
      return;
    }
    // Stop existing jobs and start fresh to pick up schedule changes
    instance.stop();
    await instance.start();
  } catch (error) {
    console.error('❌ Failed to restart DockerSchedulerService:', error);
  }
};

