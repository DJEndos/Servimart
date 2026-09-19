const { Server } = require('socket.io');

// Providers join a room named after their user id on connect, so we can push
// job offers to exactly the candidates the matching engine picked - not a broadcast.
function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: '*' } });

  io.on('connection', (socket) => {
    socket.on('identify', ({ userId }) => {
      socket.join(`user:${userId}`);
    });

    socket.on('disconnect', () => {
      // Provider apps should also PATCH /provider/availability to false on background/close,
      // since a dropped socket alone doesn't mean the provider is offline.
    });
  });

  // Called right after a service request is ranked and saved with candidateProviders.
  io.notifyCandidates = (request) => {
    request.candidateProviders.forEach((candidate) => {
      io.to(`user:${candidate.provider}`).emit('job_offer', {
        requestId: request._id,
        category: request.category,
        description: request.description,
        distanceMeters: candidate.distanceMeters,
        // Providers should be given a short accept window client-side (e.g. 20-30s)
        // and re-offered to the next candidate on timeout - see notes in matching.js.
      });
    });
  };

  // Called after a provider successfully accepts (the DB write already resolved the race).
  io.notifyJobAssigned = (request) => {
    io.to(`user:${request.customer}`).emit('provider_assigned', {
      requestId: request._id,
      providerId: request.assignedProvider,
    });

    request.candidateProviders
      .filter((c) => String(c.provider) !== String(request.assignedProvider))
      .forEach((c) => {
        io.to(`user:${c.provider}`).emit('job_taken', { requestId: request._id });
      });
  };

  return io;
}

module.exports = initSockets;
