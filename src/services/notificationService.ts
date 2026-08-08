export const notificationService = {
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  },

  getPermission(): NotificationPermission | undefined {
    if (!this.isSupported()) return undefined;
    return Notification.permission;
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    return Notification.requestPermission();
  },

  notify(title: string, body?: string): void {
    if (!this.isSupported() || Notification.permission !== 'granted') return;
    new Notification(title, { body });
  },
};
