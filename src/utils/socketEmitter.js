/**
 * Utility for emitting socket events after HTTP operations
 * @param {Object} req - Express request object
 * @param {String} room - Socket room name (e.g. 'notebook:123')
 * @param {String} event - Event name
 * @param {Object} data - Event data
 */
function emitToRoom(req, room, event, data) {
  const io = req.app.get('io');
  if (io) {
    io.to(room).emit(event, {
      ...data,
      timestamp: new Date()
    });
  }
}

module.exports = {
  emitToRoom
};