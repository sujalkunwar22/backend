const Notification = require('../models/Notification');

const createNotification = async (userId, type, title, message, relatedId = null, relatedType = null) => {
  try {
    const notification = await Notification.create({
      user: userId,
      type,
      title,
      message,
      relatedId,
      relatedType,
    });
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

module.exports = createNotification;

