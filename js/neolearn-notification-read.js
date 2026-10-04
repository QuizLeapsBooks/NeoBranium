export function createNotificationReadMarker({ writeReadState, markReadOnServer }) {
  return async function markNotificationRead(userId, notificationId) {
    try {
      await writeReadState(userId, notificationId);
      return;
    } catch (rtdbError) {
      try {
        await markReadOnServer(userId, notificationId);
      } catch (apiError) {
        throw new Error('Notification could not be marked as read. Please retry.', { cause: apiError || rtdbError });
      }
    }
  };
}